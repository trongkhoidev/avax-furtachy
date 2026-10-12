import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../src/index.js";

test("agent health reports the Fuji service without claiming a configured model", async () => {
  const response = await app.request("/health");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.network, "avalanche-fuji");
  assert.equal(body.configured, false);
});

test("agent status is unavailable until live sources and a provider are configured", async () => {
  const response = await app.request("/status");
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.available, false);
  assert.match(body.reason, /provider/i);
});

test("paid analysis does not ask for payment when no report provider exists", async () => {
  const response = await app.request("/sage/v1/analysis/0x0000000000000000000000000000000000000001/1");
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.available, false);
  assert.equal(body.paymentRequirements, undefined);
});

test("the former synthetic agent tick endpoint is not exposed", async () => {
  const response = await app.request("/tick", { method: "POST", body: JSON.stringify({ proposalId: "1" }) });
  assert.equal(response.status, 404);
});
