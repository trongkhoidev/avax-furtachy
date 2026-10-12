# 09 — Tech stack, cấu trúc repo, DevOps

> Tài liệu kế hoạch lịch sử. Các cấu hình và lệnh bên dưới không mô tả runtime hiện tại; xem `README.md` và `docs/avalanche-fuji-runbook.md` để vận hành workspace.

## 1. Tech stack

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Smart contracts | Solidity ^0.8.24, **Foundry** (forge, cast, anvil), OpenZeppelin v5 | Test nhanh, fuzz/invariant có sẵn, fork Fuji dễ |
| ICM/ICTT | `ava-labs/icm-contracts` (Teleporter interfaces, ICTT TokenHome/TokenRemote) | Chuẩn chính thức của Avalanche |
| Chain client | **viem** + **wagmi v2** | Type-safe, chuẩn hiện nay |
| Frontend | **Next.js 15** (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (tùy chỉnh theo tokens file 08), **TanStack Query** | Nhanh, Codex/Stitch dễ sinh code |
| Wallet | wagmi connectors: injected (Core, MetaMask, Rabby), WalletConnect; **RainbowKit** hoặc **ConnectKit** | Core wallet của Avalanche dùng được qua injected |
| Chart | **lightweight-charts** (TradingView) cho giá, hoặc **visx/Recharts** cho split chart tùy biến | Split chart cần custom band nên ưu tiên visx |
| Indexer | **Ponder** + Postgres 16 | Factory pattern cho clone contract, TypeScript |
| API | **Hono** trên Node 20 | Nhẹ, có middleware x402 |
| x402 | `@x402/core`, `@x402/evm`, `@x402/fetch`, middleware server tương ứng; facilitator PayAI/thirdweb hoặc self-host | Hỗ trợ `avalanche-fuji` |
| ERC-8004 | Contract đã deploy trên Fuji + ABI riêng; tùy chọn `agent0-sdk` nếu hỗ trợ Fuji | |
| Agents | Node 20, TypeScript, viem, LLM SDK (Anthropic/OpenAI, chọn qua env), **zod** cho JSON schema, SQLite (better-sqlite3) cho state nội bộ | |
| Storage | IPFS qua Pinata (hoặc web3.storage); fallback Supabase Storage | |
| Monorepo | **pnpm workspaces + Turborepo** | |
| Lint/format | ESLint, Prettier, `forge fmt`, solhint | |
| Test TS | Vitest | |
| CI | GitHub Actions | |
| Deploy | Frontend: Vercel. API/indexer/keeper/agents: Railway hoặc Fly.io (Docker). Postgres: Neon/Supabase | |

## 2. Cấu trúc monorepo

```
futara/
├── apps/
│   ├── web/                    # Next.js
│   │   ├── app/                # routes theo file 08
│   │   ├── components/         # component library
│   │   ├── lib/                # wagmi config, contracts, formatters
│   │   └── styles/tokens.css   # design tokens
│   ├── api/                    # Hono
│   │   ├── src/routes/
│   │   ├── src/x402/
│   │   └── src/services/
│   ├── indexer/                # Ponder
│   │   ├── ponder.config.ts
│   │   ├── ponder.schema.ts
│   │   └── src/handlers/
│   ├── keeper/
│   └── agents/                 # runtime + 3 agent (file 05)
├── packages/
│   ├── contracts/              # Foundry project
│   │   ├── src/                # theo cây ở file 04
│   │   ├── test/
│   │   ├── script/             # Deploy.s.sol
│   │   └── foundry.toml
│   ├── sdk/                    # ABI (generated), địa chỉ, helper đọc/ghi, math (TWAP, Brier) dùng chung TS
│   ├── schemas/                # zod schema: metadata, report, registration file
│   └── config/                 # eslint, tsconfig chung
├── deployments/
│   ├── fuji.json               # địa chỉ đã deploy + external (USDC, ERC-8004, Teleporter)
│   └── educhain.json
├── docs/                       # bộ tài liệu này
├── docker-compose.yml          # postgres, (tùy chọn) icm-relayer
├── turbo.json
└── package.json
```

`packages/sdk` sinh ABI từ `forge build` bằng **wagmi CLI** (`@wagmi/cli` plugin foundry), để web, api, indexer, keeper và agents dùng cùng một nguồn ABI.

## 3. Biến môi trường

```bash
# chung
CHAIN_ID=43113
RPC_URL_FUJI=https://api.avax-test.network/ext/bc/C/rpc
RPC_URL_L1=
FACTORY_ADDRESS=
USDC_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65   # xác minh lại
ERC8004_IDENTITY=0x8004A818BFB912233c491871b3d84c89A494BD9e # xác minh lại
ERC8004_REPUTATION=0x8004B663056A597Dffe9eCcC1965A193B7388713 # xác minh lại
TELEPORTER_MESSENGER=          # lấy từ Builder Hub / icm-contracts release

# contracts deploy
DEPLOYER_PK=

# api
DATABASE_URL=
PINATA_JWT=
X402_FACILITATOR_URL=https://facilitator.payai.network
X402_PAYTO_PROTOCOL=
X402_NETWORK=avalanche-fuji

# keeper
KEEPER_PK=
KEEPER_TICK_MS=5000

# agents (mỗi instance một file .env)
AGENT_ROLE=trader
AGENT_ID=
AGENT_PK=
AGENT_OWNER_PK=                # chỉ dùng lúc register
LLM_PROVIDER=anthropic
LLM_API_KEY=
LLM_MODEL=
X402_MAX_PER_REQUEST=100000    # 0.1 USDC (6 dec)

# web
NEXT_PUBLIC_CHAIN_ID=43113
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WALLETCONNECT_ID=
```

**Không commit file `.env`.** Có `.env.example` cho từng app.

## 4. Scripts

| Lệnh | Mô tả |
|---|---|
| `pnpm i` | Cài đặt |
| `pnpm contracts:build` / `:test` / `:coverage` | Foundry |
| `pnpm contracts:fork-test` | Test tích hợp trên fork Fuji |
| `pnpm contracts:deploy:fuji` | `forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify` → ghi `deployments/fuji.json` |
| `pnpm sdk:gen` | Sinh ABI/type |
| `pnpm dev` | Turbo chạy web + api + indexer + keeper |
| `pnpm l1:deploy` | Deploy ICTT + executor + GameConfig lên L1 |

## 5. Verify contract
- Verify trên explorer Fuji (Snowtrace/Routescan) để giám khảo đọc được code. Foundry `--verify` với verifier phù hợp (Routescan hỗ trợ API kiểu Etherscan cho Avalanche). Kiểm tra cấu hình verifier hiện hành của Avalanche.
- Implementation được verify. Clone (minimal proxy) sẽ tự hiển thị là proxy trên explorer.

## 6. CI (GitHub Actions)
- `contracts.yml`: `forge fmt --check`, `forge build`, `forge test -vvv`, coverage report (comment lên PR).
- `ts.yml`: lint, typecheck, vitest cho `sdk`, `api`, `agents`.
- `web.yml`: `next build`.

## 7. Chuẩn code
- Solidity: NatSpec cho mọi hàm external. Custom error thay cho string revert (trừ chỗ ghi rõ). Event cho mọi thay đổi state. Thứ tự checks-effects-interactions. `nonReentrant` cho hàm chuyển tiền.
- TypeScript: strict mode, không dùng `any`. Mọi số on-chain dùng `bigint`. Format số bằng helper chung trong `sdk`.
- Commit theo Conventional Commits.

## 8. Hướng dẫn dùng tài liệu với AI coding agent (Codex v.v.)

Đề xuất chia task theo thứ tự phụ thuộc, mỗi task đưa kèm các file tài liệu liên quan:

| Thứ tự | Task | Tài liệu đưa kèm |
|---|---|---|
| 1 | Scaffold monorepo, config, CI | 09 |
| 2 | `FutaraTypes`, `DecisionAMM` + TWAP + test | 02 (mục 5–6), 04 (mục 1, 8) |
| 3 | `ConditionalVault`/`ConditionalToken` + invariant test | 02 (mục 4), 04 (mục 7) |
| 4 | `Raise`, `ProjectToken`, `Treasury`, `PerformancePackage`, `FutaraFactory` | 02 (mục 2), 04 (mục 2–5, 9) |
| 5 | `FutarchyGovernor`, `FutaraRouter` + test tích hợp | 02 (mục 3, 7), 04 (mục 6, 10) |
| 6 | `ForecastRegistry`, `ReputationReporter` (fork Fuji với ERC-8004 thật) | 04 (mục 11–12), 05 (mục 3) |
| 7 | Deploy scripts | 09, 02 (mục 9) |
| 8 | Indexer | 07 (mục 2) |
| 9 | API + x402 endpoints | 07 (mục 3), 05 (mục 4) |
| 10 | Keeper | 07 (mục 4) |
| 11 | Agent runtime + 3 agent | 05 |
| 12 | Web app (từ thiết kế Stitch) | 08, 07 (API) |
| 13 | L1 + ICTT + ICM contracts & UI tab Chains | 06 |
| 14 | Demo rehearsal, slide | 11 |

Mỗi task nên có tiêu chí "Done" (definition of done): test pass, có event, có NatSpec, cập nhật `deployments/*.json` nếu deploy.
