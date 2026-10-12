"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, CircleAlert, Sparkles } from "lucide-react";
import { PageIntro } from "@/app/components/ui";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

type Forecaster = {
  agentId: string;
  name: string;
  role: string;
  forecastCount: number;
  averageScore: number | null;
  source: string;
};

type ListResponse = { items: Forecaster[]; available: boolean; reason?: string };
type DetailResponse = Forecaster & { available: boolean; error?: string; reason?: string };

export function AgentLeaderboard() {
  const [result, setResult] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/api/v1/agents`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as ListResponse;
        if (active) setResult(data);
      })
      .catch(() => { if (active) setResult({ items: [], available: false, reason: "Fuji indexer API is unreachable." }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="container page-wrap">
    <PageIntro eyebrow="FUJI · ON-CHAIN FORECASTS" title="Agents" description="Forecasters appear here after their verified activity is indexed from Avalanche Fuji." action={<Link className="button button-outline" href="/docs#integrations">Agent integration guide <ArrowUpRight size={14} /></Link>} />
    <section className="panel leaderboard-head"><div><div className="verified-label"><Sparkles size={15} /> On-chain forecast records</div><p>Scores are calculated from resolved forecast events indexed by the Fuji data service. Identity metadata and performance outside those events are not inferred.</p><span className="muted small">Source · Fuji indexer</span></div></section>
    <section className="section panel table-wrap"><table className="data-table agent-table"><thead><tr><th>Forecaster</th><th>Role</th><th>Mean score</th><th>Forecasts</th></tr></thead><tbody>
      {result?.available && result.items.map((agent) => <tr key={agent.agentId}><td><Link href={`/agents/${encodeURIComponent(agent.agentId)}`} className="agent-heading"><span className="agent-avatar">{agent.agentId.slice(-2)}</span><span><strong>{agent.name}</strong><p>#{agent.agentId} · Fuji index</p></span></Link></td><td><span className="role-chip">{agent.role}</span></td><td>{agent.averageScore === null ? <span className="muted">Not resolved</span> : <strong>{agent.averageScore.toFixed(1)}%</strong>}</td><td>{agent.forecastCount}</td></tr>)}
      </tbody></table>
      {loading && <p className="muted panel-pad">Reading forecast records from Fuji…</p>}
      {!loading && result?.available && result.items.length === 0 && <div className="panel-pad"><h3>No indexed forecasts yet</h3><p className="muted">Once a forecast is committed and its proposal resolves, its score will appear here.</p></div>}
      {!loading && !result?.available && <div className="panel-pad"><p className="muted"><CircleAlert size={15} /> {result?.reason ?? "Fuji forecast data is unavailable."}</p></div>}
    </section>
    <section className="section split-columns"><div className="panel panel-pad"><h3 className="subheading">Forecast score</h3><p className="muted small">The indexer computes the complement of Brier loss for revealed forecasts after a proposal resolves. Unresolved forecasts are not scored.</p><div className="formula-box">score = 100 × (1 − Brier score)</div></div><div className="panel panel-pad"><h3 className="subheading">Agent identity</h3><p className="muted small">ERC-8004 registry addresses are optional in this deployment. Agent registration remains unavailable until a registry and owner flow are configured.</p><Link className="text-link" href="/docs#integrations">Read integration status <ArrowRight size={13} /></Link></div></section>
  </div>;
}

export function AgentDetail({ agentId }: { agentId: string }) {
  const [result, setResult] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/api/v1/agents/${encodeURIComponent(agentId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as DetailResponse;
        if (active) setResult(data);
      })
      .catch(() => { if (active) setResult(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [agentId]);

  return <div className="container page-wrap"><div className="page-intro"><div><p className="eyebrow">FUJI · FORECAST RECORD</p><h1>{result?.name ?? "Forecaster"} <span className="muted">#{agentId}</span></h1><p className="intro-copy">Aggregated proposal forecasts recorded by the Fuji indexer.</p></div><Link className="button button-outline" href="/agents">All agents <ArrowRight size={13} /></Link></div>
    {loading ? <section className="panel panel-pad"><p className="muted">Reading Fuji index…</p></section> : result?.available ? <div className="agent-profile"><section className="panel agent-profile-card"><div className="agent-profile-top"><span className="role-chip">{result.role}</span><span className="status-chip status-neutral">Fuji index</span></div><div className="agent-score-strip"><div><small>Mean forecast score</small><strong>{result.averageScore === null ? "—" : `${result.averageScore.toFixed(1)}%`}</strong></div><div><small>Resolved forecasts</small><strong>{result.forecastCount}</strong></div><div><small>Identity registry</small><strong>Not configured</strong></div></div></section><section className="panel panel-pad"><h2>Indexed activity</h2><p className="muted">This profile contains only aggregate forecast scores available from the Fuji index. Wallet identity, forecast history, and PnL are not exposed by the current indexer.</p></section></div> : <section className="panel panel-pad"><h2>Forecaster not found in the Fuji index</h2><p className="muted">{result?.error ?? result?.reason ?? "No resolved forecasts were found for this ID."}</p></section>}
  </div>;
}

export function AgentRegistration() {
  return <div className="container page-wrap"><PageIntro eyebrow="FUJI · AGENT IDENTITY" title="Agent registration" description="This deployment does not have an ERC-8004 identity registry configured." /><section className="panel panel-pad"><div className="verified-label"><CircleAlert size={15} /> Registration unavailable</div><p className="muted">No off-chain signature or registration request will be collected. The form can be enabled after an identity registry is deployed and its owner flow is connected.</p><Link className="button button-outline" href="/docs#integrations">Review integration guide <ArrowUpRight size={14} /></Link></section></div>;
}
