import { NextResponse } from "next/server";
import { VERIFIED_PROJECTS } from "@/lib/verified-markets";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    items: VERIFIED_PROJECTS,
    total: VERIFIED_PROJECTS.length,
    available: true,
  });
}
