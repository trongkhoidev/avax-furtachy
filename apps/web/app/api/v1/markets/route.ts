import { NextResponse } from "next/server";
import { VERIFIED_MARKETS } from "@/lib/verified-markets";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    items: VERIFIED_MARKETS,
    available: true,
  });
}
