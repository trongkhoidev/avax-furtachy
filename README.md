# WolfDAO — Futarchy Governance & Launchpad on Avalanche

[![Network: Avalanche Fuji](https://img.shields.io/badge/Network-Avalanche%20Fuji%20(43113)-red)](https://testnet.snowtrace.io)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black)](https://nextjs.org)
[![Foundry](https://img.shields.io/badge/Contracts-Foundry%20Solidity-orange)](https://getfoundry.sh)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-blue)](https://turbo.build)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**WolfDAO** is an institutional-grade decentralized launchpad and prediction-market governance protocol deployed on **Avalanche Fuji C-Chain** (Chain ID `43113`). Treasuries and strategic protocol proposals are governed through **Pass/Fail conditional decision markets** (Futarchy) — enabling token holders to price the consequences of a governance decision before capital is committed or executed.

---

## 🌟 Core Architecture & Futarchy Mechanics

```
                         ┌──────────────────────────────────────┐
                         │         Avalanche Fuji C-Chain       │
                         │              (Chain 43113)           │
                         └──────────────────┬───────────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               │                            │                            │
      ┌────────▼────────┐          ┌────────▼────────┐          ┌────────▼────────┐
      │  FutaraFactory  │          │ FutarchyGovernor│          │  Ponder Indexer │
      │  • ProjectToken │          │ • Pass AMM      │          │  • Event Stream │
      │  • Raise (USDC) │          │ • Fail AMM      │          │  • PostgreSQL   │
      │  • Treasury     │          │ • Vault (Split) │          │  • Real-time DB │
      └────────┬────────┘          └────────┬────────┘          └────────┬────────┘
               │                            │                            │
               └────────────────────────────┼────────────────────────────┘
                                            │
                                   ┌────────▼────────┐
                                   │  Next.js 15 Web │
                                   │  & Hono API     │
                                   └─────────────────┘
```

1. **Fair Launchpad & Raises**: Projects launch via `FutaraFactory`. Supporters contribute Fuji test USDC to the `Raise` contract with strict hard-caps and minimum thresholds.
2. **Conditional Vault & Token Splitting**: For every active proposal, users can split underlying tokens into outcome pairs ($Pass$ and $Fail$) to trade in respective `DecisionAMM` pools.
3. **Market-Determined Governance**: Proposals only execute if the time-weighted average price (TWAP) of the **Pass Market** exceeds the **Fail Market** by the configured threshold at market close.
4. **Verified Live Indexing**: Fully verified events are indexed in real-time with Ponder into PostgreSQL and served via a high-throughput Hono API.

---

## 🌐 Network Specifications (Avalanche Fuji)

- **Network Name**: Avalanche Fuji Testnet
- **Chain ID**: `43113`
- **RPC URL**: `https://api.avax-test.network/ext/bc/C/rpc`
- **Native Currency**: `AVAX` (18 decimals)
- **Official Fuji USDC**: `0x5425890298aed601595a70AB815c96711a31Bc65` (6 decimals)
- **Explorer**: [https://testnet.snowtrace.io](https://testnet.snowtrace.io)

---

## 🚰 Testnet Faucet Runbook

To interact with WolfDAO on Avalanche Fuji, you need test **AVAX** (for gas) and test **USDC** (for raises and market liquidity):

### 1. Test AVAX (Gas Token)
- **Core App Official Faucet**: [https://core.app/tools/testnet-faucet/?subnet=c&token=c](https://core.app/tools/testnet-faucet/?subnet=c&token=c)  
  *Connect your wallet or enter your EVM address to receive 0.5 – 2 test AVAX.*
- **QuickNode Fuji Faucet**: [https://faucet.quicknode.com/avalanche/fuji](https://faucet.quicknode.com/avalanche/fuji)
- **Chainlink Faucet**: [https://faucets.chain.link/fuji](https://faucets.chain.link/fuji)

### 2. Test USDC Token
- **Circle USDC Faucet**: [https://faucet.circle.com/](https://faucet.circle.com/)  
  *Select network **Avalanche Fuji**, enter your EVM address, and receive 10 test USDC.*

---

## 📁 Repository Structure

```
avax-furtachy/
├── apps/
│   ├── web/         # Responsive Next.js 15 Web Application with Web3 wallet support
│   ├── api/         # High-performance Hono API server for indexed query reads
│   ├── indexer/     # Real-time blockchain event indexer powered by Ponder
│   ├── keeper/      # Automated upkeep worker for raise finalization and TWAP cranks
│   └── agents/      # Autonomous AI forecasters & ERC-8004 reputation agent service
├── packages/
│   ├── contracts/   # Production Foundry Solidity contracts (Factory, AMM, Governor)
│   └── sdk/         # Shared protocol math, metadata hashing, and formatting utilities
├── docs/            # In-depth architectural runbooks and technical specifications
└── docker-compose.yml # Local PostgreSQL stack for indexer storage
```

---

## 🚀 Quickstart & Local Development

### Prerequisites
- Node.js `>= 22.0.0`
- `pnpm >= 9.0.0`
- Foundry (`forge`, `cast`)
- Docker (for PostgreSQL indexer)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/trongkhoidev/avax-furtachy.git
cd avax-furtachy

# 2. Install monorepo dependencies
pnpm install

# 3. Setup environment configuration
cp .env.example .env

# 4. Start PostgreSQL container
pnpm db:up

# 5. Run local development stack
pnpm dev:fuji
```

- Web Client: [http://localhost:3000](http://localhost:3000) (or `http://localhost:3010`)
- API Server: [http://localhost:8787](http://localhost:8787)
- PostgreSQL: `localhost:5432`

---

## 🛠️ Smart Contract Compilation & Deployment

### Run Unit Tests
Contracts are rigorously verified with comprehensive Foundry unit tests:
```bash
pnpm contracts:test
```

### Deploy to Avalanche Fuji
Set your `DEPLOYER_PRIVATE_KEY` and verify `USDC_ADDRESS` in `.env`:
```bash
pnpm deploy:fuji
```
The script deploys the core protocol contracts (`FutaraFactory`, `FutaraRouter`, `ProjectToken`, `Treasury`, `FutarchyGovernor`, `DecisionAMM`, `ConditionalVault`) and exports deployment artifacts to `packages/contracts/deployments/fuji.json`.

---

## 🚢 Vercel Deployment

The web app is optimized for seamless deployment on Vercel:

1. Push your repository to GitHub: `https://github.com/trongkhoidev/avax-furtachy`.
2. In your Vercel Dashboard, click **Add New Project** and select `avax-furtachy`.
3. Configure the build settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
4. Configure Environment Variables in Vercel:
   - `NEXT_PUBLIC_CHAIN_ID=43113`
   - `NEXT_PUBLIC_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc`
   - `NEXT_PUBLIC_USDC_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65`
   - `NEXT_PUBLIC_FACTORY_ADDRESS=<YOUR_DEPLOYED_FACTORY_ADDRESS>`
   - `NEXT_PUBLIC_API_URL=<YOUR_API_URL>`

Or deploy directly via Vercel CLI:
```bash
cd apps/web
npx vercel --prod
```

---

## 🧪 Verification & Quality Control

Ensure code quality across all packages:
```bash
pnpm typecheck   # Typecheck monorepo across all apps and packages
pnpm test        # Run unit test suites
pnpm build       # Production bundle verification
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
