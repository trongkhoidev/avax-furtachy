"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import type { LiveProposal } from "@/lib/live-data";

function price(raw: string | null) {
  if (!raw || !/^\d+$/.test(raw)) return "—";
  const value = BigInt(raw);
  const whole = value / 10n ** 18n;
  const fraction = ((value % 10n ** 18n) * 1_000n / 10n ** 18n).toString().padStart(3, "0");
  return `${whole.toString()}.${fraction}`;
}

function stateLabel(state: string) {
  const labels: Record<string, string> = {
    Pending: "Pending",
    Trading: "Trading",
    Passed: "Passed",
    Failed: "Failed",
    Cancelled: "Cancelled",
    Executed: "Executed",
  };
  return labels[state] ?? state;
}

export function MarketBoard({ markets, available }: { markets: LiveProposal[]; available: boolean }) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("All states");
  const visibleMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return markets.filter((market) => {
      const searchText = `${market.title ?? ""} ${market.projectName ?? ""} ${market.projectSymbol ?? ""} ${market.projectId} ${market.id}`.toLowerCase();
      return (!normalizedQuery || searchText.includes(normalizedQuery)) && (stateFilter === "All states" || market.state === stateFilter);
    });
  }, [markets, query, stateFilter]);

  return <section className="exchange-markets" aria-labelledby="exchange-market-title">
    <div className="exchange-section-heading">
      <div><p className="exchange-kicker">FUJI · LIVE INDEX</p><h2 id="exchange-market-title">Decision markets <span>{available ? markets.length : "—"}</span></h2></div>
      <div className="exchange-market-tools">
        <label className="exchange-search"><Search size={15} aria-hidden="true" /><span className="visually-hidden">Search markets</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search proposals" /></label>
        <select aria-label="Filter markets by state" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
          <option>All states</option><option>Trading</option><option>Pending</option><option>Passed</option><option>Failed</option><option>Executed</option>
        </select>
      </div>
    </div>

    {available && visibleMarkets.length > 0 ? <div className="exchange-table-wrap">
      <div className="exchange-table-head"><span>Proposal</span><span>Pass</span><span>Fail</span><span>State</span><span>Project</span><span /></div>
      <div className="exchange-market-list">{visibleMarkets.map((market) => <Link className="exchange-market-row" href={`/proposal/${market.governor}/${market.id}`} key={`${market.governor}-${market.id}`}>
        <span className="exchange-proposal-name"><strong>{market.title?.trim() || `Proposal #${market.id}`}</strong><small>{market.projectName || `Project #${market.projectId}`} · {market.projectSymbol || "FUJI"}</small></span>
        <span className="exchange-outcome exchange-pass"><i />{price(market.passSpotE18)}<small>PASS</small></span>
        <span className="exchange-outcome exchange-fail"><i />{price(market.failSpotE18)}<small>FAIL</small></span>
        <span><b className={`exchange-state state-${market.state.toLowerCase()}`}>{stateLabel(market.state)}</b></span>
        <span className="exchange-project-id">#{market.projectId}</span>
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>)}</div>
    </div> : <div className="exchange-empty">
      <span className="exchange-empty-mark" aria-hidden="true"><i /><i /></span>
      <div><strong>{available ? "No indexed markets yet" : "Live market feed is unavailable"}</strong><p>{available ? "Markets appear here after a proposal and its conditional pools are created on Fuji." : "Connect the Fuji indexer to display verified proposals and market observations."}</p></div>
      <Link href={available ? "/create" : "/docs"}>{available ? "Create a project" : "Check setup"}<ArrowUpRight size={14} /></Link>
    </div>}
  </section>;
}
