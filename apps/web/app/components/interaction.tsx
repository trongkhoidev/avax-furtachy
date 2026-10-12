export function AmountField({ label = "Amount", symbol = "USDC", value, onChange, balance, onMax }: { label?: string; symbol?: string; value: string; onChange: (value: string) => void; balance?: string; onMax?: () => void }) {
  const id = `amount-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <div className="field"><label htmlFor={id}>{label}</label><div className="amount-control"><input id={id} type="number" min="0" step="any" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0.00" /><span>{symbol}</span>{onMax && <button type="button" onClick={onMax}>Max</button>}</div>{balance && <div className="field-meta"><span>Balance</span><span>{balance}</span></div>}</div>;
}
