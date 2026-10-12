import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
const port = Number(process.env.PORT ?? 8801);
const role = process.env.AGENT_ROLE ?? "analyst";
const agentId = process.env.AGENT_ID ?? null;

app.get("/health", (c) => c.json({
  ok: true,
  service: "futara-agent",
  network: "avalanche-fuji",
  configured: Boolean(process.env.LLM_PROVIDER && process.env.LLM_API_KEY && agentId),
}));

app.get("/status", (c) => c.json({
  available: false,
  role,
  agentId,
  network: "avalanche-fuji",
  reason: "Agent analysis is unavailable until a live provider, indexed proposal source, and verified identity are configured.",
}, 503));

app.get("/sage/v1/analysis/:governor/:proposalId", (c) => c.json({
  available: false,
  reason: "No verified analysis provider is configured. No payment is requested.",
}, 503));

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port }, (info) => console.log(JSON.stringify({
    level: "info",
    service: "futara-agent",
    role,
    port: info.port,
    configured: Boolean(process.env.LLM_PROVIDER && process.env.LLM_API_KEY && agentId),
  })));
}

export { app };
