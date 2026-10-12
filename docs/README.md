# WolfDAO documentation

WolfDAO is an Avalanche Fuji project-launch and futarchy-governance application. Current interface and service behavior is driven by verified Fuji contract reads and indexed events. No synthetic market records or local market simulator are part of the runtime.

## Operational guides

| Document | Purpose |
|---|---|
| [Avalanche Fuji runbook](avalanche-fuji-runbook.md) | Official faucet links, local configuration, deployment, indexer startup, and on-chain smoke test. |
| [Current UI audit](13-current-ui-state-audit.md) | Current routes, their live sources, and feature availability. |
| [Market UI benchmark](15-market-ui-benchmark.md) | Reference patterns from prediction-market products. |
| [Futarchy and x402 research](16-futarchy-x402-design-research.md) | Research notes and current product implications. |

Documents 01–12 and 18 are historical product and planning references. Their proposed seed data, short development schedules, and demo scripts are not current runtime behavior or supported commands. Optional ERC-8004, x402, and cross-chain features remain unavailable until their external contracts and services are configured.

## Source of truth

- Solidity behavior: `packages/contracts/src/` and its Foundry tests.
- Fuji addresses: `packages/contracts/deployments/fuji.json` after deployment.
- Indexed on-chain data: `apps/indexer/` schemas and handlers, queried by `apps/api/`.
- App configuration: `.env.example` plus the local, untracked `.env`.
- Design tokens and screen rules: [the current WolfDAO design system](../DESIGN.md).

For deployment and smoke-testing steps, follow the [Fuji runbook](avalanche-fuji-runbook.md). Historical notes should not be used to configure or operate the current services.
