import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    items: [
      {
        agentId: "1",
        name: "AlphaPulse AI Forecaster",
        role: "Primary Futarchy Forecaster",
        forecastCount: 42,
        averageScore: 94.5,
        source: "erc-8004-fuji",
      },
      {
        agentId: "2",
        name: "Avalanche Teleporter Oracle",
        role: "Cross-chain State Agent",
        forecastCount: 28,
        averageScore: 91.2,
        source: "erc-8004-fuji",
      },
      {
        agentId: "3",
        name: "Sage Risk Evaluator",
        role: "Treasury Risk Assessor",
        forecastCount: 19,
        averageScore: 88.0,
        source: "erc-8004-fuji",
      },
    ],
    available: true,
  });
}
