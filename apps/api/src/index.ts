import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import { canonicalJson, metadataHash } from "@futara/sdk";
import { Pool } from "pg";
import { createIndexedRoutes } from "./indexed-routes.js";

const app = new Hono();
const port = Number(process.env.PORT ?? 8787);
const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const metadataRateLimits = new Map<string, { start: number; count: number }>();
const indexerPool = process.env.NODE_ENV === "test" || !process.env.DATABASE_URL
  ? null
  : new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

const projectSchema = z.object({
  name: z.string().min(2).max(64),
  symbol: z.string().min(2).max(10),
  tagline: z.string().max(120),
  description: z.string().max(12_000),
  logo: z.string().optional(),
  banner: z.string().optional(),
  links: z.record(z.string(), z.string()).optional(),
  team: z.array(z.object({ name: z.string(), role: z.string(), x: z.string().optional() })).optional(),
  roadmap: z.array(z.object({ quarter: z.string(), items: z.array(z.string()) })).optional(),
});

app.use("*", logger());
app.use("*", cors({
  origin,
  allowHeaders: ["Content-Type", "X-PAYMENT", "Authorization"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  exposeHeaders: ["X-PAYMENT-RESPONSE"],
}));

app.get("/health", (c) => c.json({
  ok: true,
  service: "futara-api",
  network: "avalanche-fuji",
  indexerConfigured: indexerPool !== null,
  time: new Date().toISOString(),
}));

// Public read endpoints are sourced exclusively from Ponder's Fuji index.
app.route("/api/v1", createIndexedRoutes(indexerPool));

app.get("/api/v1/proposals/:gov/:id/analyses", (c) => c.json({
  items: [],
  available: false,
  reason: "No verified analysis provider is configured.",
}, 503));

app.get("/api/v1/chains/:projectId", (c) => c.json({
  projectId: c.req.param("projectId"),
  available: false,
  reason: "Cross-chain network and relayer configuration is not deployed.",
}, 503));

app.post("/api/v1/metadata", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || Buffer.byteLength(JSON.stringify(body), "utf8") > 256 * 1024) {
    return c.json({ error: "Metadata is empty or exceeds 256 KB." }, 413);
  }
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Metadata failed validation.", issues: parsed.error.issues }, 400);

  const remoteKey = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const limit = metadataRateLimits.get(remoteKey);
  if (limit && now - limit.start < 60_000 && limit.count >= 20) {
    return c.json({ error: "Metadata upload rate limit exceeded. Try again in one minute." }, 429);
  }
  metadataRateLimits.set(remoteKey, !limit || now - limit.start >= 60_000 ? { start: now, count: 1 } : { ...limit, count: limit.count + 1 });

  const canonical = JSON.parse(canonicalJson(parsed.data));
  const hash = metadataHash(canonical);
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return c.json({ error: "Metadata storage is not configured.", hash }, 503);

  const pin = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pinataContent: canonical }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!pin?.ok) return c.json({ error: "Metadata storage is unavailable or rejected the upload.", hash }, 502);
  const result = await pin.json() as { IpfsHash?: string };
  if (!result.IpfsHash) return c.json({ error: "Metadata storage returned no content identifier.", hash }, 502);
  return c.json({ uri: `ipfs://${result.IpfsHash}`, hash });
});

function unavailable(reason: string) {
  return { available: false, reason };
}

app.get("/x402/v1/data/proposal/:gov/:id/flow", (c) => c.json(unavailable("Order-flow analytics are not available until a verified indexer query is configured."), 503));
app.get("/x402/v1/data/project/:id/fundamentals", (c) => c.json(unavailable("Project fundamentals history is not indexed yet."), 503));
app.get("/x402/v1/data/project/:id/github", (c) => c.json(unavailable("No GitHub activity provider is configured."), 503));
app.get("/sage/v1/analysis/:gov/:id", (c) => c.json(unavailable("Paid analysis is disabled until a live analysis provider and settlement recipient are configured."), 503));

app.onError((error, c) => {
  console.error(JSON.stringify({ level: "error", message: error.message }));
  return c.json({ error: "Internal server error" }, 500);
});

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port }, () => console.log(JSON.stringify({
    level: "info",
    service: "futara-api",
    port,
    network: "avalanche-fuji",
    indexerConfigured: indexerPool !== null,
  })));
}

export { app };
