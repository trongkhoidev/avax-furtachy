import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../src/index.js";
import { createIndexedRoutes } from "../src/indexed-routes.js";

const project = {
  id: 7,
  founder: "0x0000000000000000000000000000000000000001",
  raise: "0x0000000000000000000000000000000000000002",
  token: null,
  treasury: null,
  governor: null,
  spot_amm: null,
  name: "Northstar",
  symbol: "NORTH",
  state: "Pending",
  min_raise: "1000000",
  hard_cap: "5000000",
  total_contributed: "0",
  accepted_total: "0",
  metadata_uri: "ipfs://project-metadata",
  metadata_hash: `0x${"a".repeat(64)}`,
  created_at: "1760000000",
};

function jsonPool(rowsForQuery: (sql: string, values?: unknown[]) => unknown[]) {
  return { query: async (sql: string, values?: unknown[]) => ({ rows: rowsForQuery(sql, values), rowCount: 1 }) } as never;
}

test("health identifies Fuji and reports whether an indexer database is configured", async () => {
  const response = await app.request("/health");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.network, "avalanche-fuji");
  assert.equal(body.indexerConfigured, false);
});

test("live read endpoints distinguish missing indexer configuration from an empty market", async () => {
  const projects = await app.request("/api/v1/projects");
  assert.equal(projects.status, 503);
  assert.equal((await projects.json()).available, false);
  const markets = await app.request("/api/v1/markets");
  assert.equal(markets.status, 503);
  assert.equal((await markets.json()).available, false);
});

test("the former synthetic market and registration endpoints do not exist", async () => {
  assert.equal((await app.request("/api/v1/demo/markets")).status, 404);
  assert.equal((await app.request("/api/v1/agents/register/nonce?wallet=0x0")).status, 404);
  assert.equal((await app.request("/api/v1/agents/register", { method: "POST", body: "{}" })).status, 404);
});

test("indexer project listing returns indexed Factory rows and validates pagination", async () => {
  const router = createIndexedRoutes(jsonPool((sql) => sql.includes("COUNT(*)") ? [{ count: "1" }] : [project]));
  const response = await router.request("/projects?limit=10&offset=0");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.available, true);
  assert.equal(body.total, 1);
  assert.equal(body.items[0].id, "7");
  assert.equal(body.items[0].name, "Northstar");
  assert.equal((await router.request("/projects?limit=1.5")).status, 400);
});

test("route IDs reject floats and scientific notation before database access", async () => {
  const router = createIndexedRoutes(jsonPool(() => { throw new Error("query should not run"); }));
  assert.equal((await router.request("/projects/1.5")).status, 400);
  assert.equal((await router.request("/projects/1e2")).status, 400);
  assert.equal((await router.request("/proposals/0x0000000000000000000000000000000000000001/3.0")).status, 400);
});

test("agent score aggregates are converted from on-chain basis points to percent", async () => {
  const pool = jsonPool((sql) => sql.includes("forecast_score") ? [{ agent_id: "12", forecast_count: "2", average_score: "8450" }] : []);
  const router = createIndexedRoutes(pool);
  const list = await router.request("/agents");
  assert.equal(list.status, 200);
  assert.equal((await list.json()).items[0].averageScore, 84.5);
  const detail = await router.request("/agents/12");
  assert.equal((await detail.json()).averageScore, 84.5);
});

test("API handles CORS preflight for browser requests", async () => {
  const response = await app.request("/api/v1/markets", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "GET" },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
});

test("metadata upload validates its payload before contacting storage", async () => {
  const response = await app.request("/api/v1/metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ name: "x" }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Metadata failed validation.");
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
});

test("paid analysis and cross-chain endpoints do not offer unavailable services", async () => {
  const analysis = await app.request("/sage/v1/analysis/0x0000000000000000000000000000000000000001/1");
  assert.equal(analysis.status, 503);
  assert.equal((await analysis.json()).available, false);
  const crossChain = await app.request("/api/v1/chains/7");
  assert.equal(crossChain.status, 503);
  assert.equal((await crossChain.json()).available, false);
});
