import { ProjectSectionPage } from "@/app/components/project-sections";

export default async function ProjectSectionRoute({ params }: { params: Promise<{ projectId: string; section: string }> }) {
  const { projectId, section } = await params;
  return <ProjectSectionPage projectId={projectId} section={section} />;
}
