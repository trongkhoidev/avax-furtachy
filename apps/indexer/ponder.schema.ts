import { onchainTable } from "ponder";

export const project = onchainTable("project", (p) => ({
  id: p.bigint().primaryKey(),
  founder: p.hex().notNull(),
  raise: p.hex().notNull(),
  token: p.hex(),
  treasury: p.hex(),
  governor: p.hex(),
  spotAmm: p.hex(),
  performancePackage: p.hex(),
  name: p.text(),
  symbol: p.text(),
  state: p.text().notNull(),
  minRaise: p.bigint(),
  hardCap: p.bigint(),
  totalContributed: p.bigint().notNull(),
  acceptedTotal: p.bigint().notNull(),
  metadataURI: p.text().notNull(),
  metadataHash: p.hex(),
  createdAt: p.bigint().notNull(),
}));

export const raise = onchainTable("raise", (p) => ({
  address: p.hex().primaryKey(),
  projectId: p.bigint().notNull(),
  totalContributed: p.bigint().notNull(),
  acceptedTotal: p.bigint(),
  priceE18: p.bigint(),
  token: p.hex(),
  state: p.text().notNull(),
}));

export const contribution = onchainTable("contribution", (p) => ({
  id: p.text().primaryKey(),
  raise: p.hex().notNull(),
  projectId: p.bigint().notNull(),
  user: p.hex().notNull(),
  amount: p.bigint().notNull(),
  totalContributed: p.bigint().notNull(),
  txHash: p.hex().notNull(),
  blockTime: p.bigint().notNull(),
}));

export const claim = onchainTable("claim", (p) => ({
  id: p.text().primaryKey(),
  raise: p.hex().notNull(),
  projectId: p.bigint().notNull(),
  user: p.hex().notNull(),
  tokens: p.bigint().notNull(),
  refund: p.bigint().notNull(),
  txHash: p.hex().notNull(),
  blockTime: p.bigint().notNull(),
}));

export const governorProject = onchainTable("governor_project", (p) => ({
  governor: p.hex().primaryKey(),
  projectId: p.bigint().notNull(),
}));

export const proposal = onchainTable("proposal", (p) => ({
  id: p.text().primaryKey(),
  projectId: p.bigint().notNull(),
  proposalId: p.bigint().notNull(),
  governor: p.hex().notNull(),
  proposer: p.hex().notNull(),
  descriptionURI: p.text().notNull(),
  descriptionHash: p.hex().notNull(),
  title: p.text(),
  state: p.text().notNull(),
  outcome: p.text(),
  createdAt: p.bigint().notNull(),
  tradingStart: p.bigint(),
  tradingEnd: p.bigint(),
  executionDeadline: p.bigint(),
  vaultUsdc: p.hex().notNull(),
  vaultToken: p.hex().notNull(),
  passAmm: p.hex().notNull(),
  failAmm: p.hex().notNull(),
  seedPriceE18: p.bigint().notNull(),
  twapPassE18: p.bigint(),
  twapFailE18: p.bigint(),
  executionError: p.text(),
}));

export const marketAddress = onchainTable("market_address", (p) => ({
  address: p.hex().primaryKey(),
  projectId: p.bigint().notNull(),
  proposalId: p.text(),
  kind: p.text().notNull(),
}));

export const swap = onchainTable("swap", (p) => ({
  id: p.text().primaryKey(),
  amm: p.hex().notNull(),
  projectId: p.bigint(),
  proposalId: p.text(),
  poolKind: p.text().notNull(),
  sender: p.hex().notNull(),
  to: p.hex().notNull(),
  quoteToBase: p.boolean().notNull(),
  amountIn: p.bigint().notNull(),
  amountOut: p.bigint().notNull(),
  reserveBase: p.bigint().notNull(),
  reserveQuote: p.bigint().notNull(),
  priceE18: p.bigint(),
  txHash: p.hex().notNull(),
  blockTime: p.bigint().notNull(),
}));

export const twapPoint = onchainTable("twap_point", (p) => ({
  id: p.text().primaryKey(),
  amm: p.hex().notNull(),
  projectId: p.bigint(),
  proposalId: p.text(),
  poolKind: p.text().notNull(),
  observationE18: p.bigint().notNull(),
  spotE18: p.bigint().notNull(),
  time: p.bigint().notNull(),
  txHash: p.hex().notNull(),
}));

export const liquidityEvent = onchainTable("liquidity_event", (p) => ({
  id: p.text().primaryKey(),
  amm: p.hex().notNull(),
  projectId: p.bigint(),
  proposalId: p.text(),
  poolKind: p.text().notNull(),
  provider: p.hex().notNull(),
  baseAmount: p.bigint().notNull(),
  quoteAmount: p.bigint().notNull(),
  shares: p.bigint().notNull(),
  kind: p.text().notNull(),
  blockTime: p.bigint().notNull(),
  txHash: p.hex().notNull(),
}));

export const vaultEvent = onchainTable("vault_event", (p) => ({
  id: p.text().primaryKey(),
  vault: p.hex().notNull(),
  projectId: p.bigint().notNull(),
  proposalId: p.text().notNull(),
  user: p.hex(),
  kind: p.text().notNull(),
  amount: p.bigint(),
  outcome: p.text(),
  blockTime: p.bigint().notNull(),
  txHash: p.hex().notNull(),
}));

export const budgetClaim = onchainTable("budget_claim", (p) => ({
  id: p.text().primaryKey(),
  treasury: p.hex().notNull(),
  projectId: p.bigint(),
  to: p.hex().notNull(),
  amount: p.bigint().notNull(),
  periodStart: p.bigint().notNull(),
  blockTime: p.bigint().notNull(),
  txHash: p.hex().notNull(),
}));

export const forecast = onchainTable("forecast", (p) => ({
  id: p.text().primaryKey(),
  governor: p.hex().notNull(),
  proposalId: p.bigint().notNull(),
  agentId: p.bigint().notNull(),
  commitHash: p.hex().notNull(),
  committedAt: p.bigint().notNull(),
  pPassBps: p.bigint(),
  revealedAt: p.bigint(),
}));

export const forecastScore = onchainTable("forecast_score", (p) => ({
  id: p.text().primaryKey(),
  governor: p.hex().notNull(),
  proposalId: p.bigint().notNull(),
  agentId: p.bigint().notNull(),
  pPassBps: p.bigint().notNull(),
  outcome: p.text().notNull(),
  score: p.bigint().notNull(),
  txHash: p.hex().notNull(),
  blockTime: p.bigint().notNull(),
}));
