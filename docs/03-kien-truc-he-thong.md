# 03 — Kiến trúc hệ thống

## 1. Sơ đồ tổng thể

```mermaid
flowchart TB
    subgraph Users["Người dùng"]
        F[Founder]
        B[Backer / Trader]
        O[Agent Operator]
    end

    subgraph Web["Web App (Next.js)"]
        UI[UI: Launchpad, Market, Agents]
    end

    subgraph Offchain["Off-chain services"]
        API[Futara API<br/>REST + x402 paid endpoints]
        IDX[Indexer<br/>Ponder + Postgres]
        KEEP[Keeper / Crank bot]
        IPFS[(IPFS / object storage<br/>proposal JSON, agent card)]
        subgraph Agents["Agent Runtime"]
            AN[Analyst Agent<br/>bán phân tích qua x402]
            TR[Trader Agent<br/>mua phân tích, trade]
            MM[Market Maker Agent]
        end
        FAC[x402 Facilitator<br/>PayAI / thirdweb / self-hosted]
        LLM[(LLM API)]
    end

    subgraph CChain["Avalanche C-Chain (Fuji 43113)"]
        FACT[FutaraFactory]
        RAISE[Raise]
        TOK[ProjectToken]
        TRS[Treasury]
        GOV[FutarchyGovernor]
        VAULT[ConditionalVault x2/proposal]
        AMM[DecisionAMM<br/>pass / fail / spot]
        PERF[PerformancePackage]
        FR[ForecastRegistry]
        REP[ReputationReporter]
        ROUTER[FutaraRouter]
        GM[GovernanceMessenger]
        ID8004[ERC-8004 IdentityRegistry]
        RP8004[ERC-8004 ReputationRegistry]
        USDC[USDC Fuji]
        TELE[TeleporterMessenger]
        HOME[ERC20TokenHome ICTT]
    end

    subgraph L1["Project Avalanche L1 (tùy chọn)"]
        REM[ERC20TokenRemote ICTT]
        EXE[L1GovernanceExecutor]
        APP[App contract của dự án]
    end

    F & B --> UI
    O --> Agents
    UI --> API
    UI -->|wallet tx| CChain
    API --> IDX
    IDX -->|đọc event| CChain
    KEEP -->|crank, finalize, execute, report| CChain
    AN & TR & MM -->|tx| CChain
    TR -->|x402 HTTP| AN
    TR -->|x402 HTTP| API
    UI -->|x402 HTTP| API
    AN & API -->|verify/settle| FAC
    FAC -->|transferWithAuthorization| USDC
    AN & TR --> LLM
    AN & TR & MM -->|register / read| ID8004
    REP -->|giveFeedback| RP8004
    GOV --> GM --> TELE -.ICM.-> EXE --> APP
    HOME -.ICTT.-> REM
```

## 2. Danh sách thành phần

| # | Thành phần | Loại | Trách nhiệm | Chi tiết |
|---|---|---|---|---|
| 1 | Smart contracts core | Solidity | Launchpad, futarchy, AMM, TWAP, treasury | file 04 |
| 2 | Agent contracts | Solidity | ForecastRegistry, ReputationReporter (gọi ERC-8004) | file 04, 05 |
| 3 | Cross-chain contracts | Solidity | GovernanceMessenger, L1GovernanceExecutor, ICTT | file 06 |
| 4 | Indexer | TypeScript (Ponder) | Đọc event, build bảng truy vấn, tính dữ liệu biểu đồ | file 07 |
| 5 | Futara API | TypeScript (Hono) | REST cho frontend, endpoint x402 trả phí, upload metadata | file 07 |
| 6 | Keeper | TypeScript | Crank TWAP, activate/finalize/execute proposal, report reputation | file 07 |
| 7 | Agent runtime | TypeScript | 3 loại agent, ví riêng, LLM, x402 client & server | file 05 |
| 8 | Web app | Next.js | Toàn bộ UI | file 08 |
| 9 | Storage | IPFS (Pinata/web3.storage) hoặc S3 | Proposal JSON, project metadata, agent registration file, báo cáo phân tích | file 07 |

## 3. Nguyên tắc kiến trúc

1. **On-chain là nguồn sự thật.** Mọi quyết định và luồng tiền nằm on-chain. Indexer/API chỉ là cache để đọc nhanh, nếu mất thì có thể dựng lại từ event.
2. **Mọi hàm "đẩy trạng thái" đều permissionless.** Ví dụ `crank`, `activate`, `finalize`, `execute`, `reportForecast`. Keeper chỉ là tiện ích, không phải điểm tin cậy.
3. **Agent là người dùng bình thường.** Agent không có quyền đặc biệt nào trong contract. Agent tương tác như mọi EOA khác. Danh tính ERC-8004 chỉ dùng để gắn reputation.
4. **Không lưu private key người dùng.** Web app dùng ví (Core, MetaMask, Rabby) qua wagmi. Agent dùng private key riêng trong env/secret manager.
5. **Hash mọi metadata off-chain.** `descriptionHash = keccak256(json bytes)` được lưu on-chain để chống sửa nội dung proposal sau khi đăng.

## 4. Luồng chính (sequence diagrams)

### 4.1. Tạo project và raise

```mermaid
sequenceDiagram
    actor F as Founder
    participant UI
    participant API
    participant FACT as FutaraFactory
    participant R as Raise
    actor B as Backer

    F->>UI: Điền form project
    UI->>API: POST /metadata (JSON) → URI + hash
    F->>FACT: createProject(config, metadataURI, hash)
    FACT->>R: deploy (clone) Raise
    FACT-->>UI: event ProjectCreated(projectId, raise)
    B->>R: approve USDC + contribute(amount)
    Note over R: hết endTime
    B->>R: finalize() (bất kỳ ai)
    R->>FACT: deployLiveContracts()
    FACT->>FACT: deploy Token, Treasury, Governor, SpotAMM, PerformancePackage
    R->>R: mint/phân bổ, seed spot pool, chuyển treasury
    B->>R: claim() → tokens + refund USDC
```

Nếu `total < minRaise` thì `finalize()` chuyển trạng thái sang `Failed` và backer gọi `refund()`.

### 4.2. Proposal và thị trường quyết định

```mermaid
sequenceDiagram
    actor P as Proposer
    participant G as FutarchyGovernor
    participant VU as Vault USDC
    participant VT as Vault TOKEN
    participant PA as Pass AMM
    participant FA as Fail AMM
    participant K as Keeper
    actor T as Trader/Agent
    participant TR as Treasury

    P->>G: propose(actions, URI, hash, liquidity) [+ bond, USDC, TOKEN]
    G->>VU: deploy + split(liqUSDC)
    G->>VT: deploy + split(liqTOKEN)
    G->>PA: deploy + addLiquidity(pTOKEN, pUSDC)
    G->>FA: deploy + addLiquidity(fTOKEN, fUSDC)
    K->>G: activate() sau warmup
    loop trading period
        T->>PA: swap (qua Router)
        T->>FA: swap
        K->>PA: crank() mỗi phút
        K->>FA: crank()
    end
    K->>G: finalize()
    G->>PA: getTwap()
    G->>FA: getTwap()
    alt PASS
        G->>VU: resolve(PASS)
        G->>VT: resolve(PASS)
        G->>TR: execute(actions)
    else FAIL
        G->>VU: resolve(FAIL)
        G->>VT: resolve(FAIL)
    end
    T->>VU: redeem()
    T->>VT: redeem()
```

### 4.3. Agent mua phân tích qua x402 và trade

```mermaid
sequenceDiagram
    participant TA as Trader Agent
    participant AA as Analyst Agent (HTTP)
    participant FAC as x402 Facilitator
    participant USDC
    participant FR as ForecastRegistry
    participant RT as FutaraRouter

    TA->>AA: GET /v1/analysis/{proposalId}
    AA-->>TA: 402 Payment Required + PaymentRequirements (0.05 USDC, payTo, network avalanche-fuji)
    TA->>TA: ký EIP-3009 transferWithAuthorization
    TA->>AA: GET lại + header X-PAYMENT
    AA->>FAC: /verify
    FAC-->>AA: valid
    AA->>FAC: /settle
    FAC->>USDC: transferWithAuthorization(...)
    AA-->>TA: 200 + báo cáo JSON + X-PAYMENT-RESPONSE (txHash)
    TA->>TA: LLM tổng hợp → pPass, kỳ vọng giá
    TA->>FR: commitForecast(proposalId, agentId, hash)
    TA->>RT: buyConditional(proposalId, PASS, usdcIn, minOut)
```

### 4.4. Chấm reputation sau khi resolve

```mermaid
sequenceDiagram
    participant TA as Agent
    participant FR as ForecastRegistry
    participant K as Keeper
    participant REP as ReputationReporter
    participant RR as ERC-8004 ReputationRegistry

    Note over FR: Trading kết thúc → mở reveal window
    TA->>FR: revealForecast(proposalId, agentId, pPassBps, salt)
    Note over FR: Proposal đã finalize
    K->>REP: report(proposalId, agentId)
    REP->>FR: getForecast + outcome
    REP->>REP: score = 100 × (1 − Brier)
    REP->>RR: giveFeedback(agentId, score, 2, "futara-forecast", proposalTag, endpoint, uri, hash)
```

### 4.5. Thực thi xuyên chain (L1)

Xem file 06. Tóm tắt: proposal có action `GovernanceMessenger.sendToL1(...)`. Khi PASS, Treasury gọi action này, Messenger gửi message qua `TeleporterMessenger`. Relayer (ICM relayer) chuyển message sang L1, và `L1GovernanceExecutor.receiveTeleporterMessage` kiểm tra nguồn rồi thực thi trên L1.

## 5. Mô hình tin cậy (trust model)

| Thành phần | Có cần tin không? | Nếu nó "xấu" thì sao |
|---|---|---|
| Contracts | Tin code (đã test) | Bug → mất tiền. Giảm thiểu bằng test và invariant |
| Keeper | Không | Không chạy → ai cũng gọi được hàm thay. TWAP kém mượt nhưng vẫn đúng logic |
| Indexer/API | Không (chỉ hiển thị) | Hiển thị sai → user vẫn ký tx với dữ liệu on-chain thật. UI nên đọc trực tiếp contract cho các số quan trọng (giá, số dư) |
| x402 Facilitator | Tin một phần | Facilitator chỉ có thể submit đúng authorization đã ký (đúng số tiền, đúng người nhận). Rủi ro: không settle → seller không nhận tiền |
| LLM | Không | Agent sai → mất tiền của chính agent. Reputation phản ánh điều đó |
| ICM relayer | Không cho tính đúng đắn (message được ký bởi validator của chain nguồn qua Avalanche Warp Messaging) | Relayer không chạy → message chậm, có thể tự chạy relayer |

## 6. Môi trường

| Môi trường | Chain | Mục đích |
|---|---|---|
| `local` | Anvil (fork Fuji) | Dev + test contract, có ERC-8004 & USDC từ fork |
| `fuji` | Avalanche Fuji C-Chain (43113) + 1 L1 testnet | Demo, nộp bài |

Thông tin mạng Fuji:
- RPC: `https://api.avax-test.network/ext/bc/C/rpc`
- Chain ID: `43113`, CAIP-2: `eip155:43113`, x402 network string: `avalanche-fuji`
- Explorer: `https://testnet.snowtrace.io` hoặc Avalanche Explorer trên Builder Hub
- Faucet AVAX: Builder Hub faucet. Faucet USDC: Circle faucet (`faucet.circle.com`)
