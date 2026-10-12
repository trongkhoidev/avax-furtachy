import { ponder } from "ponder:registry";
import {
  budgetClaim,
  claim,
  contribution,
  forecast,
  forecastScore,
  governorProject,
  liquidityEvent,
  marketAddress,
  project,
  proposal,
  raise,
  swap,
  twapPoint,
  vaultEvent,
} from "ponder:schema";

const eventId = (event: any) => `${event.transaction.hash}-${event.log.logIndex}`;
const proposalKey = (governor: string, id: bigint | number) => `${governor.toLowerCase()}-${id}`;
const forecastKey = (governor: string, proposalId: bigint | number, agentId: bigint | number) => `${governor.toLowerCase()}-${proposalId}-${agentId}`;

ponder.on("FutaraFactory:ProjectCreated", async ({ event, context }) => {
  const projectId = event.args.projectId;
  await context.db.insert(project).values({
    id: projectId,
    founder: event.args.founder,
    raise: event.args.raise,
    name: null,
    symbol: null,
    state: "Raising",
    minRaise: null,
    hardCap: null,
    totalContributed: 0n,
    acceptedTotal: 0n,
    metadataURI: event.args.metadataURI,
    metadataHash: null,
    createdAt: BigInt(event.block.timestamp),
  }).onConflictDoNothing();
  await context.db.insert(raise).values({ address: event.args.raise, projectId, totalContributed: 0n, acceptedTotal: null, priceE18: null, token: null, state: "Pending" }).onConflictDoNothing();
});

ponder.on("FutaraFactory:ProjectLive", async ({ event, context }) => {
  const { projectId, token, treasury, governor, spotAmm, performancePackage } = event.args;
  await context.db.update(project, { id: projectId }).set({ state: "Live", token, treasury, governor, spotAmm, performancePackage });
  await context.db.insert(governorProject).values({ governor, projectId }).onConflictDoNothing();
  await context.db.insert(marketAddress).values({ address: spotAmm, projectId, proposalId: null, kind: "spot" }).onConflictDoUpdate({ projectId, proposalId: null, kind: "spot" });
  await context.db.insert(marketAddress).values({ address: treasury, projectId, proposalId: null, kind: "treasury" }).onConflictDoUpdate({ projectId, proposalId: null, kind: "treasury" });
});

ponder.on("FutaraFactory:ProposalMarketsCreated", async ({ event, context }) => {
  const { projectId, proposalId, passAmm, failAmm, vaultUsdc, vaultToken } = event.args;
  const id = proposalKey(event.args.governor, proposalId);
  const rows = [
    { address: passAmm, projectId, proposalId: id, kind: "pass" },
    { address: failAmm, projectId, proposalId: id, kind: "fail" },
    { address: vaultUsdc, projectId, proposalId: id, kind: "vault-usdc" },
    { address: vaultToken, projectId, proposalId: id, kind: "vault-token" },
  ];
  await context.db.insert(marketAddress).values(rows).onConflictDoUpdate((row) => ({ projectId: row.projectId, proposalId: row.proposalId, kind: row.kind }));
});

ponder.on("Raise:Contributed", async ({ event, context }) => {
  const address = event.log.address;
  const indexedRaise = await context.db.find(raise, { address });
  if (!indexedRaise) return;
  await context.db.insert(contribution).values({
    id: eventId(event), raise: address, projectId: indexedRaise.projectId, user: event.args.user,
    amount: event.args.amount, totalContributed: event.args.totalContributed,
    txHash: event.transaction.hash, blockTime: BigInt(event.block.timestamp),
  }).onConflictDoNothing();
  await context.db.update(raise, { address }).set({ totalContributed: event.args.totalContributed, state: "Active" });
  await context.db.update(project, { id: indexedRaise.projectId }).set({ totalContributed: event.args.totalContributed });
});

ponder.on("Raise:RaiseFailed", async ({ event, context }) => {
  const indexedRaise = await context.db.find(raise, { address: event.log.address });
  if (!indexedRaise) return;
  await context.db.update(raise, { address: event.log.address }).set({ totalContributed: event.args.totalContributed, state: "Failed" });
  await context.db.update(project, { id: indexedRaise.projectId }).set({ totalContributed: event.args.totalContributed, state: "Failed" });
});

ponder.on("Raise:RaiseFinalized", async ({ event, context }) => {
  const indexedRaise = await context.db.find(raise, { address: event.log.address });
  if (!indexedRaise) return;
  await context.db.update(raise, { address: event.log.address }).set({ acceptedTotal: event.args.acceptedTotal, priceE18: event.args.priceE18, token: event.args.token, state: "Finalized" });
  await context.db.update(project, { id: indexedRaise.projectId }).set({ acceptedTotal: event.args.acceptedTotal, state: "Live" });
});

ponder.on("Raise:Claimed", async ({ event, context }) => {
  const indexedRaise = await context.db.find(raise, { address: event.log.address });
  if (!indexedRaise) return;
  await context.db.insert(claim).values({
    id: eventId(event), raise: event.log.address, projectId: indexedRaise.projectId, user: event.args.user,
    tokens: event.args.tokens, refund: event.args.refundUsdc, txHash: event.transaction.hash, blockTime: BigInt(event.block.timestamp),
  }).onConflictDoNothing();
});

ponder.on("Raise:Refunded", async ({ event, context }) => {
  const indexedRaise = await context.db.find(raise, { address: event.log.address });
  if (!indexedRaise) return;
  await context.db.insert(claim).values({
    id: eventId(event), raise: event.log.address, projectId: indexedRaise.projectId, user: event.args.user,
    tokens: 0n, refund: event.args.amount, txHash: event.transaction.hash, blockTime: BigInt(event.block.timestamp),
  }).onConflictDoNothing();
});

ponder.on("FutarchyGovernor:ProposalCreated", async ({ event, context }) => {
  const linkedProject = await context.db.find(governorProject, { governor: event.log.address });
  if (!linkedProject) return;
  const id = proposalKey(event.log.address, event.args.id);
  await context.db.insert(proposal).values({
    id, projectId: linkedProject.projectId, proposalId: event.args.id, governor: event.log.address,
    proposer: event.args.proposer, descriptionURI: event.args.uri, descriptionHash: event.args.descriptionHash,
    title: null, state: "Pending", outcome: null, createdAt: BigInt(event.block.timestamp),
    tradingStart: null, tradingEnd: null, executionDeadline: null,
    vaultUsdc: event.args.vaultUsdc, vaultToken: event.args.vaultToken,
    passAmm: event.args.passAmm, failAmm: event.args.failAmm, seedPriceE18: event.args.seedPriceE18,
    twapPassE18: null, twapFailE18: null, executionError: null,
  }).onConflictDoNothing();
});

ponder.on("FutarchyGovernor:ProposalActivated", async ({ event, context }) => {
  await context.db.update(proposal, { id: proposalKey(event.log.address, event.args.id) }).set({ state: "Trading", tradingStart: event.args.tradingStart, tradingEnd: event.args.tradingEnd });
});

ponder.on("FutarchyGovernor:ProposalFinalized", async ({ event, context }) => {
  const outcome = Number(event.args.outcome) === 1 ? "Pass" : "Fail";
  await context.db.update(proposal, { id: proposalKey(event.log.address, event.args.id) }).set({ state: outcome === "Pass" ? "Passed" : "Failed", outcome, twapPassE18: event.args.twapPass, twapFailE18: event.args.twapFail });
});

ponder.on("FutarchyGovernor:ProposalExecuted", async ({ event, context }) => {
  await context.db.update(proposal, { id: proposalKey(event.log.address, event.args.id) }).set({ state: "Executed", executionError: null });
});

ponder.on("FutarchyGovernor:ProposalExecutionFailed", async ({ event, context }) => {
  await context.db.update(proposal, { id: proposalKey(event.log.address, event.args.id) }).set({ executionError: event.args.reason });
});

ponder.on("FutarchyGovernor:ProposalCancelled", async ({ event, context }) => {
  await context.db.update(proposal, { id: proposalKey(event.log.address, event.args.id) }).set({ state: "Cancelled" });
});

async function indexSwap(event: any, context: any, poolKind: string) {
  const indexedMarket = await context.db.find(marketAddress, { address: event.log.address });
  const priceE18 = event.args.reserveBase === 0n ? null : event.args.reserveQuote * 10n ** 30n / event.args.reserveBase;
  await context.db.insert(swap).values({
    id: eventId(event), amm: event.log.address, projectId: indexedMarket?.projectId ?? null,
    proposalId: indexedMarket?.proposalId ?? null, poolKind, sender: event.args.sender, to: event.args.to,
    quoteToBase: event.args.quoteToBase, amountIn: event.args.amountIn, amountOut: event.args.amountOut,
    reserveBase: event.args.reserveBase, reserveQuote: event.args.reserveQuote, priceE18,
    txHash: event.transaction.hash, blockTime: BigInt(event.block.timestamp),
  }).onConflictDoNothing();
}

async function indexTwap(event: any, context: any, poolKind: string) {
  const indexedMarket = await context.db.find(marketAddress, { address: event.log.address });
  await context.db.insert(twapPoint).values({
    id: eventId(event), amm: event.log.address, projectId: indexedMarket?.projectId ?? null,
    proposalId: indexedMarket?.proposalId ?? null, poolKind,
    observationE18: event.args.observation, spotE18: event.args.spot, time: BigInt(event.args.time), txHash: event.transaction.hash,
  }).onConflictDoNothing();
}

async function indexLiquidity(event: any, context: any, poolKind: string, kind: string) {
  const indexedMarket = await context.db.find(marketAddress, { address: event.log.address });
  await context.db.insert(liquidityEvent).values({
    id: eventId(event), amm: event.log.address, projectId: indexedMarket?.projectId ?? null,
    proposalId: indexedMarket?.proposalId ?? null, poolKind, provider: event.args.provider,
    baseAmount: event.args.baseAmt, quoteAmount: event.args.quoteAmt, shares: event.args.shares,
    kind, blockTime: BigInt(event.block.timestamp), txHash: event.transaction.hash,
  }).onConflictDoNothing();
}

ponder.on("SpotAMM:Swap", async ({ event, context }) => indexSwap(event, context, "spot"));
ponder.on("PassAMM:Swap", async ({ event, context }) => indexSwap(event, context, "pass"));
ponder.on("FailAMM:Swap", async ({ event, context }) => indexSwap(event, context, "fail"));
ponder.on("SpotAMM:TwapUpdated", async ({ event, context }) => indexTwap(event, context, "spot"));
ponder.on("PassAMM:TwapUpdated", async ({ event, context }) => indexTwap(event, context, "pass"));
ponder.on("FailAMM:TwapUpdated", async ({ event, context }) => indexTwap(event, context, "fail"));
ponder.on("SpotAMM:LiquidityAdded", async ({ event, context }) => indexLiquidity(event, context, "spot", "add"));
ponder.on("SpotAMM:LiquidityRemoved", async ({ event, context }) => indexLiquidity(event, context, "spot", "remove"));
ponder.on("PassAMM:LiquidityAdded", async ({ event, context }) => indexLiquidity(event, context, "pass", "add"));
ponder.on("PassAMM:LiquidityRemoved", async ({ event, context }) => indexLiquidity(event, context, "pass", "remove"));
ponder.on("FailAMM:LiquidityAdded", async ({ event, context }) => indexLiquidity(event, context, "fail", "add"));
ponder.on("FailAMM:LiquidityRemoved", async ({ event, context }) => indexLiquidity(event, context, "fail", "remove"));

async function indexVaultEvent(event: any, context: any, kind: string, user?: string, amount?: bigint, outcome?: number) {
  const market = await context.db.find(marketAddress, { address: event.log.address });
  if (!market?.proposalId) return;
  const outcomeLabel = outcome === undefined ? null : outcome === 1 ? "Pass" : outcome === 2 ? "Fail" : "Unresolved";
  await context.db.insert(vaultEvent).values({
    id: eventId(event), vault: event.log.address, projectId: market.projectId, proposalId: market.proposalId,
    user: user ?? null, kind, amount: amount ?? null, outcome: outcomeLabel,
    blockTime: BigInt(event.block.timestamp), txHash: event.transaction.hash,
  }).onConflictDoNothing();
}

ponder.on("UsdcVault:Split", async ({ event, context }) => indexVaultEvent(event, context, "split", event.args.user, event.args.amount));
ponder.on("UsdcVault:Merged", async ({ event, context }) => indexVaultEvent(event, context, "merge", event.args.user, event.args.amount));
ponder.on("UsdcVault:Redeemed", async ({ event, context }) => indexVaultEvent(event, context, "redeem", event.args.user, event.args.amount));
ponder.on("UsdcVault:Resolved", async ({ event, context }) => indexVaultEvent(event, context, "resolve", undefined, undefined, Number(event.args.outcome)));
ponder.on("TokenVault:Split", async ({ event, context }) => indexVaultEvent(event, context, "split", event.args.user, event.args.amount));
ponder.on("TokenVault:Merged", async ({ event, context }) => indexVaultEvent(event, context, "merge", event.args.user, event.args.amount));
ponder.on("TokenVault:Redeemed", async ({ event, context }) => indexVaultEvent(event, context, "redeem", event.args.user, event.args.amount));
ponder.on("TokenVault:Resolved", async ({ event, context }) => indexVaultEvent(event, context, "resolve", undefined, undefined, Number(event.args.outcome)));

ponder.on("Treasury:BudgetClaimed", async ({ event, context }) => {
  const treasuryAddress = event.log.address;
  const indexedTreasury = await context.db.find(marketAddress, { address: treasuryAddress });
  await context.db.insert(budgetClaim).values({
    id: eventId(event), treasury: treasuryAddress, projectId: indexedTreasury?.projectId ?? null,
    to: event.args.to, amount: event.args.amount, periodStart: BigInt(event.args.periodStart),
    blockTime: BigInt(event.block.timestamp), txHash: event.transaction.hash,
  }).onConflictDoNothing();
});

ponder.on("ForecastRegistry:ForecastCommitted", async ({ event, context }) => {
  const id = forecastKey(event.args.governor, event.args.proposalId, event.args.agentId);
  await context.db.insert(forecast).values({
    id, governor: event.args.governor, proposalId: event.args.proposalId, agentId: event.args.agentId,
    commitHash: event.args.hash, committedAt: BigInt(event.block.timestamp), pPassBps: null, revealedAt: null,
  }).onConflictDoUpdate({ commitHash: event.args.hash, committedAt: BigInt(event.block.timestamp), pPassBps: null, revealedAt: null });
});

ponder.on("ForecastRegistry:ForecastRevealed", async ({ event, context }) => {
  const id = forecastKey(event.args.governor, event.args.proposalId, event.args.agentId);
  await context.db.update(forecast, { id }).set({ pPassBps: BigInt(event.args.pPassBps), revealedAt: BigInt(event.block.timestamp) });
});

ponder.on("ReputationReporter:ForecastScored", async ({ event, context }) => {
  const outcome = Number(event.args.outcome) === 1 ? "Pass" : "Fail";
  await context.db.insert(forecastScore).values({
    id: eventId(event), governor: event.args.governor, proposalId: event.args.proposalId,
    agentId: event.args.agentId, pPassBps: BigInt(event.args.pPassBps), outcome,
    score: event.args.score, txHash: event.transaction.hash, blockTime: BigInt(event.block.timestamp),
  }).onConflictDoNothing();
});
