# 07 — Backend: Indexer, API, Keeper

## 1. Tổng quan

| Service | Stack | Port | Mô tả |
|---|---|---|---|
| `indexer` | Ponder (TypeScript) + Postgres | 42069 | Index event của mọi contract Futara + ERC-8004 registry, cung cấp GraphQL/SQL |
| `api` | Hono (Node 20+) | 8787 | REST cho frontend, upload metadata, endpoint x402 trả phí, aggregate dữ liệu |
| `keeper` | Node script (viem) | — | Crank TWAP, activate/finalize/execute, report reputation, sweep |
| `agents` | Xem file 05 | 8801–8810 | Analyst có HTTP server x402 |

Tất cả nằm trong monorepo (file 09). Chạy local bằng `docker compose` (Postgres) và `pnpm dev`.

## 2. Indexer (Ponder)

### 2.1. Contract được index

- `FutaraFactory` (địa chỉ cố định).
- Các contract clone, dùng **factory pattern của Ponder**: lấy địa chỉ từ event `ProjectCreated`, `ProjectLive` và `ProposalCreated` để tự động index `Raise`, `Treasury`, `FutarchyGovernor`, `DecisionAMM` (spot/pass/fail), `ConditionalVault`. Vì market clone được governor (một clone cấp hai) tạo ra, FutaraFactory phát thêm `ProposalMarketsCreated` ngay sau khi cấp địa chỉ clone và trước log khởi tạo vault/AMM; Ponder dùng event cố định này để bắt cả hoạt động khởi tạo đầu tiên.
- `ForecastRegistry`, `ReputationReporter`.
- ERC-8004 `IdentityRegistry` (event `Transfer`/`Registered`, `MetadataSet`/URI update) và `ReputationRegistry` (event feedback). **Chỉ lưu agent có liên quan Futara** (agent từng commit forecast hoặc đăng ký qua API), hoặc lưu toàn bộ nếu ít.
- `GovernanceMessenger` (C-Chain) và `L1GovernanceExecutor` (L1, network thứ 2 trong config Ponder).

### 2.2. Schema (bảng chính)

```ts
// ponder.schema.ts (rút gọn, kiểu theo onchainTable)
project {
  id: bigint (projectId) PK
  founder: hex
  raise, token, treasury, governor, spotAmm, performancePackage: hex
  name, symbol: text
  metadataURI: text; metadataHash: hex
  state: text            // Raising | Failed | Live
  minRaise, hardCap, totalContributed, acceptedTotal: bigint
  raiseStart, raiseEnd: bigint
  priceRaiseE18: bigint
  createdAt: bigint
}

contribution { id PK; projectId; user: hex; amount: bigint; txHash; blockTime }
claim        { id PK; projectId; user; tokens; refund; txHash; blockTime }

proposal {
  id: text PK            // `${governor}-${proposalId}`
  projectId: bigint; proposalId: bigint
  proposer: hex
  descriptionURI: text; descriptionHash: hex
  title: text            // lấy từ JSON (fetch khi index, có cache)
  state: text; outcome: text
  createdAt, tradingStart, tradingEnd, executionDeadline: bigint
  vaultUsdc, vaultToken, passAmm, failAmm: hex
  seedPriceE18, twapPassE18, twapFailE18: bigint
  actionsJson: json      // decode actions để hiển thị
}

swap {
  id PK; amm: hex; poolKind: text (spot|pass|fail); proposalId?: text
  sender: hex; to: hex; quoteToBase: boolean
  amountIn, amountOut, reserveBase, reserveQuote, priceE18: bigint
  txHash; blockTime
}

twapPoint { id PK; amm; observationE18; spotE18; time }     // vẽ chart TWAP vs spot
liquidityEvent { id PK; amm; provider; baseAmt; quoteAmt; shares; kind; time }
vaultEvent { id PK; vault; kind (split|merge|redeem); user; amount; time }

treasurySnapshot { id PK; treasury; usdc; token; time }       // ghi sau mỗi Executed/BudgetClaimed
budgetClaim { id PK; treasury; to; amount; time }

agent {
  agentId: bigint PK
  owner: hex; agentWallet: hex
  uri: text; name: text; role: text; image: text
  x402Endpoints: json
  registeredAt: bigint
}
forecast { id PK; governor; proposalId; agentId; commitHash; committedAt; pPassBps?; revealedAt? }
feedback {
  id PK; agentId; client: hex; value: bigint; decimals: int
  tag1, tag2, endpoint, feedbackURI: text; feedbackHash: hex; time
}
agentPosition { id PK; agentId; proposalId; netPassToken; netFailToken; costUsdc; pnlUsdc }

crossChainMessage { id PK (messageID); projectId; blockchainID; nonce; proposalId; sentAt; executedAt?; status }
```

### 2.3. Dữ liệu tính toán (computed)

Ponder handler tính sẵn khi index:
- `swap.priceE18` sau mỗi swap.
- Candle 1 phút / 15 phút / 1 giờ cho spot, pass và fail pool (bảng `candle`).
- `agentPosition` cập nhật khi agentWallet swap/split/merge/redeem.
- `leaderboard` view: tính theo công thức ở file 05, mục 3.6, trong API (không cần lưu bảng).

## 3. API (Hono)

### 3.1. Quy ước
- Base URL: `/api/v1`. JSON, số lớn trả về dạng **string** (bigint), kèm field `decimals`.
- Phân trang: `?cursor=&limit=` (mặc định 20, tối đa 100).
- CORS cho domain web app.
- Endpoint public miễn phí cho UI. Endpoint x402 dưới `/x402/v1` (xem file 05, mục 4.3).

### 3.2. Endpoint miễn phí

| Method | Path | Mô tả |
|---|---|---|
| GET | `/projects?state=&sort=` | Danh sách project (card) |
| GET | `/projects/:id` | Chi tiết: metadata, raise stats, token, treasury, giá spot, TWAP, proposal hiện tại |
| GET | `/projects/:id/contributions?user=` | Lịch sử góp vốn |
| GET | `/projects/:id/treasury/history` | Snapshot treasury theo thời gian |
| GET | `/projects/:id/proposals` | Danh sách proposal |
| GET | `/proposals/:gov/:id` | Chi tiết proposal + actions decoded + giá hiện tại 2 pool + TWAP hiện tại + trạng thái quyết định tạm tính |
| GET | `/proposals/:gov/:id/chart?interval=1m` | Chuỗi thời gian: spot pass, spot fail, obs pass, obs fail, ngưỡng |
| GET | `/proposals/:gov/:id/trades` | Lệnh gần đây (đánh dấu agent nếu sender là agentWallet) |
| GET | `/proposals/:gov/:id/forecasts` | Forecast của agent (commit/reveal), chỉ hiện pPass sau reveal |
| GET | `/proposals/:gov/:id/analyses` | Danh sách báo cáo có bán: agent, giá, tier, rating. **Không trả nội dung** |
| GET | `/agents?role=&sort=score` | Leaderboard |
| GET | `/agents/:agentId` | Hồ sơ: registration file, điểm, lịch sử forecast, PnL, endpoint x402 |
| GET | `/agents/:agentId/feedback` | Feedback ERC-8004 |
| GET | `/users/:address/portfolio` | Token, conditional token, LP, việc cần làm (claim, redeem) |
| GET | `/stats` | Tổng TVL, số project, số proposal, volume, tổng x402 settled |
| POST | `/metadata` | Upload JSON (project/proposal/agent), validate schema, pin IPFS, trả `{ uri, hash }` |
| POST | `/agents/register` | Agent ký message để liên kết agentId với endpoint/role (dùng cho hiển thị) |
| GET | `/chains/:projectId` | Thông tin L1 đã kết nối + trạng thái message ICM |

### 3.3. Endpoint "decision preview"

`GET /proposals/:gov/:id/decision` trả:
```json
{
  "twapPass": "71000000000000000",
  "twapFail": "38000000000000000",
  "thresholdBps": 300,
  "currentLeaning": "PASS",
  "marginPct": 86.8,
  "secondsLeft": 5400,
  "note": "Tạm tính từ observation hiện tại, kết quả cuối có thể khác"
}
```
Công thức tạm tính dùng `aggregator` hiện tại (đọc trực tiếp contract), không chờ indexer.

### 3.4. Schema metadata

**Project metadata**
```json
{
  "name": "EduChain",
  "tagline": "Học Web3 qua game",
  "description": "markdown",
  "logo": "ipfs://...",
  "banner": "ipfs://...",
  "links": { "website": "", "x": "", "github": "", "telegram": "" },
  "team": [{ "name": "", "role": "", "x": "" }],
  "roadmap": [{ "quarter": "Q1 2027", "items": [""] }],
  "useOfFunds": [{ "category": "Dev", "pct": 50 }],
  "l1": { "blockchainID": "0x...", "rpc": "", "name": "EduChain" }
}
```

**Proposal metadata**
```json
{
  "title": "Thuê agency marketing 3 tháng",
  "summary": "≤ 280 ký tự",
  "body": "markdown: bối cảnh, mục tiêu, KPI, ngân sách chi tiết, rủi ro",
  "category": "spending|parameter|crosschain|other",
  "kpis": [{ "metric": "DAU", "target": "5000", "deadline": "2027-03-01" }],
  "attachments": [{ "name": "", "uri": "" }],
  "actionsHuman": ["Chuyển 30,000 USDC cho 0xabc… (Agency X)"]
}
```

`hash = keccak256(utf8(JSON canonical))` (canonical: sắp key theo thứ tự alphabet, không khoảng trắng). Client tự tính lại để xác nhận khớp với hash on-chain.

## 4. Keeper

Một process, chạy vòng lặp mỗi `KEEPER_TICK` (mặc định 15 giây, demo 5 giây):

| Job | Điều kiện | Gọi |
|---|---|---|
| `crankTwap` | Proposal Trading, `now ≥ lastUpdate + minUpdateInterval` của pool | `passAmm.crank()`, `failAmm.crank()`; spot pool mỗi `minUpdateInterval` |
| `activate` | Proposal Pending và hết warmup | `governor.activate(id)` |
| `finalize` | Trading và `now ≥ tradingEnd` | `governor.finalize(id)` |
| `execute` | Passed và chưa Executed (finalize đã thử execute nhưng lỗi) | `governor.execute(id)` (retry có backoff) |
| `markExecutionFailed` | Passed và quá deadline | |
| `finalizeRaise` | Raise Active và `now ≥ endTime` | `raise.finalize()` |
| `reportReputation` | Proposal finalized, forecast đã reveal, hết reveal window | `reporter.reportBatch(gov, id, agentIds)` |
| `unlockMilestone` | Mỗi giờ (demo: mỗi phút) | `performancePackage.unlockNext()` nếu điều kiện đạt (simulate trước) |

Yêu cầu:
- Simulate (`eth_call`) trước khi gửi tx. Không gửi tx sẽ revert.
- Nonce manager, gas cap, cảnh báo khi số dư AVAX thấp.
- Idempotent: nhiều keeper chạy song song không gây lỗi nghiêm trọng (tx thứ hai revert là chấp nhận được).
- Log có cấu trúc (pino) và endpoint `/health`.

## 5. Bảo mật backend
- API không bao giờ giữ private key người dùng.
- Keeper key chỉ có AVAX gas, không giữ tài sản khác.
- Rate limit `/metadata` (theo IP + chữ ký ví) để tránh spam pin IPFS.
- Validate mọi JSON bằng zod. Giới hạn kích thước 256 KB.
- Endpoint x402 chỉ trả nội dung sau khi facilitator **settle** thành công (không chỉ verify).
