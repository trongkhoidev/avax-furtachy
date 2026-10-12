import { NextResponse } from "next/server";
import { VERIFIED_PROJECTS } from "@/lib/verified-markets";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = VERIFIED_PROJECTS.find((p) => p.id === id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}
