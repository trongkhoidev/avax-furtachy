import { NextResponse } from "next/server";
import { VERIFIED_MARKETS } from "@/lib/verified-markets";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const items = VERIFIED_MARKETS.filter((m) => m.projectId === id);
  return NextResponse.json({
    items,
    available: true,
  });
}
