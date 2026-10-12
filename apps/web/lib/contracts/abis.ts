/**
 * ABI constants for Futara protocol contracts.
 *
 * These are extracted from the Solidity source in packages/contracts/src/.
 * If the contracts change, regenerate from `forge build` artifacts in
 * packages/contracts/out/ and update the corresponding arrays below.
 */
import { parseAbi } from "viem";

/* -------------------------------------------------------------------------- */
/*  FutaraFactory                                                              */
/* -------------------------------------------------------------------------- */

export const futaraFactoryAbi = parseAbi([
  // Write
  "function createProject((string name, string symbol, uint256 totalSupply, (uint16 saleBps, uint16 liquidityBps, uint16 treasuryBps, uint16 founderBps) allocation) tokenCfg, (uint256 minRaise, uint256 hardCap, uint256 minContribution, uint64 startTime, uint64 endTime, uint16 liquidityUsdcBps, uint16 liquidityPremiumBps) raiseCfg, (uint32 warmup, uint32 tradingPeriod, uint32 twapStartDelay, uint32 executionWindow, uint32 minUpdateInterval, uint16 maxObsChangeBps, uint16 thresholdBps, uint16 ammFeeBps, uint256 proposalBond, uint256 minLiquidityUsdc) params, (address operator, uint256 monthlyBudget, uint32 budgetPeriod) budget, (address beneficiary, uint32 cliff, uint32 twapWindow, uint16[] milestoneMultipliersX100, uint16[] unlockBps) founderCfg, string metadataURI, bytes32 metadataHash) external returns (uint256 projectId)",
  // Read
  "function getProject(uint256 projectId) external view returns ((address founder, address raise, address token, address treasury, address governor, address spotAmm, address performancePackage, string metadataURI, bytes32 metadataHash, (string name, string symbol, uint256 totalSupply, (uint16 saleBps, uint16 liquidityBps, uint16 treasuryBps, uint16 founderBps) allocation) tokenCfg, (uint256 minRaise, uint256 hardCap, uint256 minContribution, uint64 startTime, uint64 endTime, uint16 liquidityUsdcBps, uint16 liquidityPremiumBps) raiseCfg, (uint32 warmup, uint32 tradingPeriod, uint32 twapStartDelay, uint32 executionWindow, uint32 minUpdateInterval, uint16 maxObsChangeBps, uint16 thresholdBps, uint16 ammFeeBps, uint256 proposalBond, uint256 minLiquidityUsdc) params, (address operator, uint256 monthlyBudget, uint32 budgetPeriod) budget, (address beneficiary, uint32 cliff, uint32 twapWindow, uint16[] milestoneMultipliersX100, uint16[] unlockBps) founderCfg))",
  "function projectCount() external view returns (uint256)",
  "function usdc() external view returns (address)",
  "function forecastRegistry() external view returns (address)",
  "function projectIdOf(address) external view returns (uint256)",
  // Events
  "event ProjectCreated(uint256 indexed projectId, address indexed founder, address raise, string metadataURI)",
  "event ProjectLive(uint256 indexed projectId, address token, address treasury, address governor, address spotAmm, address performancePackage)",
]);

/* -------------------------------------------------------------------------- */
/*  Raise                                                                      */
/* -------------------------------------------------------------------------- */

export const raiseAbi = parseAbi([
  // Write
  "function contribute(uint256 amount) external",
  "function contributeWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
  "function claim() external",
  "function refund() external",
  "function finalize() external",
  "function sweepDust() external",
  // Read
  "function previewClaim(address user) external view returns (uint256 tokens, uint256 refundUsdc)",
  "function totalContributed() external view returns (uint256)",
  "function acceptedTotal() external view returns (uint256)",
  "function contributed(address user) external view returns (uint256)",
  "function claimed(address user) external view returns (bool)",
  "function state() external view returns (uint8)",
  "function token() external view returns (address)",
  "function treasury() external view returns (address)",
  "function claimDeadline() external view returns (uint64)",
  "function contributorCount() external view returns (uint256)",
  "function projectId() external view returns (uint256)",
  // Events
  "event Contributed(address indexed user, uint256 amount, uint256 totalContributed)",
  "event RaiseFailed(uint256 totalContributed)",
  "event RaiseFinalized(uint256 acceptedTotal, uint256 priceE18, address token)",
  "event Claimed(address indexed user, uint256 tokens, uint256 refundUsdc)",
  "event Refunded(address indexed user, uint256 amount)",
]);

/* -------------------------------------------------------------------------- */
/*  FutarchyGovernor                                                           */
/* -------------------------------------------------------------------------- */

export const governorAbi = parseAbi([
  // Write
  "function propose((address target, uint256 value, bytes data)[] actions, string uri, bytes32 hash, uint256 liqUsdc, uint256 maxLiqToken) external returns (uint256 id)",
  "function activate(uint256 id) external",
  "function finalize(uint256 id) external",
  "function execute(uint256 id) external",
  "function cancel(uint256 id) external",
  // Read
  "function proposals(uint256 id) external view returns (address proposer, string descriptionURI, bytes32 descriptionHash, bytes32 actionsHash, uint8 state, uint8 outcome, uint64 createdAt, uint64 tradingStart, uint64 tradingEnd, uint64 executionDeadline, uint256 bond, address vaultUsdc, address vaultToken, address passAmm, address failAmm, uint256 seedPriceE18, uint256 twapPassE18, uint256 twapFailE18)",
  "function getMarket(uint256 id) external view returns (address vaultUsdc, address vaultToken, address passAmm, address failAmm)",
  "function forecastWindow(uint256 id) external view returns (uint8 proposalState, uint64 createdAt, uint64 tradingStart, uint64 tradingEnd)",
  "function activeProposalId() external view returns (uint256)",
  "function proposalCount() external view returns (uint256)",
  "function getActions(uint256 id) external view returns ((address target, uint256 value, bytes data)[])",
  "function params() external view returns (uint32 warmup, uint32 tradingPeriod, uint32 twapStartDelay, uint32 executionWindow, uint32 minUpdateInterval, uint16 maxObsChangeBps, uint16 thresholdBps, uint16 ammFeeBps, uint256 proposalBond, uint256 minLiquidityUsdc)",
  "function usdc() external view returns (address)",
  "function token() external view returns (address)",
  "function spotAmm() external view returns (address)",
  // Events
  "event ProposalCreated(uint256 indexed id, address indexed proposer, string uri, bytes32 descriptionHash, address vaultUsdc, address vaultToken, address passAmm, address failAmm, uint256 seedPriceE18)",
  "event ProposalActivated(uint256 indexed id, uint64 tradingStart, uint64 tradingEnd)",
  "event ProposalFinalized(uint256 indexed id, uint8 outcome, uint256 twapPass, uint256 twapFail)",
  "event ProposalExecuted(uint256 indexed id)",
  "event ProposalCancelled(uint256 indexed id)",
]);

/* -------------------------------------------------------------------------- */
/*  DecisionAMM                                                                */
/* -------------------------------------------------------------------------- */

export const decisionAmmAbi = parseAbi([
  // Write
  "function swapExactQuoteForBase(uint256 quoteIn, uint256 minBaseOut, address to, uint64 deadline) external returns (uint256 amountOut)",
  "function swapExactBaseForQuote(uint256 baseIn, uint256 minQuoteOut, address to, uint64 deadline) external returns (uint256 amountOut)",
  "function addLiquidity(uint256 baseAmt, uint256 quoteAmt, uint256 minShares, address to) external returns (uint256 minted)",
  "function removeLiquidity(uint256 shareAmount, uint256 minBase, uint256 minQuote, address to) external returns (uint256 baseOut, uint256 quoteOut)",
  "function crank() external",
  // Read
  "function getAmountOut(bool quoteToBase, uint256 amountIn) external view returns (uint256)",
  "function spotPriceE18() external view returns (uint256)",
  "function reserveBase() external view returns (uint256)",
  "function reserveQuote() external view returns (uint256)",
  "function consult(uint32 secondsAgo) external view returns (uint256)",
  "function totalShares() external view returns (uint256)",
  "function shares(address) external view returns (uint256)",
  "function closed() external view returns (bool)",
  "function twapEnabled() external view returns (bool)",
  "function tradingEnd() external view returns (uint64)",
  "function feeBps() external view returns (uint16)",
  "function lpLocked() external view returns (bool)",
  // Events
  "event Swap(address indexed sender, address indexed to, bool quoteToBase, uint256 amountIn, uint256 amountOut, uint256 reserveBase, uint256 reserveQuote)",
  "event LiquidityAdded(address indexed provider, uint256 baseAmt, uint256 quoteAmt, uint256 shares)",
  "event LiquidityRemoved(address indexed provider, uint256 baseAmt, uint256 quoteAmt, uint256 shares)",
]);

/* -------------------------------------------------------------------------- */
/*  ConditionalVault                                                           */
/* -------------------------------------------------------------------------- */

export const conditionalVaultAbi = parseAbi([
  // Write
  "function split(uint256 amount, address to) external",
  "function merge(uint256 amount, address to) external",
  "function redeem(address to) external returns (uint256 amount)",
  "function redeemToSelf() external returns (uint256 amount)",
  // Read
  "function passToken() external view returns (address)",
  "function failToken() external view returns (address)",
  "function outcome() external view returns (uint8)",
  "function underlying() external view returns (address)",
  "function proposalId() external view returns (uint256)",
  // Events
  "event Split(address indexed user, uint256 amount)",
  "event Merged(address indexed user, uint256 amount)",
  "event Resolved(uint8 outcome)",
  "event Redeemed(address indexed user, uint256 amount)",
]);

/* -------------------------------------------------------------------------- */
/*  Treasury                                                                   */
/* -------------------------------------------------------------------------- */

export const treasuryAbi = parseAbi([
  // Write (caller-restricted)
  "function claimBudget(uint256 amount, address to) external",
  // Read
  "function monthlyBudget() external view returns (uint256)",
  "function claimedThisPeriod() external view returns (uint256)",
  "function operator() external view returns (address)",
  "function currentPeriodStart() external view returns (uint64)",
  "function budgetPeriod() external view returns (uint32)",
  "function usdc() external view returns (address)",
  "function token() external view returns (address)",
  "function governor() external view returns (address)",
  "function projectId() external view returns (uint256)",
  // Events
  "event Executed(uint256 indexed proposalId, uint256 actionCount)",
  "event BudgetClaimed(address indexed to, uint256 amount, uint64 periodStart)",
  "event BudgetChanged(uint256 amount)",
  "event OperatorChanged(address indexed operator)",
]);

/* -------------------------------------------------------------------------- */
/*  ERC-20 (minimal — USDC & ProjectToken)                                    */
/* -------------------------------------------------------------------------- */

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
