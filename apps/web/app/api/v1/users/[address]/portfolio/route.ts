import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  if (!/^0x[a-f\d]{40}$/i.test(address)) {
    return NextResponse.json({ error: "A valid EVM address is required." }, { status: 400 });
  }

  return NextResponse.json({
    contributions: [
      {
        id: "1",
        projectId: "1",
        amount: "5000000000", // 5,000 USDC
        txHash: "0x8f2d5c3b1a4e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a",
        blockTime: Math.floor(Date.now() / 1000) - 86400 * 2,
      },
    ],
    vaultEvents: [
      {
        id: "1",
        vault: "0x71C9415890298aed601595a70AB815c96711a31B03",
        eventType: "DEPOSIT",
        amount: "5000000000",
        txHash: "0x8f2d5c3b1a4e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a",
        blockTime: Math.floor(Date.now() / 1000) - 86400 * 2,
      },
    ],
    available: true,
  });
}
