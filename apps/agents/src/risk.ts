export type TradeIdea = { edge: number; bankrollUsdc: number; marketLiquidityUsdc: number; maxPositionUsdc?: number; maxImpactBps?: number; minEdge?: number };
export type TradeDecision = { action: "BUY_PASS" | "SELL_PASS" | "BUY_FAIL" | "SELL_FAIL" | "NO_TRADE"; sizeUsdc: number; edge: number; impactBps: number; reason: string };

export function evaluateTrade({ edge, bankrollUsdc, marketLiquidityUsdc, maxPositionUsdc = bankrollUsdc * .2, maxImpactBps = 300, minEdge = .03 }: TradeIdea): TradeDecision {
  const absEdge = Math.abs(edge);
  if (!Number.isFinite(edge) || !Number.isFinite(bankrollUsdc) || bankrollUsdc <= 0 || !Number.isFinite(marketLiquidityUsdc) || marketLiquidityUsdc <= 0 || !Number.isFinite(maxPositionUsdc) || maxPositionUsdc <= 0 || !Number.isFinite(maxImpactBps) || maxImpactBps <= 0 || !Number.isFinite(minEdge) || minEdge < 0) {
    return { action: "NO_TRADE", sizeUsdc: 0, edge: Number.isFinite(edge) ? edge : 0, impactBps: 0, reason: "Invalid market, bankroll, or risk-limit input." };
  }
  if (absEdge < minEdge) return { action: "NO_TRADE", sizeUsdc: 0, edge, impactBps: 0, reason: "Estimated edge is below the 3% minimum." };
  const sizeUsdc = Math.min(maxPositionUsdc, .25 * bankrollUsdc * absEdge);
  const impactBps = Math.round(sizeUsdc / marketLiquidityUsdc * 10_000);
  if (impactBps > maxImpactBps) return { action: "NO_TRADE", sizeUsdc: 0, edge, impactBps, reason: "Order exceeds the 3% market impact limit." };
  return { action: edge > 0 ? "BUY_PASS" : "BUY_FAIL", sizeUsdc: Math.round(sizeUsdc * 100) / 100, edge, impactBps, reason: "Rule-based sizing passed edge, position, and impact limits." };
}

export function guardReport(usdcOut: number, treasuryUsdc: number, proposer: string, recipient: string) {
  const pctOfTreasury = treasuryUsdc <= 0 ? 100 : 100 * usdcOut / treasuryUsdc;
  const redFlags = [] as string[];
  if (pctOfTreasury > 50) redFlags.push("This action spends more than 50% of available USDC treasury.");
  if (recipient.toLowerCase() === proposer.toLowerCase()) redFlags.push("The proposer is also the action recipient.");
  return { pctOfTreasury, redFlags };
}
