"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Archive, ArrowRight, ArrowUpRight, CircleAlert, CircleHelp, Database, FileClock, Layers, ShieldCheck, Wallet } from "lucide-react";
import { ButtonLink, PageIntro } from "@/app/components/ui";
import { useWallet } from "@/app/components/client-providers";

export function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "claims">("overview");
  const [loading, setLoading] = useState(false);
  const [portfolioData, setPortfolioData] = useState<{
    available: boolean;
    contributions: Array<{ id: string; projectId: string; amount: string; txHash: string; blockTime: number }>;
    vaultEvents: Array<{ id: string; vault: string; eventType: string; amount: string; txHash: string; blockTime: number }>;
  } | null>(null);

  const wallet = useWallet();
  const walletConnected = wallet.status === "connected";
  const walletWrongNetwork = wallet.status === "wrong-network";
  const walletAddress = wallet.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : null;
  const chainLabel = wallet.targetChainId === 43113 ? "Avalanche Fuji" : wallet.targetChainId === 31337 ? "Anvil Local" : `chain ${wallet.targetChainId}`;

  const fetchPortfolio = async (address: string) => {
    setLoading(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
    try {
      const res = await fetch(`${apiBase}/api/v1/users/${encodeURIComponent(address)}/portfolio`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as {
          available: boolean;
          contributions?: Array<{ id: string; projectId: string; amount: string; txHash: string; blockTime: number }>;
          vaultEvents?: Array<{ id: string; vault: string; eventType: string; amount: string; txHash: string; blockTime: number }>;
        };
        setPortfolioData({
          available: json.available ?? false,
          contributions: json.contributions ?? [],
          vaultEvents: json.vaultEvents ?? [],
        });
      } else {
        setPortfolioData({ available: false, contributions: [], vaultEvents: [] });
      }
    } catch {
      setPortfolioData({ available: false, contributions: [], vaultEvents: [] });
    } finally {
      setLoading(false);
    }
  };

  const currentAddress = wallet.address;
  useEffect(() => {
    if (walletConnected && currentAddress) {
      void fetchPortfolio(currentAddress);
    }
  }, [walletConnected, currentAddress]);

  const totalUsdcContributed = (portfolioData?.contributions ?? []).reduce((acc, c) => {
    try {
      return acc + BigInt(c.amount || "0");
    } catch {
      return acc;
    }
  }, 0n);

  const formattedContributed = (Number(totalUsdcContributed) / 1e6).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const views = [
    { id: "overview" as const, label: "Overview", icon: Layers },
    { id: "positions" as const, label: "Conditional positions", icon: Database },
    { id: "claims" as const, label: "Claims & history", icon: FileClock },
  ];
  const integrations = [
    ["Wallet connector", walletConnected ? "Connected" : walletWrongNetwork ? "Wrong network" : wallet.providerAvailable ? "Available" : "Not installed"],
    ["Indexer", portfolioData?.available ? "Connected (Live Ponder)" : loading ? "Checking..." : "Awaiting sync / offline"],
    ["Conditional oracle", "Governor TWAP"],
    ["Contracts", walletWrongNetwork ? "Switch wallet to Fuji" : walletConnected ? "Fuji wallet connected" : "Fuji · 43113"],
    ["Settlement", "Raise and conditional vault"],
  ];

  return <div className="portfolio-screen">
    <div className="container page-wrap portfolio-container">
      <header className="portfolio-heading">
        <div>
          <p className="portfolio-eyebrow">Personal account <span /> {chainLabel}</p>
          <h1>Portfolio</h1>
          <p className="portfolio-description">
            {walletConnected
              ? "Live indexed holdings, project contributions, and conditional market positions from Avalanche Fuji."
              : "Connect your injected EIP-1193 wallet to query on-chain positions and contributions."}
          </p>
        </div>
        <span className="portfolio-readonly-label">
          <ShieldCheck size={14} /> {portfolioData?.available ? "Live Indexer" : "Indexer Standby"}
        </span>
      </header>

      <section className="portfolio-wallet-state" aria-labelledby="portfolio-wallet-title">
        <div className="portfolio-state-icon"><Wallet size={20} /></div>
        <div className="portfolio-wallet-copy">
          <div className="portfolio-wallet-heading"><h2 id="portfolio-wallet-title">{walletConnected ? "Wallet connected" : walletWrongNetwork ? "Wallet connected · wrong network" : "Wallet not connected"}{walletAddress && <> <span>·</span> <code>{walletAddress}</code></>}</h2><span className="portfolio-state-chip">{walletConnected ? "Active session" : "Current state"}</span></div>
          <p>{walletConnected ? `The wallet is connected to ${chainLabel}. Live indexed positions and contributions are actively queried from the Fuji Ponder indexer.` : walletWrongNetwork ? `The connected wallet is on chain ${wallet.chainId ?? "unknown"}. Switch to ${chainLabel} (chain ${wallet.targetChainId}) before using this app.` : "Choose a compatible EVM wallet to identify your account and load your live positions."}</p>
        </div>
        <div className="portfolio-connect-wrap">
          {walletConnected
            ? <button className="portfolio-connect" type="button" onClick={() => wallet.address && void fetchPortfolio(wallet.address)} disabled={loading}><Wallet size={15} />{loading ? "Refreshing..." : "Refresh"}</button>
            : <button className="portfolio-connect" type="button" onClick={() => void (walletWrongNetwork ? wallet.switchNetwork() : wallet.connect())}><Wallet size={15} />{walletWrongNetwork ? `Switch to ${chainLabel}` : "Choose Wallet"}</button>}
          {wallet.error && <span className="wallet-connect-error" role="status">{wallet.error}</span>}
          {!walletConnected && !walletWrongNetwork && !wallet.providerAvailable && <span id="portfolio-connect-reason">Install a supported wallet extension or open WolfDAO in its dApp browser.</span>}
        </div>
      </section>

      <div className="portfolio-tabs" role="tablist" aria-label="Portfolio views">
        {views.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" id={`portfolio-tab-${id}`} aria-selected={activeTab === id} aria-controls="portfolio-tab-panel" className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
            <Icon size={15} />
            <span>{label}</span>
            {portfolioData?.available && id === "positions" && <small>{portfolioData.vaultEvents.length} events</small>}
            {portfolioData?.available && id === "claims" && <small>{portfolioData.contributions.length} records</small>}
          </button>
        ))}
      </div>

      <div className="portfolio-view-layout">
        <section className="portfolio-primary-panel" role="tabpanel" id="portfolio-tab-panel" aria-labelledby={`portfolio-tab-${activeTab}`}>
          {activeTab === "overview" ? (
            <>
              <div className="portfolio-panel-heading">
                <div>
                  <p className="portfolio-section-kicker">Portfolio summary</p>
                  <h2>Account activity & holdings</h2>
                </div>
                <span>Fuji · 43113</span>
              </div>
              
              {walletConnected && portfolioData?.available ? (
                <div style={{ display: "grid", gap: "16px", marginTop: "14px" }}>
                  <div className="portfolio-guide-item is-current" style={{ minHeight: "auto", padding: "16px" }}>
                    <div className="portfolio-guide-head">
                      <span className="portfolio-step">TOTAL CAPITAL CONTRIBUTED</span>
                      <span className="portfolio-guide-chip">Verified</span>
                    </div>
                    <h3 style={{ fontSize: "28px", margin: "8px 0" }}>${formattedContributed} <small style={{ fontSize: "14px", fontWeight: "normal", color: "var(--portfolio-muted)" }}>USDC</small></h3>
                    <p>Across {portfolioData.contributions.length} recorded project raise transactions.</p>
                  </div>

                  <div className="portfolio-state-guide">
                    <article className="portfolio-guide-item">
                      <div className="portfolio-guide-head"><span className="portfolio-step">PROJECTS</span><span className="portfolio-guide-chip">Raise</span></div>
                      <h3>{portfolioData.contributions.length} contributions</h3>
                      <p>Indexed participations in project token launches.</p>
                    </article>
                    <article className="portfolio-guide-item">
                      <div className="portfolio-guide-head"><span className="portfolio-step">CONDITIONAL VAULT</span><span className="portfolio-guide-chip">Positions</span></div>
                      <h3>{portfolioData.vaultEvents.length} split/merge actions</h3>
                      <p>Active or redeemed outcome tokens.</p>
                    </article>
                  </div>
                </div>
              ) : (
                <>
                  <p className="portfolio-panel-description">
                    {loading
                      ? "Fetching portfolio records from Ponder indexer..."
                      : walletConnected
                        ? "Ponder indexer is syncing or has no indexed entries yet for this address. Once you contribute to a raise or trade conditional tokens, transactions appear here automatically."
                        : "Connect a wallet to view indexed holdings, or review the lifecycle guide below."}
                  </p>
                  <div className="portfolio-state-guide">
                    <article className={`portfolio-guide-item ${!walletConnected ? "is-current" : ""}`}>
                      <div className="portfolio-guide-head"><span className="portfolio-step">01</span><span className="portfolio-guide-chip">Connect</span></div>
                      <h3>Wallet connection</h3>
                      <p>Connect an injected EIP-1193 wallet to Fuji (chainId 43113).</p>
                    </article>
                    <article className={`portfolio-guide-item ${walletConnected && loading ? "is-current" : ""}`}>
                      <div className="portfolio-guide-head"><span className="portfolio-step">02</span><span className="portfolio-guide-chip">Indexer</span></div>
                      <h3>Live Ponder query</h3>
                      <p>Queries PostgreSQL live indexed tables for user address.</p>
                      {loading && <div className="portfolio-skeleton"><i /><i /><i /></div>}
                    </article>
                    <article className={`portfolio-guide-item ${walletConnected && !loading ? "is-current" : ""}`}>
                      <div className="portfolio-guide-head"><span className="portfolio-step">03</span><span className="portfolio-guide-chip">Portfolio</span></div>
                      <h3>Indexed positions</h3>
                      <p>Displays verified Raise allocations and DecisionAMM conditional balances.</p>
                    </article>
                    <article className="portfolio-guide-item">
                      <div className="portfolio-guide-head"><span className="portfolio-step">04</span><span className="portfolio-guide-chip">Settlement</span></div>
                      <h3>Claims &amp; Redemptions</h3>
                      <p>Execute one-click claims after successful raises or resolved proposals.</p>
                    </article>
                  </div>
                </>
              )}
            </>
          ) : activeTab === "positions" ? (
            <div className="portfolio-tab-state">
              <div className="portfolio-tab-icon"><Layers size={19} /></div>
              <span className="portfolio-guide-chip">{portfolioData?.vaultEvents?.length ? "Indexed" : "Empty"}</span>
              <h2>{portfolioData?.vaultEvents?.length ? "Conditional Positions" : "No Conditional Positions"}</h2>
              <p>
                {portfolioData?.vaultEvents?.length
                  ? `Found ${portfolioData.vaultEvents.length} conditional vault operations recorded on Fuji.`
                  : "You have not yet split or merged collateral in ConditionalVault on Avalanche Fuji."}
              </p>
              {portfolioData?.vaultEvents && portfolioData.vaultEvents.length > 0 && (
                <div style={{ width: "100%", marginTop: "14px", textAlign: "left" }}>
                  {portfolioData.vaultEvents.map((evt) => (
                    <div className="portfolio-data-row" key={evt.id}>
                      <div>
                        <strong>{evt.eventType.toUpperCase()} · Vault {evt.vault.slice(0, 8)}…</strong>
                        <small>Amount: {(Number(evt.amount) / 1e18).toFixed(4)} · Tx: <a href={`https://testnet.snowtrace.io/tx/${evt.txHash}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{evt.txHash.slice(0, 10)}…</a></small>
                      </div>
                      <span>{new Date(evt.blockTime * 1000).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="portfolio-tab-state">
              <div className="portfolio-tab-icon"><Archive size={19} /></div>
              <span className="portfolio-guide-chip">{portfolioData?.contributions?.length ? "Indexed" : "Empty"}</span>
              <h2>{portfolioData?.contributions?.length ? "Contribution History" : "No Contributions Recorded"}</h2>
              <p>
                {portfolioData?.contributions?.length
                  ? `Found ${portfolioData.contributions.length} recorded raise contributions.`
                  : "No contributions to active or finalized project raises recorded yet."}
              </p>
              {portfolioData?.contributions && portfolioData.contributions.length > 0 && (
                <div style={{ width: "100%", marginTop: "14px", textAlign: "left" }}>
                  {portfolioData.contributions.map((c) => (
                    <div className="portfolio-data-row" key={c.id}>
                      <div>
                        <strong>Project {c.projectId}</strong>
                        <small>${(Number(c.amount) / 1e6).toFixed(2)} USDC · Tx: <a href={`https://testnet.snowtrace.io/tx/${c.txHash}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{c.txHash.slice(0, 10)}…</a></small>
                      </div>
                      <span>{new Date(c.blockTime * 1000).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="portfolio-data-views">
            <div className="portfolio-panel-heading">
              <div>
                <p className="portfolio-section-kicker">Data views</p>
                <h2>{activeTab === "overview" ? "Portfolio data" : views.find((view) => view.id === activeTab)?.label}</h2>
              </div>
              <span>{portfolioData?.available ? "Live Ponder" : "Not queried"}</span>
            </div>
            {(activeTab === "overview"
              ? [
                  ["Project token allocations", portfolioData?.contributions?.length ? `${portfolioData.contributions.length} verified allocations` : "Balances update once raise succeeds."],
                  ["Conditional-market positions", portfolioData?.vaultEvents?.length ? `${portfolioData.vaultEvents.length} events logged` : "Available when trading conditional tokens."],
                  ["Claims & redemptions", portfolioData?.contributions?.length ? "Claim eligibility indexed on Fuji" : "Claimable after raise finalization."],
                ]
              : activeTab === "positions"
              ? [
                  ["Conditional-market positions", portfolioData?.vaultEvents?.length ? `${portfolioData.vaultEvents.length} position records` : "No conditional positions found."],
                ]
              : [
                  ["Claims & history", portfolioData?.contributions?.length ? `${portfolioData.contributions.length} contribution records` : "No claims history found."],
                ]
            ).map(([label, detail]) => (
              <div className="portfolio-data-row" key={label}>
                <div>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </div>
                <span>{portfolioData?.available ? "Live" : "Standby"}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="portfolio-side-column">
          <section className="portfolio-integrations" aria-labelledby="portfolio-integrations-title">
            <div className="portfolio-panel-heading">
              <div>
                <p className="portfolio-section-kicker">Service availability</p>
                <h2 id="portfolio-integrations-title">Portfolio sources</h2>
              </div>
              <CircleHelp size={16} />
            </div>
            <p className="portfolio-panel-description">Live service status for portfolio data on Avalanche Fuji.</p>
            <div className="portfolio-integration-list">
              {integrations.map(([label, state]) => (
                <div className="portfolio-integration-row" key={label}>
                  <span><i />{label}</span>
                  <strong>{state}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="portfolio-scope-note">
            <CircleAlert size={16} />
            <p>
              <strong>{portfolioData?.available ? "Fuji indexer responding" : loading ? "Checking Fuji indexer" : "Fuji indexer unavailable"}</strong>
              <span>Portfolio rows are read from indexed Avalanche Fuji transactions. Contract balances are verified by the wallet and chain.</span>
            </p>
          </section>
        </aside>
      </div>

      <footer className="portfolio-footer">
        <span>© 2026 WolfDAO · Avalanche Fuji · chainId 43113</span>
        <span>EIP-1193 wallet · Ponder indexed records</span>
      </footer>
    </div>
  </div>;
}

export function AboutPage() {
  const steps = [
    ["01", "Create a project", "Set token allocation, raise bounds, and governance parameters in a Fuji Factory transaction."],
    ["02", "Fund the raise", "Contributors approve Fuji USDC, contribute during the configured window, and claim tokens or refunds after finalization."],
    ["03", "Propose an action", "The project Governor escrows its token bond and creates Pass and Fail conditional markets with USDC liquidity."],
    ["04", "Resolve by market data", "The Governor finalizes after the trading window using the configured TWAP and threshold, then executes a passing action through Treasury."],
  ];
  const faqs = [
    ["Which network does WolfDAO use?", "Avalanche Fuji C-Chain, chain ID 43113. Test assets have no monetary value."],
    ["Can I trade immediately after proposal creation?", "The Governor starts a proposal in Pending state. Trading begins after the configured warmup and an activation transaction."],
    ["How is a proposal resolved?", "The Governor compares finalized Pass and Fail TWAP values against the project’s on-chain threshold."],
    ["Are agents and x402 active?", "Those services remain unavailable until a verified identity registry, analysis provider, facilitator, and settlement destination are configured."],
  ];
  return <div className="container page-wrap"><PageIntro eyebrow="PROTOCOL OVERVIEW · FUJI" title="Markets guide project treasury decisions." description="WolfDAO combines project raises, conditional markets, and on-chain governance on Avalanche Fuji." action={<ButtonLink href="/docs">Read the user guide <ArrowUpRight size={14}/></ButtonLink>}/>
    <div className="how-grid">{steps.map(([number,title,copy])=><div className="panel how-step" key={number}><span className="how-number">{number}</span><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div>
    <section className="section panel panel-pad"><p className="eyebrow">CONDITIONAL MARKETS</p><h2 className="about-heading">Compare two possible outcomes.</h2><p className="muted">Each proposal creates separate Pass and Fail markets for conditional project-token assets. Their finalized time-weighted prices feed the Governor’s configured decision rule. Live prices appear only after a real proposal market is indexed.</p><div className="docs-outcome-grid"><article className="docs-outcome docs-outcome-pass"><span className="docs-outcome-label">IF THE PROPOSAL PASSES</span><strong>Pass market</strong><p>Represents the token value conditional on the action being approved.</p></article><article className="docs-outcome docs-outcome-fail"><span className="docs-outcome-label">IF THE PROPOSAL FAILS</span><strong>Fail market</strong><p>Represents the token value conditional on the action being rejected.</p></article></div></section>
    <section className="section"><h2 className="subheading">Frequently asked questions</h2><div className="panel faq-list">{faqs.map(([question,answer])=><div className="faq-item" key={question}><h3>{question}</h3><p>{answer}</p></div>)}</div></section>
    <section className="section panel panel-pad about-cta"><div><h2>Explore Fuji records</h2><p>Browse project and market entries after they have been confirmed and indexed.</p></div><ButtonLink href="/explore">Browse projects <ArrowRight size={14}/></ButtonLink></section>
  </div>;
}
