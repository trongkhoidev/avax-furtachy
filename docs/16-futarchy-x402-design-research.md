# Futarchy and x402 — product research and interface design

**Reviewed:** 9 October 2026  
**Scope:** MetaDAO decision markets, Futarchy Labs documentation, Coinbase x402 flow, and the current WolfDAO Fuji application.

## What the references establish

| Reference | Product/mechanism observed | Design implication for Futara |
|---|---|---|
| [MetaDAO decision-market overview](https://metadao.fi/docs/governance-overview) | MetaDAO describes governance as trading rather than a separate vote. The two conditional markets ask what the project token would be worth if a proposal passed or failed. | Lead a decision page with the two conditional asset prices, and label them as asset values under each outcome—not as the probability of passing. |
| [MetaDAO trading guide](https://metadao.fi/docs/markets) | Traders take conditional exposure to the project token; an order in one branch only settles if that branch occurs. The proposal page also separates trading from the eventual decision. | Keep the order ticket attached to a named Pass/Fail branch, and explain which conditional asset and quote currency are involved. Do not imply that a preview creates a position. |
| [MetaDAO finalization guide](https://metadao.fi/docs/twaps) | The result uses TWAPs rather than a single end-of-window spot price. MetaDAO documents lagged observations, a recording delay, and proposal-type-specific thresholds; the configured DAO parameters remain authoritative. | Show the actual configured TWAP window, delay, threshold, and final values before showing a verdict. Treat a draft threshold as a draft; do not copy MetaDAO's example percentages as universal rules. |
| [Futarchy Labs market launch runbook](https://docs.futarchy.fi/runbooks/launch-a-market/) | A public market should define one resolvable decision, a public source of truth, when the decision becomes final, the outcome assets, the trading and TWAP windows, and the threshold rule. | Surface decision readiness and missing market terms next to the proposal. A title and two sample prices are not enough to produce a trustworthy signal. |
| [Futarchy Labs overview](https://docs.futarchy.fi/) | The broader model separates choosing the objective (“values”) from market participants' beliefs about which action advances it. It recommends starting with advisory signals and increasing automation only as trust grows. | Visually distinguish market evidence from the policy that interprets it, and distinguish an advisory signal from a binding execution rule. |
| [Coinbase x402 flow](https://docs.cdp.coinbase.com/x402/how-it-works) | x402 makes a resource pay-per-request: a server returns a 402 payment quote, a client signs and retries with payment proof, the server verifies, performs the work, settles, and returns the resource and payment confirmation. | Present analysis as a paid data/service request with its own price, network, recipient, provider, and report receipt. Keep it separate from market collateral, trading positions, and governance outcomes. |

MetaDAO's public decision page reinforces the information hierarchy: final Pass/Fail TWAPs and volume first, then a price chart, followed by separate Summary, Instructions, Trades, and Position views. That structure is useful as a market-detail pattern; it should not be copied as if Futara already has those live data sources.

## Current implementation and limits

The application reads project and proposal records from Fuji Factory contracts and the Ponder indexer. It does not include synthetic markets or sample prices. If the indexer is unavailable or no proposal markets exist, the interface shows that state without manufacturing rows.

Proposal detail pages are bound to the Governor and proposal in the route. Trading is enabled only after the actual proposal market and both nonzero outcome AMMs are resolved. The contract write path uses a real `eth_call` preflight before wallet signing; it does not create local market data or report a reverted receipt as successful.

x402 analysis remains unavailable until a real report provider, facilitator, settlement recipient, and Fuji USDC configuration are present. The API returns an unavailable response instead of a sample report or payment offer.

## Visual hierarchy for the live proposal experience

1. **Decision:** proposal action, sponsor, lifecycle state, and source link.
2. **Market evidence:** both conditional asset prices, timestamp/observation source, relative gap, volume/depth when indexed, and the exact TWAP rule.
3. **Decision readiness:** objective, action scope, outcome definition, finalization time, oracle/source, and missing fields.
4. **Trading:** branch-specific ticket, quote, impact, fee, slippage, and position state from the connected execution path.
5. **Agent services:** provider identity/reputation, what the response contains, tier price, supported network/asset, x402 authorization and settlement status, and the verified receipt.

The market tells a user what evidence participants are pricing. x402 only pays for an analysis/data response. Neither should be used as a visual proxy for the other.
