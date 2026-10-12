import assert from "node:assert/strict";
import test from "node:test";
import {
  amountOutQuoteForBase,
  brierScoreBps,
  calculateAcceptedContribution,
  calculateRaiseClaim,
  canonicalJson,
  decideOutcome,
  forecastScoreBps,
} from "../../../packages/sdk/src/index.ts";
import { evaluateTrade, guardReport } from "../src/risk.js";

test("raise allocation floors oversubscribed contributions without exceeding the cap", () => {
  const cap = 200_000_000_000n;
  const total = 260_000_000_000n;
  const alice = calculateAcceptedContribution(100_000_000_000n, total, cap);
  const bob = calculateAcceptedContribution(160_000_000_000n, total, cap);
  assert.equal(alice, 76_923_076_923n);
  assert.equal(bob, 123_076_923_076n);
  assert.ok(alice + bob <= cap);
  assert.equal(calculateRaiseClaim(100_000_000_000n, total, cap, 5_000_000n * 10n ** 18n, cap).refund, 23_076_923_077n);
});

test("AMM quote applies the fee before constant-product calculation", () => {
  const out = amountOutQuoteForBase(1_000n * 10n ** 18n, 1_000n * 10n ** 6n, 100n * 10n ** 6n);
  assert.ok(out > 90n * 10n ** 18n && out < 91n * 10n ** 18n);
  assert.equal(amountOutQuoteForBase(0n, 100n, 1n), 0n);
});

test("decision rule requires a strict threshold margin", () => {
  assert.equal(decideOutcome(10_300n, 10_000n, 300n), "FAIL");
  assert.equal(decideOutcome(10_301n, 10_000n, 300n), "PASS");
  assert.equal(decideOutcome(0n, 0n, 300n), "FAIL");
});

test("forecast score is the complement of the Brier loss", () => {
  assert.equal(brierScoreBps(7_200n, "PASS"), 784n);
  assert.equal(forecastScoreBps(7_200n, "PASS"), 9_216n);
  assert.equal(forecastScoreBps(0n, "FAIL"), 10_000n);
});

test("canonical metadata serialization ignores object insertion order", () => {
  assert.equal(canonicalJson({ z: 1, a: { y: true, b: null } }), canonicalJson({ a: { b: null, y: true }, z: 1 }));
});

test("risk sizing rejects missing data and respects bankroll and impact caps", () => {
  assert.equal(evaluateTrade({ edge: 0.5, bankrollUsdc: 100, marketLiquidityUsdc: 1_000, maxPositionUsdc: 10 }).sizeUsdc, 10);
  assert.equal(evaluateTrade({ edge: 0.02, bankrollUsdc: 100, marketLiquidityUsdc: 1_000 }).action, "NO_TRADE");
  assert.equal(evaluateTrade({ edge: Number.NaN, bankrollUsdc: 100, marketLiquidityUsdc: 1_000 }).action, "NO_TRADE");
  assert.equal(evaluateTrade({ edge: 0.5, bankrollUsdc: 100, marketLiquidityUsdc: 0 }).action, "NO_TRADE");
});

test("analysis report guard detects treasury concentration and self-payment", () => {
  const result = guardReport(30, 100, "0xABC", "0xabc");
  assert.equal(result.pctOfTreasury, 30);
  assert.deepEqual(result.redFlags, ["The proposer is also the action recipient."]);
  assert.ok(guardReport(51, 100, "0x1", "0x2").redFlags.some((flag) => flag.includes("more than 50%")));
});
