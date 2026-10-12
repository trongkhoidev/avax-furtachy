import { createConfig, factory } from "ponder";
import { http, parseAbi, parseAbiItem } from "viem";
import { avalancheFuji } from "viem/chains";

const address = (process.env.FACTORY_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const startBlock = Number(process.env.START_BLOCK ?? 0);
const projectCreated = parseAbiItem("event ProjectCreated(uint256 indexed projectId,address indexed founder,address raise,string metadataURI)");
const projectLive = parseAbiItem("event ProjectLive(uint256 indexed projectId,address token,address treasury,address governor,address spotAmm,address performancePackage)");
const proposalMarketsCreated = parseAbiItem("event ProposalMarketsCreated(uint256 indexed projectId,uint256 indexed proposalId,address indexed governor,address vaultUsdc,address vaultToken,address passAmm,address failAmm)");
const proposalCreated = parseAbiItem("event ProposalCreated(uint256 indexed id,address indexed proposer,string uri,bytes32 descriptionHash,address vaultUsdc,address vaultToken,address passAmm,address failAmm,uint256 seedPriceE18)");

const contracts = {
  FutaraFactory: {
    network: "fuji" as const,
    abi: [projectCreated, projectLive, proposalMarketsCreated],
    address,
    startBlock,
  },
  Raise: {
    network: "fuji" as const,
    abi: parseAbi([
      "event Contributed(address indexed user,uint256 amount,uint256 totalContributed)",
      "event RaiseFailed(uint256 totalContributed)",
      "event RaiseFinalized(uint256 acceptedTotal,uint256 priceE18,address token)",
      "event Claimed(address indexed user,uint256 tokens,uint256 refundUsdc)",
      "event Refunded(address indexed user,uint256 amount)",
      "event DustSwept(address indexed treasury,uint256 tokenAmount,uint256 usdcAmount)",
    ]),
    address: factory({ address, event: projectCreated, parameter: "raise" }),
    startBlock,
  },
  Treasury: {
    network: "fuji" as const,
    abi: parseAbi([
      "event Executed(uint256 indexed proposalId,uint256 actionCount)",
      "event BudgetClaimed(address indexed to,uint256 amount,uint64 periodStart)",
      "event BudgetChanged(uint256 amount)",
      "event OperatorChanged(address indexed operator)",
    ]),
    address: factory({ address, event: projectLive, parameter: "treasury" }),
    startBlock,
  },
  FutarchyGovernor: {
    network: "fuji" as const,
    abi: [
      proposalCreated,
      parseAbiItem("event ProposalActivated(uint256 indexed id,uint64 tradingStart,uint64 tradingEnd)"),
      parseAbiItem("event ProposalFinalized(uint256 indexed id,uint8 outcome,uint256 twapPass,uint256 twapFail)"),
      parseAbiItem("event ProposalExecuted(uint256 indexed id)"),
      parseAbiItem("event ProposalExecutionFailed(uint256 indexed id,bytes reason)"),
      parseAbiItem("event ProposalCancelled(uint256 indexed id)"),
    ],
    address: factory({ address, event: projectLive, parameter: "governor" }),
    startBlock,
  },
  SpotAMM: {
    network: "fuji" as const,
    abi: parseAbi([
      "event Swap(address indexed sender,address indexed to,bool quoteToBase,uint256 amountIn,uint256 amountOut,uint256 reserveBase,uint256 reserveQuote)",
      "event LiquidityAdded(address indexed provider,uint256 baseAmt,uint256 quoteAmt,uint256 shares)",
      "event LiquidityRemoved(address indexed provider,uint256 baseAmt,uint256 quoteAmt,uint256 shares)",
      "event TwapUpdated(uint256 observation,uint256 spot,uint64 time)",
      "event ClosedPool()",
    ]),
    address: factory({ address, event: projectLive, parameter: "spotAmm" }),
    startBlock,
  },
  ForecastRegistry: {
    network: "fuji" as const,
    abi: parseAbi([
      "event ForecastCommitted(address indexed governor,uint256 indexed proposalId,uint256 indexed agentId,bytes32 hash)",
      "event ForecastRevealed(address indexed governor,uint256 indexed proposalId,uint256 indexed agentId,uint16 pPassBps)",
    ]),
    address: (process.env.FORECAST_REGISTRY_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    startBlock,
  },
  ReputationReporter: {
    network: "fuji" as const,
    abi: parseAbi(["event ForecastScored(address indexed governor,uint256 indexed proposalId,uint256 indexed agentId,uint16 pPassBps,uint8 outcome,uint256 score)"]),
    address: (process.env.REPUTATION_REPORTER_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    startBlock,
  },
  PassAMM: {
    network: "fuji" as const,
    abi: parseAbi([
      "event Swap(address indexed sender,address indexed to,bool quoteToBase,uint256 amountIn,uint256 amountOut,uint256 reserveBase,uint256 reserveQuote)",
      "event LiquidityAdded(address indexed provider,uint256 baseAmt,uint256 quoteAmt,uint256 shares)",
      "event LiquidityRemoved(address indexed provider,uint256 baseAmt,uint256 quoteAmt,uint256 shares)",
      "event TwapUpdated(uint256 observation,uint256 spot,uint64 time)",
      "event ClosedPool()",
    ]),
    address: factory({ address, event: proposalMarketsCreated, parameter: "passAmm" }),
    startBlock,
  },
  FailAMM: {
    network: "fuji" as const,
    abi: parseAbi([
      "event Swap(address indexed sender,address indexed to,bool quoteToBase,uint256 amountIn,uint256 amountOut,uint256 reserveBase,uint256 reserveQuote)",
      "event LiquidityAdded(address indexed provider,uint256 baseAmt,uint256 quoteAmt,uint256 shares)",
      "event LiquidityRemoved(address indexed provider,uint256 baseAmt,uint256 quoteAmt,uint256 shares)",
      "event TwapUpdated(uint256 observation,uint256 spot,uint64 time)",
      "event ClosedPool()",
    ]),
    address: factory({ address, event: proposalMarketsCreated, parameter: "failAmm" }),
    startBlock,
  },
  UsdcVault: {
    network: "fuji" as const,
    abi: parseAbi([
      "event Split(address indexed user,uint256 amount)",
      "event Merged(address indexed user,uint256 amount)",
      "event Resolved(uint8 outcome)",
      "event Redeemed(address indexed user,uint256 amount)",
    ]),
    address: factory({ address, event: proposalMarketsCreated, parameter: "vaultUsdc" }),
    startBlock,
  },
  TokenVault: {
    network: "fuji" as const,
    abi: parseAbi([
      "event Split(address indexed user,uint256 amount)",
      "event Merged(address indexed user,uint256 amount)",
      "event Resolved(uint8 outcome)",
      "event Redeemed(address indexed user,uint256 amount)",
    ]),
    address: factory({ address, event: proposalMarketsCreated, parameter: "vaultToken" }),
    startBlock,
  },
};

export default createConfig({
  database: { kind: "postgres", connectionString: process.env.DATABASE_URL ?? "postgres://futara:futara@localhost:5432/futara" },
  networks: { fuji: { chainId: avalancheFuji.id, transport: http(process.env.RPC_URL_FUJI ?? "https://api.avax-test.network/ext/bc/C/rpc") } },
  contracts,
});
