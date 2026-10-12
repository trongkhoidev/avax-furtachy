# Market UI benchmark and design direction

Reviewed the public market interfaces and product documentation from Kalshi, Manifold, and Futarchy Labs while redesigning the local exchange screen.

## Patterns worth adapting

- **Kalshi Browse** groups markets by topic and presents compact event cards with visible outcome prices and volume. **Kalshi Pro** uses a scan-first table: Yes/No prices, top-of-book size, spread, 24-hour volume, recent buying share, and a short price sparkline; it collapses lower-priority columns on smaller screens. Sources: [Kalshi Browse Markets](https://kalshi.com/browse), [Kalshi Pro market scanning](https://kalshi.com/pro/help/markets-scanning-filtering-searching).
- **Futarchy Labs** separates a proposal into two conditional markets: the asset price if approved and the price if rejected. The decision signal compares those prices rather than treating either as a standalone probability. Sources: [Trading in Futarchy Markets](https://docs.futarchy.fi/trading-in-futarchy/), [How Futarchy Works](https://docs.futarchy.fi/how-futarchy-works/).
- **Manifold** makes the trade consequences part of the decision: amount, payout, and the resulting probability matter alongside the displayed price. Our local preview adopts the amount-to-estimate hierarchy, while order submission stays unavailable because there is no executable market. Source: [Manifold market mechanics FAQ](https://docs.manifold.markets/faq).

## Direction applied to WolfDAO

1. Put a clear Pass/Fail conditional price pair in the first viewport. Keep proposal #3 labeled as a static documented example and show its unresolved state beside the price gap.
2. Make the market board scannable: proposal name, Pass and Fail prices, derived spread, synthetic volume, synthetic liquidity, 24-hour change, and state.
3. Add topic filters beside the existing status filters and search, following the catalog patterns users already know from event-market exchanges.
4. Use mint and amber to distinguish the two conditional price series on the dark graphite WolfDAO canvas. Keep the coral brand accent for interaction and alerts.
5. Keep demo data truthful. Do not add sparklines, order-book depth, recent trade prints, or animated price changes until the database contains sourced observations for them. The shown order estimate is local arithmetic only.
