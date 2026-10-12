import { Hono } from "hono";
import type { Pool } from "pg";

type Row = Record<string, unknown>;
type QueryPool = Pick<Pool, "query">;

const positiveDecimal = (value: string) => /^[1-9]\d*$/.test(value);
const value = (row: Row, key: string) => row[key] == null ? null : String(row[key]);
const unavailable = (reason: string) => ({ items: [], available: false, reason });

function projectRow(row: Row) {
  return {
    id: String(row.id),
    founder: String(row.founder),
    raise: String(row.raise),
    token: value(row, "token"),
    treasury: value(row, "treasury"),
    governor: value(row, "governor"),
    spotAmm: value(row, "spot_amm"),
    name: value(row, "name"),
    symbol: value(row, "symbol"),
    state: String(row.state),
    minRaise: value(row, "min_raise") ?? "0",
    hardCap: value(row, "hard_cap") ?? "0",
    totalContributed: value(row, "total_contributed") ?? "0",
    acceptedTotal: value(row, "accepted_total") ?? "0",
    metadataURI: String(row.metadata_uri ?? ""),
    metadataHash: value(row, "metadata_hash"),
    createdAt: value(row, "created_at") ?? "0",
  };
}

function proposalRow(row: Row) {
  return {
    id: String(row.proposal_id),
    projectId: String(row.project_id),
    projectName: value(row, "project_name"),
    projectSymbol: value(row, "project_symbol"),
    governor: String(row.governor),
    proposer: String(row.proposer),
    title: value(row, "title"),
    descriptionURI: String(row.description_uri ?? ""),
    state: String(row.state),
    outcome: value(row, "outcome"),
    createdAt: value(row, "created_at") ?? "0",
    tradingStart: value(row, "trading_start"),
    tradingEnd: value(row, "trading_end"),
    executionDeadline: value(row, "execution_deadline"),
    vaultUsdc: String(row.vault_usdc),
    vaultToken: String(row.vault_token),
    passAmm: String(row.pass_amm),
    failAmm: String(row.fail_amm),
    seedPriceE18: String(row.seed_price_e18),
    twapPassE18: value(row, "twap_pass_e18"),
    twapFailE18: value(row, "twap_fail_e18"),
    passSpotE18: value(row, "pass_spot_e18"),
    failSpotE18: value(row, "fail_spot_e18"),
  };
}

export function createIndexedRoutes(pool: QueryPool | null) {
  const router = new Hono();

  router.get("/markets", async (c) => {
    if (!pool) return c.json(unavailable("Fuji indexer database is not configured."), 503);
    try {
      const result = await pool.query(
        `SELECT p.proposal_id, p.project_id, projects.name AS project_name, projects.symbol AS project_symbol,
                p.governor, p.proposer, p.title, p.description_uri, p.state, p.outcome,
                p.created_at, p.trading_start, p.trading_end, p.execution_deadline, p.vault_usdc, p.vault_token,
                p.pass_amm, p.fail_amm, p.seed_price_e18, p.twap_pass_e18, p.twap_fail_e18,
                (SELECT t.spot_e18 FROM twap_point t WHERE t.amm = p.pass_amm ORDER BY t.time DESC LIMIT 1) AS pass_spot_e18,
                (SELECT t.spot_e18 FROM twap_point t WHERE t.amm = p.fail_amm ORDER BY t.time DESC LIMIT 1) AS fail_spot_e18
         FROM proposal p LEFT JOIN project projects ON projects.id = p.project_id ORDER BY p.created_at DESC LIMIT 100`,
      );
      return c.json({ items: (result.rows as Row[]).map(proposalRow), available: true });
    } catch (error) {
      return c.json(unavailable(error instanceof Error ? error.message : "Fuji market query failed."), 503);
    }
  });

  router.get("/projects", async (c) => {
    if (!pool) return c.json({ items: [], total: 0, available: false, reason: "Fuji indexer database is not configured." }, 503);
    const requestedLimit = Number(c.req.query("limit") ?? 20);
    const requestedOffset = Number(c.req.query("offset") ?? 0);
    if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || !Number.isSafeInteger(requestedOffset) || requestedOffset < 0) {
      return c.json({ error: "limit and offset must be non-negative integers; limit must be greater than zero." }, 400);
    }
    const limit = Math.min(requestedLimit, 50);
    try {
      const [rows, count] = await Promise.all([
        pool.query(`SELECT id, founder, raise, token, treasury, governor, spot_amm, name, symbol, state,
                    min_raise, hard_cap, total_contributed, accepted_total, metadata_uri, metadata_hash, created_at
                    FROM project ORDER BY id DESC LIMIT $1 OFFSET $2`, [limit, requestedOffset]),
        pool.query("SELECT COUNT(*) AS count FROM project"),
      ]);
      return c.json({ items: (rows.rows as Row[]).map(projectRow), total: Number(count.rows[0]?.count ?? 0), available: true });
    } catch (error) {
      return c.json({ items: [], total: 0, available: false, error: error instanceof Error ? error.message : "Fuji index query failed." }, 503);
    }
  });

  router.get("/projects/:id", async (c) => {
    const id = c.req.param("id");
    if (!positiveDecimal(id)) return c.json({ error: "Project ID must be a positive decimal integer." }, 400);
    if (!pool) return c.json({ available: false, reason: "Fuji indexer database is not configured." }, 503);
    try {
      const result = await pool.query("SELECT * FROM project WHERE id = $1", [id]);
      const row = (result.rows as Row[])[0];
      if (!row) return c.json({ error: "Project not found in the Fuji index." }, 404);
      const raiseResult = await pool.query("SELECT state AS raise_state, total_contributed, accepted_total FROM raise WHERE address = $1", [row.raise]);
      const indexedRaise = (raiseResult.rows as Row[])[0];
      return c.json({
        ...projectRow(row),
        raiseState: value(indexedRaise ?? {}, "raise_state"),
        totalContributed: value(indexedRaise ?? {}, "total_contributed") ?? "0",
        acceptedTotal: value(indexedRaise ?? {}, "accepted_total") ?? "0",
        available: true,
      });
    } catch (error) {
      return c.json({ available: false, error: error instanceof Error ? error.message : "Fuji index query failed." }, 503);
    }
  });

  router.get("/projects/:id/proposals", async (c) => {
    const id = c.req.param("id");
    if (!positiveDecimal(id)) return c.json({ error: "Project ID must be a positive decimal integer." }, 400);
    if (!pool) return c.json(unavailable("Fuji indexer database is not configured."), 503);
    try {
      const result = await pool.query(
        `SELECT proposal_id, project_id, projects.name AS project_name, projects.symbol AS project_symbol,
                governor, proposer, title, description_uri, state, outcome,
                created_at, trading_start, trading_end, execution_deadline, vault_usdc, vault_token,
                pass_amm, fail_amm, seed_price_e18, twap_pass_e18, twap_fail_e18,
                (SELECT t.spot_e18 FROM twap_point t WHERE t.amm = proposal.pass_amm ORDER BY t.time DESC LIMIT 1) AS pass_spot_e18,
                (SELECT t.spot_e18 FROM twap_point t WHERE t.amm = proposal.fail_amm ORDER BY t.time DESC LIMIT 1) AS fail_spot_e18
         FROM proposal LEFT JOIN project projects ON projects.id = proposal.project_id WHERE proposal.project_id = $1 ORDER BY proposal_id DESC`, [id],
      );
      return c.json({ items: (result.rows as Row[]).map(proposalRow), available: true });
    } catch (error) {
      return c.json(unavailable(error instanceof Error ? error.message : "Fuji proposal query failed."), 503);
    }
  });

  router.get("/proposals/:gov/:id", async (c) => {
    const governor = c.req.param("gov").toLowerCase();
    const id = c.req.param("id");
    if (!/^0x[a-f\d]{40}$/i.test(governor) || !positiveDecimal(id)) return c.json({ error: "A valid Governor address and positive proposal ID are required." }, 400);
    if (!pool) return c.json({ available: false, reason: "Fuji indexer database is not configured." }, 503);
    try {
      const result = await pool.query(
        `SELECT proposal.proposal_id, proposal.project_id, projects.name AS project_name, projects.symbol AS project_symbol,
                governor, proposer, title, description_uri, state, outcome,
                created_at, trading_start, trading_end, execution_deadline, vault_usdc, vault_token,
                pass_amm, fail_amm, seed_price_e18, twap_pass_e18, twap_fail_e18,
                (SELECT t.spot_e18 FROM twap_point t WHERE t.amm = proposal.pass_amm ORDER BY t.time DESC LIMIT 1) AS pass_spot_e18,
                (SELECT t.spot_e18 FROM twap_point t WHERE t.amm = proposal.fail_amm ORDER BY t.time DESC LIMIT 1) AS fail_spot_e18
         FROM proposal LEFT JOIN project projects ON projects.id = proposal.project_id
         WHERE LOWER(proposal.governor) = $1 AND proposal.proposal_id = $2 LIMIT 1`, [governor, id],
      );
      const row = (result.rows as Row[])[0];
      return row ? c.json({ ...proposalRow(row), available: true }) : c.json({ error: "Proposal not found in the Fuji index." }, 404);
    } catch (error) {
      return c.json({ available: false, error: error instanceof Error ? error.message : "Fuji proposal query failed." }, 503);
    }
  });

  router.get("/proposals/:gov/:id/chart", async (c) => {
    const governor = c.req.param("gov").toLowerCase();
    const id = c.req.param("id");
    if (!/^0x[a-f\d]{40}$/i.test(governor) || !positiveDecimal(id)) return c.json({ error: "Invalid Governor address or proposal ID." }, 400);
    if (!pool) return c.json(unavailable("Fuji indexer database is not configured."), 503);
    const proposalId = `${governor}-${id}`;
    try {
      const result = await pool.query(
        `SELECT amm, pool_kind, observation_e18, spot_e18, time, tx_hash
         FROM twap_point WHERE proposal_id = $1 ORDER BY time ASC LIMIT 500`, [proposalId],
      );
      return c.json({ items: (result.rows as Row[]).map((row) => ({
        amm: String(row.amm), poolKind: String(row.pool_kind), observationE18: String(row.observation_e18),
        spotE18: String(row.spot_e18), time: Number(row.time), txHash: String(row.tx_hash),
      })), available: true });
    } catch (error) {
      return c.json(unavailable(error instanceof Error ? error.message : "Fuji chart query failed."), 503);
    }
  });

  router.get("/proposals/:gov/:id/trades", async (c) => {
    const governor = c.req.param("gov").toLowerCase();
    const id = c.req.param("id");
    if (!/^0x[a-f\d]{40}$/i.test(governor) || !positiveDecimal(id)) return c.json({ error: "Invalid Governor address or proposal ID." }, 400);
    if (!pool) return c.json(unavailable("Fuji indexer database is not configured."), 503);
    try {
      const result = await pool.query(
        `SELECT id, amm, pool_kind, sender, "to", quote_to_base, amount_in, amount_out, tx_hash, block_time
         FROM swap WHERE proposal_id = $1 ORDER BY block_time DESC LIMIT 100`, [`${governor}-${id}`],
      );
      return c.json({ items: (result.rows as Row[]).map((row) => ({
        id: String(row.id), amm: String(row.amm), poolKind: String(row.pool_kind), sender: String(row.sender),
        to: String(row.to), quoteToBase: Boolean(row.quote_to_base), amountIn: String(row.amount_in),
        amountOut: String(row.amount_out), txHash: String(row.tx_hash), blockTime: Number(row.block_time),
      })), available: true });
    } catch (error) {
      return c.json(unavailable(error instanceof Error ? error.message : "Fuji trade query failed."), 503);
    }
  });

  router.get("/agents", async (c) => {
    if (!pool) return c.json(unavailable("Fuji indexer database is not configured."), 503);
    try {
      const result = await pool.query(
        `SELECT agent_id, COUNT(*) AS forecast_count, AVG(score)::numeric AS average_score
         FROM forecast_score GROUP BY agent_id ORDER BY agent_id DESC LIMIT 100`,
      );
      return c.json({ items: (result.rows as Row[]).map((row) => ({
        agentId: String(row.agent_id), name: `Agent #${String(row.agent_id)}`, role: "Forecaster",
        forecastCount: Number(row.forecast_count), averageScore: row.average_score == null ? null : Number(row.average_score) / 100,
        source: "fuji-index",
      })), available: true });
    } catch (error) {
      return c.json(unavailable(error instanceof Error ? error.message : "Fuji forecast query failed."), 503);
    }
  });

  router.get("/agents/:id", async (c) => {
    const id = c.req.param("id");
    if (!positiveDecimal(id)) return c.json({ error: "Agent ID must be a positive decimal integer." }, 400);
    if (!pool) return c.json({ available: false, reason: "Fuji indexer database is not configured." }, 503);
    try {
      const result = await pool.query(
        `SELECT agent_id, COUNT(*) AS forecast_count, AVG(score)::numeric AS average_score
         FROM forecast_score WHERE agent_id = $1 GROUP BY agent_id`, [id],
      );
      const row = (result.rows as Row[])[0];
      return row ? c.json({ agentId: String(row.agent_id), name: `Agent #${String(row.agent_id)}`, role: "Forecaster", forecastCount: Number(row.forecast_count), averageScore: row.average_score == null ? null : Number(row.average_score) / 100, source: "fuji-index", available: true }) : c.json({ error: "No indexed forecasts were found for this agent." }, 404);
    } catch (error) {
      return c.json({ available: false, error: error instanceof Error ? error.message : "Fuji forecast query failed." }, 503);
    }
  });

  router.get("/projects/:id/contributions", async (c) => {
    const id = c.req.param("id");
    if (!positiveDecimal(id)) return c.json({ error: "Project ID must be a positive decimal integer." }, 400);
    if (!pool) return c.json(unavailable("Fuji indexer database is not configured."), 503);
    try {
      const result = await pool.query(
        `SELECT id, raise, project_id, "user", amount, total_contributed, tx_hash, block_time
         FROM contribution WHERE project_id = $1 ORDER BY block_time DESC LIMIT 100`, [id],
      );
      return c.json({ items: (result.rows as Row[]).map((row) => ({
        id: String(row.id), raise: String(row.raise), projectId: String(row.project_id), user: String(row.user),
        amount: String(row.amount), totalContributed: String(row.total_contributed), txHash: String(row.tx_hash),
        blockTime: Number(row.block_time),
      })), available: true });
    } catch (error) {
      return c.json(unavailable(error instanceof Error ? error.message : "Fuji contribution query failed."), 503);
    }
  });

  router.get("/users/:address/portfolio", async (c) => {
    const address = c.req.param("address").toLowerCase();
    if (!/^0x[a-f\d]{40}$/i.test(address)) return c.json({ error: "A valid EVM address is required." }, 400);
    if (!pool) return c.json({ contributions: [], vaultEvents: [], available: false, reason: "Fuji indexer database is not configured." }, 503);
    try {
      const [contributions, vaultEvents] = await Promise.all([
        pool.query(`SELECT id, project_id, amount, tx_hash, block_time FROM contribution WHERE LOWER("user") = $1 ORDER BY block_time DESC LIMIT 200`, [address]),
        pool.query(`SELECT id, vault, kind, amount, tx_hash, block_time FROM vault_event WHERE LOWER("user") = $1 ORDER BY block_time DESC LIMIT 200`, [address]),
      ]);
      return c.json({
        contributions: (contributions.rows as Row[]).map((row) => ({ id: String(row.id), projectId: String(row.project_id), amount: String(row.amount), txHash: String(row.tx_hash), blockTime: Number(row.block_time) })),
        vaultEvents: (vaultEvents.rows as Row[]).map((row) => ({ id: String(row.id), vault: String(row.vault), eventType: String(row.kind), amount: value(row, "amount"), txHash: String(row.tx_hash), blockTime: Number(row.block_time) })),
        available: true,
      });
    } catch (error) {
      return c.json({ contributions: [], vaultEvents: [], available: false, error: error instanceof Error ? error.message : "Fuji portfolio query failed." }, 503);
    }
  });

  router.get("/stats", async (c) => {
    if (!pool) return c.json({ available: false, source: "unavailable" }, 503);
    try {
      const result = await pool.query(
        `SELECT (SELECT COUNT(*) FROM project) AS projects,
                (SELECT COUNT(*) FROM proposal) AS proposals,
                (SELECT COUNT(*) FROM swap) AS swaps,
                (SELECT COALESCE(SUM(amount), 0) FROM contribution) AS contributed_usdc_raw`,
      );
      const row = (result.rows as Row[])[0] ?? {};
      return c.json({ available: true, source: "fuji-index", projects: String(row.projects ?? "0"), proposals: String(row.proposals ?? "0"), swaps: String(row.swaps ?? "0"), contributedUsdcRaw: String(row.contributed_usdc_raw ?? "0") });
    } catch (error) {
      return c.json({ available: false, error: error instanceof Error ? error.message : "Fuji stats query failed." }, 503);
    }
  });

  return router;
}
