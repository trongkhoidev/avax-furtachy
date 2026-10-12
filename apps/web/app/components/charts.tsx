export function DecisionSplitChart({
  compact = false,
  passValue = 0.071,
  failValue = 0.038,
}: {
  compact?: boolean;
  passValue?: number;
  failValue?: number;
}) {
  const maxValue = 0.1;
  const outcomes = [
    { label: "▲ Pass", value: passValue, note: "If approved", kind: "pass" },
    { label: "▼ Fail", value: failValue, note: "If rejected", kind: "fail" },
  ];

  return <figure className={`outcome-comparison ${compact ? "outcome-comparison-compact" : ""}`} aria-label="Illustrative conditional price comparison; no indexed observations">
    <div className="outcome-comparison-scale"><span>Conditional price · USDC / EDU</span><span>Reference scale · $0.000–$0.100</span></div>
    <div className="outcome-price-rows">
      {outcomes.map(({ label, value, note, kind }) => <div className={`outcome-price-row outcome-${kind}`} key={kind}>
        <div className="outcome-price-label"><strong>{label}</strong><small>{note}</small></div>
        <div className="outcome-price-track" aria-hidden="true"><span style={{ width: `${Math.min(Math.max(value / maxValue, 0), 1) * 100}%` }} /></div>
        <strong className="outcome-price-value">${value.toFixed(3)}</strong>
      </div>)}
    </div>
    <div className="outcome-price-axis" aria-hidden="true"><span>$0.000</span><span>$0.050</span><span>$0.100</span></div>
    {!compact && <figcaption>Static illustrative readings · no indexed observations or final result.</figcaption>}
  </figure>;
}

export function AllocationDonut({ allocation = [50, 15, 20, 15], supply = "10000000", symbol = "EDU" }: { allocation?: number[]; supply?: string; symbol?: string }) {
  const values = allocation.length === 4 ? allocation : [50, 15, 20, 15];
  const cuts = values.reduce<number[]>((result, value) => [...result, (result.at(-1) ?? 0) + value], []);
  const style = { background: `conic-gradient(var(--pass) 0 ${cuts[0]}%, var(--fail) ${cuts[0]}% ${cuts[1]}%, var(--agent) ${cuts[1]}% ${cuts[2]}%, #8aa2af ${cuts[2]}% ${cuts[3]}%)` };
  const spoken = values.map((value, index) => `${["sale", "liquidity", "treasury", "founder"][index]} ${value}%`).join(", ");
  return <div className="allocation-donut" style={style} aria-label={`Allocation: ${spoken}`}><div><strong>{Number(supply || 0).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}</strong><small>{symbol || "TOKEN"} supply</small></div></div>;
}
