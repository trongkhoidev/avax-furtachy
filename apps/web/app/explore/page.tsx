import Link from "next/link";
import { ArrowUpRight, Boxes } from "lucide-react";
import { getLiveProjects, formatTokenAmount } from "@/lib/live-data";

export const dynamic = "force-dynamic";

function stateName(state: string) {
  return state.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function ExplorePage() {
  const data = await getLiveProjects();
  const projects = data?.items ?? [];
  return <main className="container page-wrap exchange-directory">
    <div className="exchange-directory-heading"><div><p className="exchange-kicker"><span className="exchange-live-dot" /> AVALANCHE FUJI · PROJECT FACTORY</p><h1>Projects</h1><p>Each entry is loaded from a verified Fuji factory event and indexer record.</p></div><Link className="button button-primary" href="/create">Create project <ArrowUpRight size={14} /></Link></div>
    <div className="exchange-directory-meta"><span>{data?.available ? `${data.total} indexed projects` : "Indexer unavailable"}</span><span>Chain ID 43113</span></div>
    {data?.available && projects.length ? <div className="exchange-project-list">
      <div className="exchange-project-head"><span>Project</span><span>State</span><span>Minimum raise</span><span>Contributed</span><span /></div>
      {projects.map((project) => <Link key={project.id} className="exchange-project-row" href={`/p/${project.id}`}>
        <span className="exchange-project-title"><i>{(project.symbol || project.name || "P").slice(0, 1).toUpperCase()}</i><span><strong>{project.name || `Project #${project.id}`}</strong><small>{project.symbol || "Token pending"} · #{project.id}</small></span></span>
        <span><b className={`exchange-state state-${project.state.toLowerCase()}`}>{stateName(project.state)}</b></span>
        <span className="exchange-project-number">${formatTokenAmount(project.minRaise)}</span>
        <span className="exchange-project-number">${formatTokenAmount(project.totalContributed)}</span>
        <ArrowUpRight size={15} />
      </Link>)}
    </div> : <section className="exchange-empty exchange-directory-empty">
      <span className="exchange-empty-mark"><Boxes size={17} /></span>
      <div><strong>{data?.available ? "No projects have been created yet" : "Project index is unavailable"}</strong><p>{data?.available ? "Create the first project on Fuji. Its on-chain record will appear here after the indexer processes it." : "Configure the Fuji RPC, deployed factory address, and indexer database to show project records."}</p></div>
      {data?.available && <Link href="/create">Create a project <ArrowUpRight size={14} /></Link>}
    </section>}
  </main>;
}
