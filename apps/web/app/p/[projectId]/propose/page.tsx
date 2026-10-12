import Link from "next/link";
import { isAddress } from "viem";
import { ProposalWizard } from "@/app/components/wizards";
import { getFactoryProject, parsePositiveBigInt } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProposePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const numericId = parsePositiveBigInt(projectId);
  if (numericId === null) return <Unavailable title="Invalid project ID" message="Project IDs must be positive decimal integers." />;

  const result = await getFactoryProject(numericId);
  if (result.status !== "found") {
    const message = result.status === "not-found"
      ? "This project does not exist in the configured Fuji Factory."
      : result.status === "unconfigured"
        ? "Configure the Fuji Factory address to load this project."
        : "The Fuji RPC could not verify this project. Try again after checking the network connection.";
    return <Unavailable title="Project Governor unavailable" message={message} />;
  }

  const project = result.project;
  if (!project.isLive || !isAddress(project.governor) || project.governor === "0x0000000000000000000000000000000000000000") {
    return <Unavailable title="Governance is not deployed" message="The project needs a finalized raise and a deployed Governor before it can accept proposals." />;
  }

  return <ProposalWizard projectId={projectId} governorAddress={project.governor} projectName={project.name} tokenSymbol={project.symbol} />;
}

function Unavailable({ title, message }: { title: string; message: string }) {
  return <main className="container page-wrap"><section className="panel panel-pad"><p className="exchange-kicker">FUJI · GOVERNANCE</p><h1>{title}</h1><p className="muted">{message}</p><Link className="button button-outline" href="/explore">Browse projects</Link></section></main>;
}
