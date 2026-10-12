import { keccak256, toHex } from "viem";

export const FUJI_CHAIN_ID = 43113;
export const FUJI_CAIP2 = "eip155:43113";
export const FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";
export const FUJI_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65" as const;
export const PRICE_PRECISION = 10n ** 18n;
export const BPS = 10_000n;

export type DecisionOutcome = "PASS" | "FAIL";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item)).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

export function metadataHash(value: unknown): `0x${string}` {
  return keccak256(toHex(canonicalJson(value)));
}

export function calculateAcceptedContribution(contribution: bigint, totalContributed: bigint, hardCap: bigint): bigint {
  if (totalContributed <= hardCap) return contribution;
  return contribution * hardCap / totalContributed;
}

export function calculateRaiseClaim(contribution: bigint, totalContributed: bigint, hardCap: bigint, saleTokens: bigint, acceptedTotal: bigint) {
  const accepted = calculateAcceptedContribution(contribution, totalContributed, hardCap);
  const refund = contribution - accepted;
  const tokens = acceptedTotal === 0n ? 0n : accepted * saleTokens / acceptedTotal;
  return { accepted, refund, tokens };
}

export function amountOutQuoteForBase(baseReserve: bigint, quoteReserve: bigint, quoteIn: bigint, feeBps = 30n): bigint {
  if (baseReserve <= 0n || quoteReserve <= 0n || quoteIn <= 0n) return 0n;
  const effective = quoteIn * (BPS - feeBps) / BPS;
  return baseReserve * effective / (quoteReserve + effective);
}

export function amountOutBaseForQuote(baseReserve: bigint, quoteReserve: bigint, baseIn: bigint, feeBps = 30n): bigint {
  if (baseReserve <= 0n || quoteReserve <= 0n || baseIn <= 0n) return 0n;
  const effective = baseIn * (BPS - feeBps) / BPS;
  return quoteReserve * effective / (baseReserve + effective);
}

export function decideOutcome(twapPass: bigint, twapFail: bigint, thresholdBps: bigint): DecisionOutcome {
  return twapPass * BPS > twapFail * (BPS + thresholdBps) ? "PASS" : "FAIL";
}

export function brierScoreBps(pPassBps: bigint, outcome: DecisionOutcome): bigint {
  const realized = outcome === "PASS" ? 10_000n : 0n;
  const difference = pPassBps - realized;
  return difference * difference / 10_000n;
}

export function forecastScoreBps(pPassBps: bigint, outcome: DecisionOutcome): bigint {
  return 10_000n - brierScoreBps(pPassBps, outcome);
}

export function toUsdc(amount: number): bigint { return BigInt(Math.round(amount * 1_000_000)); }
export function fromUsdc(amount: bigint): number { return Number(amount) / 1_000_000; }
