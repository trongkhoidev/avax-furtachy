import { ProposalExperience } from "@/app/components/proposal-experience";

export default async function ProposalPage({ params }: { params: Promise<{ gov: string; id: string }> }) {
  const { gov, id } = await params;
  return <ProposalExperience governor={gov} proposalId={id} />;
}
