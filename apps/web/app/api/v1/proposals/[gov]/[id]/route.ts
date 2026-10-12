import { NextResponse } from "next/server";
import { VERIFIED_MARKETS } from "@/lib/verified-markets";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gov: string; id: string }> }
) {
  const { gov, id } = await params;
  const proposal = VERIFIED_MARKETS.find(
    (m) =>
      m.id === id &&
      (!gov || m.governor.toLowerCase() === gov.toLowerCase())
  ) || VERIFIED_MARKETS.find((m) => m.id === id);

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  return NextResponse.json(proposal);
}
