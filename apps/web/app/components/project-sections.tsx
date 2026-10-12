import Link from "next/link";
import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { ArrowUpRight, CircleAlert } from "lucide-react";
import { ProjectRaiseActions } from "@/app/components/project-raise-actions";
import { PageIntro } from "@/app/components/ui";
import { getProjectProposals } from "@/lib/live-data";
import { getFactoryProject, parsePositiveBigInt } from "@/lib/projects";
import { buildTimeAddresses, chainConfig, targetChain } from "@/lib/contracts/addresses";

function money(raw: bigint) {
  return `$${(Number(raw) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function price(raw: string | null) {
  if (!raw || !/^\d+$/.test(raw)) return "No observation";
  return `${(Number(BigInt(raw)) / 1e18).toFixed(4)} USDC`;
}

function ProjectUnavailable({ projectId, message }: { projectId: string; message: string }) {
  return <main className="container page-wrap"><div className="panel panel-pad"><p className="exchange-kicker">FUJI · PROJECT WORKSPACE</p><h1>Project data unavailable</h1><p className="muted">{message}</p><Link className="button button-outline" href={`/p/${projectId}`}>Project overview</Link></div></main>;
}

export async function ProjectSectionPage({ projectId, section }: { projectId: string; section: string }) {
  const id = parsePositiveBigInt(projectId);
  if (id === null) return <ProjectUnavailable projectId={projectId} message="Project IDs must be positive decimal integers. This path does not map to an on-chain project." />;
  const lookup = await getFactoryProject(id);
  if (lookup.status !== "found") return <ProjectUnavailable projectId={projectId} message={lookup.status === "error" ? lookup.error : lookup.status === "unconfigured" ? "The Fuji Factory address is not configured." : "No project with this ID was found in the Fuji Factory."} />;
  const project = lookup.project;

  if (section === "raise") return <main className="container page-wrap exchange-section-page">
    <PageIntro eyebrow={`PROJECT #${projectId} · FUJI RAISE`} title={`${project.name} raise`} description="Raise terms and status are read from the deployed Factory and Raise contracts." />
    <div className="exchange-detail-layout"><section className="panel exchange-contract-panel"><p className="exchange-kicker">ON-CHAIN TERMS</p><div className="exchange-project-stats"><div><small>Minimum raise</small><strong>{money(project.minRaise)}</strong></div><div><small>Hard cap</small><strong>{money(project.hardCap)}</strong></div><div><small>Raised</small><strong>{project.raiseDetails ? money(project.raiseDetails.totalContributed) : "Unavailable"}</strong></div></div><div className="exchange-contract-row"><span>Raise address</span><a href={`https://testnet.snowtrace.io/address/${project.raise}`} target="_blank" rel="noreferrer">{project.raise}<ArrowUpRight size={12} /></a></div><p className="muted small">Contribution history appears after Fuji indexer sync. Token, treasury, and governance contracts deploy after successful raise finalization.</p></section><ProjectRaiseActions raiseAddress={project.raise} projectName={project.name} /></div>
  </main>;

  if (section === "treasury") {
    let treasuryUsdc: bigint | null = null;
    let readFailed = false;
    if (project.isLive && project.treasury && project.treasury !== "0x0000000000000000000000000000000000000000" && buildTimeAddresses.usdc) {
      const client = createPublicClient({ chain: targetChain, transport: http(chainConfig.rpcUrl) });
      try {
        treasuryUsdc = await client.readContract({ abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), address: buildTimeAddresses.usdc, functionName: "balanceOf", args: [project.treasury] });
      } catch { readFailed = true; }
    }
    return <main className="container page-wrap exchange-section-page">
      <PageIntro eyebrow={`PROJECT #${projectId} · TREASURY`} title={`${project.name} treasury`} description="Treasury values are read from the deployed contract and Fuji USDC token." />
      {project.isLive ? <section className="panel exchange-contract-panel"><p className="exchange-kicker">LIVE CONTRACT READ</p><div className="exchange-project-stats"><div><small>USDC balance</small><strong>{treasuryUsdc === null ? "Unavailable" : `${formatUnits(treasuryUsdc, 6)} USDC`}</strong></div><div><small>Treasury contract</small><strong>{project.treasury.slice(0, 8)}…{project.treasury.slice(-6)}</strong></div><div><small>Index history</small><strong>Not available</strong></div></div>{readFailed && <p className="field-error">Fuji RPC could not read the treasury balance.</p>}{!buildTimeAddresses.usdc && <p className="muted">Set the verified Fuji USDC address to read the treasury's token balance.</p>}</section> : <div className="exchange-empty"><span className="exchange-empty-mark"><i /><i /></span><div><strong>Treasury has not been deployed</strong><p>The protocol creates the treasury after this project’s raise is successfully finalized.</p></div></div>}
    </main>;
  }

  if (section === "proposals") {
    const proposalData = project.governor ? await getProjectProposals(projectId) : { items: [], available: true, reason: undefined };
    const items = proposalData?.items ?? [];
    return <main className="container page-wrap exchange-section-page">
      <div className="exchange-directory-heading"><div><p className="exchange-kicker">PROJECT #{projectId} · GOVERNANCE</p><h1>{project.name} proposals</h1><p>Proposals are loaded from this project’s Governor and Fuji index.</p></div>{project.governor ? <Link className="button button-primary" href={`/p/${projectId}/propose`}>Create proposal <ArrowUpRight size={14} /></Link> : <span className="exchange-state">Governor not deployed</span>}</div>
      {proposalData?.available && items.length ? <div className="exchange-project-list"><div className="exchange-project-head exchange-proposal-list-head"><span>Proposal</span><span>State</span><span>Pass</span><span>Fail</span><span /></div>{items.map((item) => <Link href={`/proposal/${item.governor}/${item.id}`} className="exchange-project-row exchange-proposal-list-row" key={`${item.governor}-${item.id}`}><span className="exchange-project-title"><i>{item.id}</i><span><strong>{item.title?.trim() || `Proposal #${item.id}`}</strong><small>Created {new Date(Number(item.createdAt) * 1000).toLocaleString()}</small></span></span><span><b className={`exchange-state state-${item.state.toLowerCase()}`}>{item.state}</b></span><span className="exchange-project-number">{price(item.passSpotE18)}</span><span className="exchange-project-number">{price(item.failSpotE18)}</span><ArrowUpRight size={14} /></Link>)}</div> : <div className="exchange-empty"><span className="exchange-empty-mark"><i /><i /></span><div><strong>{proposalData?.available ? "No proposals on this Governor" : "Proposal index unavailable"}</strong><p>{proposalData?.available ? "A proposal appears here after it is created on-chain." : proposalData?.reason || "Connect the Fuji indexer to load proposal records."}</p></div></div>}
    </main>;
  }

  if (section === "chains") return <main className="container page-wrap exchange-section-page"><PageIntro eyebrow={`PROJECT #${projectId} · NETWORK`} title={`${project.name} cross-chain`} description="Cross-chain governance is enabled only after a destination Avalanche L1, Teleporter messenger, contracts, and relayer are deployed and verified." /><div className="panel exchange-contract-panel"><p className="exchange-kicker">CONFIGURATION</p><div className="exchange-contract-row"><span>Project chain</span><strong>Avalanche Fuji C-Chain · 43113</strong></div><div className="exchange-contract-row"><span>Destination L1</span><small>Not configured</small></div><div className="exchange-contract-row"><span>Teleporter messenger and relayer</span><small>Not deployed</small></div></div></main>;

  return <ProjectUnavailable projectId={projectId} message={`Unknown project section: ${section}`} />;
}
