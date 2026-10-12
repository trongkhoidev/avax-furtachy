import Link from "next/link";
import { ArrowRight, ArrowUpRight, CircleCheck, RadioTower } from "lucide-react";
import { MarketBoard } from "@/app/components/market-board";
import { getLiveMarkets, getLiveProjects } from "@/lib/live-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [marketData, projectData] = await Promise.all([getLiveMarkets(), getLiveProjects()]);
  const markets = marketData?.items ?? [];
  const indexAvailable = Boolean(marketData?.available && projectData?.available);

  return <main className="container page-wrap exchange-home">
    <header className="exchange-hero">
      <div className="exchange-hero-copy">
        <p className="exchange-kicker"><span className="exchange-live-dot" /> WOLFDAO <i>/</i> GOVERNANCE MARKETS</p>
        <h1>Price the decision.<br /><span>See both outcomes.</span></h1>
        <p className="exchange-hero-lede">Conditional markets make the expected impact of a treasury decision visible before the vote is executed.</p>
        <div className="exchange-hero-actions">
          <Link className="button button-primary" href="#markets">Explore markets <ArrowRight size={15} /></Link>
          <Link className="exchange-secondary-link" href="/create">Launch a project <ArrowUpRight size={15} /></Link>
        </div>
      </div>
      <aside className="exchange-network-panel" aria-label="Fuji network status">
        <div className="exchange-network-heading"><span><RadioTower size={16} /></span><div><small>NETWORK</small><strong>Avalanche Fuji</strong></div><b>TESTNET</b></div>
        <div className="exchange-network-line"><span>Chain ID</span><strong>43113</strong></div>
        <div className="exchange-network-line"><span>Data source</span><strong>{indexAvailable ? "Ponder index" : "Indexer unavailable"}</strong></div>
        <div className="exchange-network-foot"><CircleCheck size={14} /><span>On-chain records only</span><a href="https://testnet.snowtrace.io" target="_blank" rel="noreferrer">Explorer <ArrowUpRight size={12} /></a></div>
      </aside>
    </header>

    <section className="exchange-overview" aria-label="Fuji network activity">
      <div><small>Markets</small><strong>{marketData?.available ? markets.length : "—"}</strong><span>Verified proposals</span></div>
      <div><small>Projects</small><strong>{projectData?.available ? projectData.total : "—"}</strong><span>Factory records</span></div>
      <div><small>Network</small><strong>Fuji</strong><span>Chain 43113</span></div>
      <div className="exchange-overview-note"><span className={indexAvailable ? "is-connected" : ""} /><p>{indexAvailable ? "Connected to the Fuji indexer. Market prices appear after live observations are recorded." : "Live records will appear when the Fuji indexer is configured and synced."}</p></div>
    </section>

    <div id="markets"><MarketBoard markets={markets} available={Boolean(marketData?.available)} /></div>

    <section className="exchange-how">
      <div><p className="exchange-kicker">FUTARCHY, MADE LEGIBLE</p><h2>One proposal.<br />Two conditional markets.</h2></div>
      <p>Each proposal can open Pass and Fail outcome pools. Prices and time-weighted observations are read from the Fuji contracts and indexer. No market is shown until its on-chain data exists.</p>
      <Link href="/docs">Read the documentation <ArrowRight size={14} /></Link>
    </section>

    <footer className="exchange-footer"><span>WolfDAO · Avalanche Fuji</span><span>Market data is sourced from verified Fuji contracts and indexed events.</span></footer>
  </main>;
}
