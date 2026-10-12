import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi, parseAbiItem, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

const app = new Hono();
const rpcUrl = process.env.RPC_URL_FUJI ?? "https://api.avax-test.network/ext/bc/C/rpc";
const factoryAddress = process.env.FACTORY_ADDRESS as Address | undefined;
const intervalMs = Math.max(5_000, Number(process.env.KEEPER_TICK_MS ?? 15_000));
const startBlock = BigInt(process.env.START_BLOCK ?? "0");
const account = process.env.KEEPER_PK ? privateKeyToAccount(process.env.KEEPER_PK as Hex) : undefined;
const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl, { retryCount: 2, timeout: 8_000 }) });
const walletClient = account ? createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl, { retryCount: 1, timeout: 8_000 }) }) : undefined;

const projectCreated = parseAbiItem("event ProjectCreated(uint256 indexed projectId,address indexed founder,address raise,string metadataURI)");
const projectLive = parseAbiItem("event ProjectLive(uint256 indexed projectId,address token,address treasury,address governor,address spotAmm,address performancePackage)");
const raiseAbi = parseAbi([
  "function state() view returns (uint8)",
  "function cfg() view returns (uint256 minRaise,uint256 hardCap,uint256 minContribution,uint64 startTime,uint64 endTime,uint16 liquidityUsdcBps,uint16 liquidityPremiumBps)",
  "function finalize()",
]);
const governorAbi = parseAbi([
  "function activeProposalId() view returns (uint256)",
  "function proposalCount() view returns (uint256)",
  "function params() view returns (uint32 warmup,uint32 tradingPeriod,uint32 twapStartDelay,uint32 executionWindow,uint32 minUpdateInterval,uint16 maxObsChangeBps,uint16 thresholdBps,uint16 ammFeeBps,uint256 proposalBond,uint256 minLiquidityUsdc)",
  "function forecastWindow(uint256 proposalId) view returns (uint8 proposalState,uint64 createdAt,uint64 tradingStart,uint64 tradingEnd)",
  "function proposals(uint256 proposalId) view returns (address proposer,bytes32 descriptionHash,bytes32 actionsHash,uint8 state,uint8 outcome,uint64 createdAt,uint64 tradingStart,uint64 tradingEnd,uint64 executionDeadline,uint256 bond,address vaultUsdc,address vaultToken,address passAmm,address failAmm,uint256 seedPriceE18,uint256 twapPassE18,uint256 twapFailE18)",
  "function getMarket(uint256 proposalId) view returns (address vaultUsdc,address vaultToken,address passAmm,address failAmm)",
  "function activate(uint256 proposalId)",
  "function finalize(uint256 proposalId)",
  "function execute(uint256 proposalId)",
  "function markExecutionFailed(uint256 proposalId)",
]);
const ammAbi = parseAbi([
  "function crank()",
  "function minUpdateInterval() view returns (uint32)",
  "function lastUpdateTime() view returns (uint64)",
]);
const forecastAbi = parseAbi([
  "function forecastersOf(address governor,uint256 proposalId) view returns (uint256[])",
  "function revealWindow() view returns (uint64)",
]);
const reporterAbi = parseAbi(["function report(address governor,uint256 proposalId,uint256 agentId) returns (uint256)"]);

type TrackedProject = { id: bigint; raise?: Address; governor?: Address; spotAmm?: Address; performancePackage?: Address };
const projects = new Map<string, TrackedProject>();
const lastAttempt = new Map<string, number>();
let cursor = startBlock;
let ticking = false;
let nextNonce: number | undefined;
let lastTick: { at: string; block: string | null; mode: string; jobs: Array<{ name: string; tx?: string }> } = {
  at: new Date().toISOString(), block: null, mode: "unconfigured", jobs: [],
};

function encode(abi: Abi, functionName: string, args: readonly unknown[] = []): Hex {
  return encodeFunctionData({ abi, functionName: functionName as never, args: args as never });
}

async function sendIfReady(to: Address, data: Hex, name: string, key = name): Promise<boolean> {
  if (!walletClient || !account) return false;
  const previousAttempt = lastAttempt.get(key) ?? 0;
  if (Date.now() - previousAttempt < 30_000) return false;
  lastAttempt.set(key, Date.now());
  try {
    await publicClient.call({ account: account.address, to, data });
    const estimate = await publicClient.estimateGas({ account: account.address, to, data });
    const gas = estimate + estimate / 5n;
    const gasCap = BigInt(process.env.KEEPER_GAS_CAP ?? "2000000");
    if (gas > gasCap) return false;
    if (nextNonce === undefined) nextNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
    const hash = await walletClient.sendTransaction({ account, to, data, gas, nonce: nextNonce });
    nextNonce += 1;
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") throw new Error(`Fuji transaction reverted: ${hash}`);
    lastTick.jobs.push({ name, tx: hash });
    console.log(JSON.stringify({ level: "info", event: "keeper.tx", job: name, tx: hash }));
    return true;
  } catch (error) {
    const message = error instanceof Error ? (error as Error & { shortMessage?: string }).shortMessage ?? error.message : "transaction preflight or send failed";
    console.log(JSON.stringify({ level: "debug", event: "keeper.skip", job: name, reason: message.slice(0, 180) }));
    return false;
  }
}

async function syncFactoryLogs(toBlock: bigint) {
  if (!factoryAddress || cursor > toBlock) return;
  const endBlock = cursor + 1_999n < toBlock ? cursor + 1_999n : toBlock;
  const [created, live] = await Promise.all([
    publicClient.getLogs({ address: factoryAddress, event: projectCreated, fromBlock: cursor, toBlock: endBlock }),
    publicClient.getLogs({ address: factoryAddress, event: projectLive, fromBlock: cursor, toBlock: endBlock }),
  ]);
  for (const log of created) {
    const { projectId, raise } = log.args;
    if (projectId !== undefined && raise) projects.set(projectId.toString(), { id: projectId, raise });
  }
  for (const log of live) {
    const { projectId, governor, spotAmm, performancePackage } = log.args;
    if (projectId === undefined || !governor || !spotAmm || !performancePackage) continue;
    const project = projects.get(projectId.toString()) ?? { id: projectId };
    project.governor = governor; project.spotAmm = spotAmm; project.performancePackage = performancePackage;
    projects.set(projectId.toString(), project);
  }
  cursor = endBlock + 1n;
}

async function attemptRaiseFinalization(project: TrackedProject, now: bigint) {
  if (!project.raise) return;
  try {
    const state = await publicClient.readContract({ address: project.raise, abi: raiseAbi, functionName: "state" });
    if (state !== 0 && state !== 1) return;
    const cfg = await publicClient.readContract({ address: project.raise, abi: raiseAbi, functionName: "cfg" });
    if (now >= cfg[4]) await sendIfReady(project.raise, encode(raiseAbi, "finalize"), `finalize raise ${project.id}`);
  } catch (error) {
    console.log(JSON.stringify({ level: "warn", event: "keeper.read-failed", address: project.raise, reason: error instanceof Error ? error.message.slice(0, 140) : "read failed" }));
  }
}

async function attemptAmmCrank(address: Address, now: bigint) {
  try {
    const [last, interval] = await Promise.all([
      publicClient.readContract({ address, abi: ammAbi, functionName: "lastUpdateTime" }),
      publicClient.readContract({ address, abi: ammAbi, functionName: "minUpdateInterval" }),
    ]);
    if (now >= BigInt(last) + BigInt(interval)) await sendIfReady(address, encode(ammAbi, "crank"), `crank ${address}`, `crank:${address}`);
  } catch { /* Uninitialized pools are ignored until the Governor creates their market. */ }
}

async function attemptGovernorJobs(project: TrackedProject, now: bigint) {
  if (!project.governor) return;
  try {
    const governor = project.governor;
    const [activeId, proposalCount, params] = await Promise.all([
      publicClient.readContract({ address: governor, abi: governorAbi, functionName: "activeProposalId" }),
      publicClient.readContract({ address: governor, abi: governorAbi, functionName: "proposalCount" }),
      publicClient.readContract({ address: governor, abi: governorAbi, functionName: "params" }),
    ]);
    if (project.spotAmm) await attemptAmmCrank(project.spotAmm, now);
    if (activeId > 0n) {
      const [window, market] = await Promise.all([
        publicClient.readContract({ address: governor, abi: governorAbi, functionName: "forecastWindow", args: [activeId] }),
        publicClient.readContract({ address: governor, abi: governorAbi, functionName: "getMarket", args: [activeId] }),
      ]);
      const [state, createdAt,, tradingEnd] = window;
      const [,, passAmm, failAmm] = market;
      if (passAmm) await attemptAmmCrank(passAmm, now);
      if (failAmm) await attemptAmmCrank(failAmm, now);
      if (state === 1 && now >= BigInt(createdAt) + BigInt(params[0])) await sendIfReady(governor, encode(governorAbi, "activate", [activeId]), `activate proposal ${activeId}`);
      if (state === 2 && now >= BigInt(tradingEnd)) await sendIfReady(governor, encode(governorAbi, "finalize", [activeId]), `finalize proposal ${activeId}`);
    }

    const first = proposalCount > 20n ? proposalCount - 19n : 1n;
    for (let id = first; id <= proposalCount; id += 1n) {
      const proposal = await publicClient.readContract({ address: governor, abi: governorAbi, functionName: "proposals", args: [id] });
      const state = proposal[3];
      const executionDeadline = proposal[8];
      if (state === 4) {
        if (now <= BigInt(executionDeadline)) await sendIfReady(governor, encode(governorAbi, "execute", [id]), `retry execution ${id}`, `execute:${governor}:${id}`);
        else await sendIfReady(governor, encode(governorAbi, "markExecutionFailed", [id]), `expire execution ${id}`, `expire:${governor}:${id}`);
      }
      await attemptReputation(governor, id, proposal[7], state, now);
    }
  } catch (error) {
    console.log(JSON.stringify({ level: "warn", event: "keeper.governor-read-failed", governor: project.governor, reason: error instanceof Error ? error.message.slice(0, 140) : "read failed" }));
  }
}

async function attemptReputation(governor: Address, proposalId: bigint, tradingEnd: bigint, state: number, now: bigint) {
  const registry = process.env.FORECAST_REGISTRY_ADDRESS as Address | undefined;
  const reporter = process.env.REPUTATION_REPORTER_ADDRESS as Address | undefined;
  if (!registry || !reporter || state < 4 || tradingEnd === 0n) return;
  try {
    const revealWindow = await publicClient.readContract({ address: registry, abi: forecastAbi, functionName: "revealWindow" });
    if (now <= BigInt(tradingEnd) + BigInt(revealWindow)) return;
    const agentIds = await publicClient.readContract({ address: registry, abi: forecastAbi, functionName: "forecastersOf", args: [governor, proposalId] });
    for (const agentId of agentIds.slice(0, 50)) {
      const data = encode(reporterAbi, "report", [governor, proposalId, agentId]);
      await sendIfReady(reporter, data, `report forecast ${proposalId}/${agentId}`, `report:${governor}:${proposalId}:${agentId}`);
    }
  } catch { /* Missing, unrevealed, or already scored forecasts are safely skipped. */ }
}

async function tick() {
  if (ticking) return lastTick;
  ticking = true;
  const jobs: Array<{ name: string; tx?: string }> = [];
  lastTick = { at: new Date().toISOString(), block: null, mode: account ? "fuji-connected" : "read-only", jobs };
  try {
    const blockNumber = await publicClient.getBlockNumber();
    lastTick.block = blockNumber.toString();
    const block = await publicClient.getBlock({ blockNumber });
    if (!factoryAddress) { lastTick.mode = "unconfigured · factory address missing"; return lastTick; }
    await syncFactoryLogs(blockNumber);
    if (!account || !walletClient) { lastTick.mode = "read-only · keeper key missing"; return lastTick; }
    const balance = await publicClient.getBalance({ address: account.address });
    const lowGasThreshold = BigInt(process.env.KEEPER_MIN_AVAX_WEI ?? "50000000000000000");
    if (balance < lowGasThreshold) { lastTick.mode = "paused · keeper AVAX balance is low"; return lastTick; }
    const now = block.timestamp;
    for (const project of projects.values()) {
      await attemptRaiseFinalization(project, now);
      await attemptGovernorJobs(project, now);
    }
    lastTick.mode = "fuji-connected";
  } catch (error) {
    lastTick.mode = "rpc-error";
    console.error(JSON.stringify({ level: "error", event: "keeper.tick", message: error instanceof Error ? error.message : "RPC request failed" }));
  } finally {
    ticking = false;
    lastTick.at = new Date().toISOString();
  }
  return lastTick;
}

app.get("/health", (c) => c.json({ ok: lastTick.mode !== "rpc-error", service: "futara-keeper", ...lastTick, trackedProjects: projects.size, scannedThroughBlock: cursor > 0n ? (cursor - 1n).toString() : null }));
app.post("/tick", async (c) => {
  const secret = process.env.KEEPER_TICK_SECRET;
  if (!secret || c.req.header("Authorization") !== `Bearer ${secret}`) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ accepted: true, ...(await tick()) });
});
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8790) }, () => console.log(JSON.stringify({ level: "info", service: "futara-keeper", intervalMs, mode: account ? "fuji-connected" : "read-only" })));
void tick();
setInterval(() => { void tick(); }, intervalMs);
