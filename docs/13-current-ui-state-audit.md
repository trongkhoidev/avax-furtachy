# Current interface and data availability audit

The application targets Avalanche Fuji C-Chain (chain ID 43113). It shows projects, proposals, prices, balances, and activity only when they come from verified contract reads or the Fuji indexer. Missing configuration and empty chain state use separate messages.

## Routes

| Route | Current behavior |
|---|---|
| `/` | Fuji proposal markets from the live indexer. An unavailable index and an empty market list have distinct states. Search and state filters operate on returned records. |
| `/explore` | Projects indexed from Fuji Factory events, with create-project link and an explicit unavailable state. |
| `/create` | Validates actual Factory parameters, then submits `createProject` through the connected wallet after a real `eth_call` preflight. The resulting record is the project raise; token, Treasury, Governor, and spot market deploy after successful raise finalization. |
| `/p/[projectId]` | Reads the selected project from the configured Factory and shows its verified raise state, terms, and contract links. Invalid IDs, missing projects, RPC failures, and unavailable configuration are distinguished. |
| `/p/[projectId]/raise` | Reads Raise state and schedule, and exposes approve, contribute, claim, or refund only when on-chain state permits. |
| `/p/[projectId]/propose` | Uses that project's deployed Governor; the wizard reads proposal bond and market liquidity parameters and performs token approvals before the proposal transaction. |
| `/p/[projectId]/proposals` | Lists proposals for that project's Governor from the Fuji indexer. |
| `/proposal/[gov]/[id]` | Resolves a specific Governor and proposal. Pass/Fail trading requires verified outcome pools and the conditional-token preparation flow. |
| `/portfolio` | Shows wallet-connected indexed activity and balances only when the Fuji sources respond. |
| `/agents` and `/agents/[agentId]` | Uses actual registry/indexer records. Agent registration stays unavailable until the identity registry is configured. |
| `/docs` | Explains Fuji wallet setup, official faucets, project lifecycle, proposal markets, and optional integrations. |
| `/about` | Describes the contract lifecycle and marks unconfigured services clearly. |

## Runtime boundaries

- No local market fixture table, fabricated project, sample order, or simulated portfolio is served by the web app or API. The previous PostgreSQL fixture table was dropped.
- `viem.simulateContract` is used only as a real `eth_call` transaction preflight before asking a wallet to sign. It does not create data, broadcast a transaction, or replace a Fuji contract.
- Create-project, raise, proposal, swap, finalize, and treasury actions are wallet transactions against configured Fuji contracts. A receipt is successful only when the chain reports success.
- x402 reports, agent registry writes, and cross-chain execution remain unavailable until their actual providers, registries, or relayers are configured.
- The current local deployment state is unconfigured. The app deliberately shows live-source setup guidance instead of placeholder market activity.
