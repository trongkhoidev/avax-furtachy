import Link from "next/link";
import { ArrowRight, ArrowUpRight, CircleAlert } from "lucide-react";
import { getFactoryProject, parsePositiveBigInt } from "@/lib/projects";

export const dynamic = "force-dynamic";

function money(raw: bigint) {
  return `$${(Number(raw) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function raiseStatus(state: number, start: bigint, end: bigint) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (state === 2) return ["Failed", "The contribution window is closed. Contributors can check refund eligibility on the Raise contract."] as const;
  if (state === 3) return ["Succeeded", "The raise met its target and is ready for finalization."] as const;
  if (state === 4) return ["Finalized", "The raise has been finalized on-chain."] as const;
  if (start > now) return ["Scheduled", "The raise has a future start time and is not accepting contributions yet."] as const;
  if ((state === 0 || state === 1) && (!end || now < end)) return ["Open", "The contribution window is open according to the on-chain schedule."] as const;
  if (end && now >= end) return ["Ended", "The contribution window has ended and awaits on-chain finalization."] as const;
  return ["Pending", "The raise state and schedule are still being read from Fuji."] as const;
}

export default async function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const numericId = parsePositiveBigInt(projectId);
  if (numericId === null) return <main className="container page-wrap"><div className="panel panel-pad"><p className="exchange-kicker">FUJI FACTORY RECORD</p><h1>Invalid project ID</h1><p className="muted">Project IDs must be positive decimal integers.</p><Link className="button button-outline" href="/explore">Browse projects</Link></div></main>;

  const lookup = await getFactoryProject(numericId);
  if (lookup.status !== "found") {
    const state = lookup.status === "not-found" ? "No project record with this ID was found in the configured Fuji factory." : lookup.status === "unconfigured" ? "Set NEXT_PUBLIC_FACTORY_ADDRESS to read project records from Fuji." : lookup.error;
    const title = lookup.status === "not-found" ? "Project not found" : lookup.status === "unconfigured" ? "Factory not configured" : "Fuji RPC could not verify this project";
    return <main className="container page-wrap"><div className="panel panel-pad"><p className="exchange-kicker"><span className="exchange-live-dot" /> FUJI · PROJECT LOOKUP</p><h1>{title}</h1><p className="muted">{state}</p><Link className="button button-outline" href="/explore">Browse projects</Link></div></main>;
  }

  const project = lookup.project;
  const [status, description] = project.isLive
    ? ["Live", "The Factory reports this project’s token, treasury, governor, and spot market as deployed."] as const
    : project.raiseDetails
      ? raiseStatus(project.raiseDetails.state, project.raiseDetails.startTime, project.raiseDetails.endTime)
      : ["Raise", "The project and Raise contract are recorded by the Factory. Raise details could not be verified."] as const;
  const tabs = [
    ["Overview", `/p/${projectId}`],
    ["Raise", `/p/${projectId}/raise`],
    ["Treasury", `/p/${projectId}/treasury`],
    ["Proposals", `/p/${projectId}/proposals`],
    ["Cross-chain", `/p/${projectId}/chains`],
  ];

  return <main className="container page-wrap exchange-project-detail">
    <div className="proposal-live-breadcrumb"><Link href="/explore">Projects</Link><span>/</span><span>#{project.id.toString()}</span></div>
    <header className="exchange-project-detail-heading"><div className="exchange-project-title"><i>{(project.symbol || project.name || "P").slice(0, 1).toUpperCase()}</i><div><p className="exchange-kicker">AVALANCHE FUJI · PROJECT #{project.id.toString()}</p><h1>{project.name} <small>{project.symbol}</small></h1></div></div><span className={`exchange-state state-${status.toLowerCase()}`}>{status}</span></header>
    <nav className="project-tabs exchange-project-tabs" aria-label="Project sections">{tabs.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</nav>
    <div className="exchange-project-detail-grid">
      <section className="panel exchange-project-summary"><p className="exchange-kicker">VERIFIED FACTORY RECORD</p><h2>{project.name}</h2><p>{description}</p><div className="exchange-project-stats"><div><small>Minimum raise</small><strong>{money(project.minRaise)}</strong></div><div><small>Hard cap</small><strong>{money(project.hardCap)}</strong></div><div><small>Contributed</small><strong>{project.raiseDetails ? money(project.raiseDetails.totalContributed) : "Unavailable"}</strong></div></div><div className="exchange-project-cta"><Link className="button button-primary" href={`/p/${projectId}/raise`}>Open raise <ArrowRight size={14} /></Link><Link href={`/p/${projectId}/propose`}>Create a proposal <ArrowUpRight size={14} /></Link></div></section>
      <aside className="panel exchange-project-contracts"><p className="exchange-kicker">ON-CHAIN ADDRESSES</p><ContractRow label="Founder" address={project.founder} /><ContractRow label="Raise" address={project.raise} /><ContractRow label="Token" address={project.token} /><ContractRow label="Treasury" address={project.treasury} /><ContractRow label="Governor" address={project.governor} /><ContractRow label="Spot AMM" address={project.spotAmm} /><a className="exchange-explorer-link" href={`https://testnet.snowtrace.io/address/${project.raise}`} target="_blank" rel="noreferrer">Open raise on Snowtrace <ArrowUpRight size={13} /></a></aside>
    </div>
    {!project.isLive && <div className="exchange-live-note"><CircleAlert size={15} /><p><strong>Deployment follows raise finalization.</strong> The Factory creates the Token, Treasury, Governor, and Spot AMM after the Raise contract is finalized.</p></div>}
  </main>;
}

function ContractRow({ label, address }: { label: string; address: string | null | undefined }) {
  const configured = address && address !== "0x0000000000000000000000000000000000000000";
  return <div className="exchange-contract-row"><span>{label}</span>{configured ? <a href={`https://testnet.snowtrace.io/address/${address}`} target="_blank" rel="noreferrer">{address.slice(0, 8)}…{address.slice(-6)} <ArrowUpRight size={12} /></a> : <small>Not deployed</small>}</div>;
}
