# 04 — Đặc tả Smart Contracts

- **Ngôn ngữ:** Solidity `^0.8.24`, framework **Foundry**, thư viện **OpenZeppelin Contracts v5** (`SafeERC20`, `ReentrancyGuard`, `Clones`, `ERC20Permit`, `Math`).
- **Pattern deploy:** contract theo project/proposal được tạo bằng **EIP-1167 minimal proxy** (`Clones.clone`) từ một implementation. Clone dùng `initialize()` thay cho constructor, nên mỗi implementation cần `_disableInitializers()` hoặc cờ `initialized`.
- **Không upgradeable.** Đơn giản, dễ audit. Tham số thay đổi qua governance.
- Toán học dùng `Math.mulDiv` để tránh overflow. Làm tròn **luôn có lợi cho protocol** (round down khi trả ra, round up khi thu vào).

## 0. Bản đồ contract

```
contracts/
├── core/
│   ├── FutaraFactory.sol          // registry + deploy project
│   ├── Raise.sol                  // gọi vốn (clone)
│   ├── ProjectToken.sol           // ERC20 + Permit (clone)
│   ├── Treasury.sol               // giữ tiền (clone)
│   ├── FutarchyGovernor.sol       // vòng đời proposal (clone)
│   └── PerformancePackage.sol     // token founder theo milestone (clone)
├── market/
│   ├── ConditionalVault.sol       // split/merge/redeem (clone)
│   ├── ConditionalToken.sol       // ERC20 mint/burn bởi vault (clone)
│   ├── DecisionAMM.sol            // CPMM + lagging TWAP (clone)
│   └── FutaraRouter.sol           // helper 1-tx
├── agents/
│   ├── ForecastRegistry.sol       // commit-reveal dự báo của agent
│   └── ReputationReporter.sol     // chấm điểm & ghi ERC-8004
├── crosschain/
│   ├── GovernanceMessenger.sol    // C-Chain → L1 qua Teleporter
│   └── L1GovernanceExecutor.sol   // nhận & thực thi trên L1
├── interfaces/
│   ├── IERC8004Identity.sol
│   ├── IERC8004Reputation.sol
│   ├── ITeleporterMessenger.sol
│   └── ITeleporterReceiver.sol
└── libraries/
    ├── FutaraTypes.sol            // struct, enum dùng chung
    └── PriceMath.sol              // chuẩn hóa decimals, spot price
```

---

## 1. FutaraTypes.sol (struct & enum dùng chung)

```solidity
enum RaiseState { Pending, Active, Failed, Succeeded, Finalized }
enum ProposalState { None, Pending, Trading, Finalizable, Passed, Failed, Executed, ExecutionFailed, Cancelled }
enum Outcome { Unresolved, Pass, Fail }

struct Allocation {           // tổng = 10_000
    uint16 saleBps;
    uint16 liquidityBps;
    uint16 treasuryBps;
    uint16 founderBps;
}

struct RaiseConfig {
    uint256 minRaise;          // USDC (6 dec)
    uint256 hardCap;           // USDC
    uint256 minContribution;   // USDC
    uint64  startTime;
    uint64  endTime;
    uint16  liquidityUsdcBps;  // % accepted USDC vào spot pool
    uint16  liquidityPremiumBps;
}

struct TokenConfig {
    string  name;
    string  symbol;
    uint256 totalSupply;       // 18 dec
    Allocation allocation;
}

struct FutarchyParams {
    uint32  warmup;
    uint32  tradingPeriod;
    uint32  twapStartDelay;
    uint32  executionWindow;
    uint32  minUpdateInterval;
    uint16  maxObsChangeBps;    // % giá seed mỗi lần update
    uint16  thresholdBps;
    uint16  ammFeeBps;
    uint256 proposalBond;       // TOKEN
    uint256 minLiquidityUsdc;   // USDC
}

struct BudgetConfig {
    address operator;
    uint256 monthlyBudget;      // USDC
    uint32  budgetPeriod;       // giây
}

struct FounderConfig {
    address beneficiary;
    uint32  cliff;
    uint32  twapWindow;
    uint16[] milestoneMultipliersX100; // [200, 400, 800, 1600] = 2x,4x,8x,16x
    uint16[] unlockBps;                 // [2500,2500,2500,2500]
}

struct Action {
    address target;
    uint256 value;
    bytes   data;
}
```

---

## 2. FutaraFactory.sol

**Vai trò:** điểm vào duy nhất để tạo project, giữ địa chỉ các implementation, đánh số project.

### State
```solidity
IERC20  public immutable usdc;
address public raiseImpl, tokenImpl, treasuryImpl, governorImpl, ammImpl,
        vaultImpl, condTokenImpl, perfImpl;
address public forecastRegistry;
uint256 public projectCount;
mapping(uint256 => Project) public projects;
mapping(address => uint256) public projectIdOf; // raise/token/treasury/governor → id

struct Project {
    address founder;
    address raise;
    address token;
    address treasury;
    address governor;
    address spotAmm;
    address performancePackage;
    string  metadataURI;
    bytes32 metadataHash;
    FutarchyParams params;
    BudgetConfig budget;
    FounderConfig founderCfg;
    TokenConfig tokenCfg;
    RaiseConfig raiseCfg;
}
```

### Hàm
| Hàm | Ai gọi | Mô tả |
|---|---|---|
| `createProject(TokenConfig, RaiseConfig, FutarchyParams, BudgetConfig, FounderConfig, string metadataURI, bytes32 metadataHash) returns (uint256 projectId)` | Bất kỳ ai (founder) | Validate config, clone `Raise`, lưu Project. Chưa deploy token. |
| `deployLive(uint256 projectId) returns (LiveAddrs)` | Chỉ `Raise` của project đó | Clone Token, Treasury, Governor, SpotAMM, PerformancePackage và initialize. Trả địa chỉ cho Raise. |
| `getProject(uint256)` | view | |

### Validate trong `createProject`
- Tổng allocation = 10.000. `saleBps > 0`.
- `minRaise > 0`, `hardCap >= minRaise`, `endTime > startTime >= block.timestamp`.
- `liquidityUsdcBps <= 5000`.
- `thresholdBps <= 2000`, `ammFeeBps <= 100`, `tradingPeriod > twapStartDelay`.
- `milestoneMultipliersX100.length == unlockBps.length`, tổng `unlockBps = 10.000`.
- Kiểm tra giá pool ≥ giá raise tại hardCap (xem file 02, mục 2.3).

### Events
```solidity
event ProjectCreated(uint256 indexed projectId, address indexed founder, address raise, string metadataURI);
event ProjectLive(uint256 indexed projectId, address token, address treasury, address governor, address spotAmm, address performancePackage);
```

---

## 3. Raise.sol

### State
```solidity
uint256 public projectId;
FutaraFactory public factory;
IERC20 public usdc;
RaiseConfig public cfg;
TokenConfig public tokenCfg;
RaiseState public state;
uint256 public totalContributed;              // T
uint256 public acceptedTotal;                 // A
mapping(address => uint256) public contributed;  // D_i
mapping(address => bool) public claimed;
address public token; // sau finalize
```

### Hàm
| Hàm | Điều kiện | Hành vi |
|---|---|---|
| `contribute(uint256 amount)` | `startTime <= now < endTime`, `amount >= minContribution` | `safeTransferFrom` USDC, cộng `contributed`, `totalContributed`. |
| `contributeWithPermit(amount, deadline, v, r, s)` | như trên | USDC Fuji hỗ trợ EIP-2612 permit nên gom được approve + contribute trong 1 tx. |
| `finalize()` | `now >= endTime`, state Active | Nếu `T < minRaise` → `Failed`. Ngược lại tính `A = min(T, hardCap)`, gọi `factory.deployLive`, mint toàn bộ supply cho Raise rồi phân phối: chuyển pool tokens + USDC vào SpotAMM (`initialize` + `addLiquidity`, LP shares thuộc **Treasury**), treasury tokens + USDC vào Treasury, founder tokens vào PerformancePackage. State `Finalized`. |
| `claim()` | state Finalized, chưa claim | Tính `accepted_i`, `tokens_i`, `refund_i` (file 02, mục 2.2). Chuyển TOKEN + refund USDC. |
| `refund()` | state Failed | Trả lại `contributed[msg.sender]`. |
| `previewClaim(address) view returns (tokens, refund)` | | Dùng cho UI. |

**Lưu ý bụi làm tròn:** tổng `tokens_i` ≤ `saleTokens`. Không thể giao phần dư cho "người claim cuối cùng" vì contract không biết ai là người cuối. Thay vào đó, có hàm `sweepDust()` gọi được sau `claimDeadline` (90 ngày, demo 10 phút) để chuyển token/USDC còn lại vào Treasury.

### Events
```solidity
event Contributed(address indexed user, uint256 amount, uint256 totalContributed);
event RaiseFailed(uint256 totalContributed);
event RaiseFinalized(uint256 acceptedTotal, uint256 priceE18, address token);
event Claimed(address indexed user, uint256 tokens, uint256 refundUsdc);
event Refunded(address indexed user, uint256 amount);
```

### Errors
`NotActive()`, `BelowMinContribution()`, `AlreadyFinalized()`, `RaiseNotEnded()`, `NothingToClaim()`, `NotFailed()`.

---

## 4. ProjectToken.sol

- ERC20 + ERC20Permit, 18 decimals.
- `initialize(name, symbol, supply, mintTo)`: mint toàn bộ supply một lần. **Không có hàm mint sau đó**, supply cố định.
- Không có owner.

---

## 5. Treasury.sol

### State
```solidity
uint256 public projectId;
address public governor;
IERC20 public usdc;
IERC20 public token;
address public operator;
uint256 public monthlyBudget;
uint32  public budgetPeriod;
uint64  public currentPeriodStart;
uint256 public claimedThisPeriod;
```

### Hàm
| Hàm | Quyền | Hành vi |
|---|---|---|
| `execute(Action[] calldata actions)` | `onlyGovernor` | Lặp gọi `target.call{value}(data)`. Revert nếu bất kỳ call nào fail (atomic). |
| `transferERC20(IERC20 t, address to, uint256 amt)` | `onlySelf` (chỉ được gọi qua `execute`, target = Treasury) | Chuyển token. |
| `approveERC20(IERC20 t, address spender, uint256 amt)` | `onlySelf` | Dùng khi proposal cần approve (ví dụ ICTT bridge). |
| `setMonthlyBudget(uint256)` / `setOperator(address)` | `onlySelf` | |
| `claimBudget(uint256 amount, address to)` | `operator` | Nếu `now >= currentPeriodStart + budgetPeriod` thì reset kỳ (`currentPeriodStart = now`, `claimedThisPeriod = 0`). Yêu cầu `claimedThisPeriod + amount <= monthlyBudget`. |
| `lockForProposal(...)` | — | **Không cần.** Treasury không khóa tiền. Proposal action sẽ revert nếu thiếu tiền lúc execute. |
| `receive()` | | Nhận AVAX native. |

> **Mẫu `onlySelf`:** `require(msg.sender == address(this))`. Như vậy các hàm quản trị chỉ chạy được khi Governor gọi `execute` với target là chính Treasury. Toàn bộ quyền đều phải đi qua futarchy.

### Events
`Executed(uint256 indexed proposalId, uint256 actionCount)`, `BudgetClaimed(address to, uint256 amount, uint64 periodStart)`, `BudgetChanged(uint256)`, `OperatorChanged(address)`.

---

## 6. FutarchyGovernor.sol

### State
```solidity
uint256 public projectId;
FutaraFactory public factory;
Treasury public treasury;
IERC20 public usdc;
IERC20 public token;
DecisionAMM public spotAmm;
FutarchyParams public params;
uint256 public proposalCount;
uint256 public activeProposalId;     // 0 = không có
mapping(uint256 => Proposal) public proposals;

struct Proposal {
    address proposer;
    string  descriptionURI;
    bytes32 descriptionHash;
    bytes32 actionsHash;          // keccak256(abi.encode(actions))
    ProposalState state;
    Outcome outcome;
    uint64  createdAt;
    uint64  tradingStart;
    uint64  tradingEnd;
    uint64  executionDeadline;
    uint256 bond;
    address vaultUsdc;
    address vaultToken;
    address passAmm;
    address failAmm;
    uint256 seedPriceE18;
    uint256 twapPassE18;          // ghi lúc finalize
    uint256 twapFailE18;
}
mapping(uint256 => Action[]) internal _actions;
```

### Hàm
| Hàm | Quyền | Hành vi |
|---|---|---|
| `propose(Action[] actions, string uri, bytes32 hash, uint256 liqUsdc, uint256 maxLiqToken)` | Bất kỳ ai giữ đủ bond | Yêu cầu `activeProposalId == 0`, `liqUsdc >= minLiquidityUsdc`. Lấy `seedPrice = spotAmm.getTwap(lookback)` hoặc spot price nếu TWAP chưa đủ dữ liệu. `liqToken = liqUsdc × 1e18 / seedPrice` (chuẩn hóa decimals), yêu cầu `<= maxLiqToken`. Transfer bond + USDC + TOKEN từ proposer. Clone 2 vault, 4 conditional token, 2 AMM. Split, seed cả 2 AMM với `(liqToken, liqUsdc)`, LP shares ghi cho proposer. State `Pending`. |
| `activate(uint256 id)` | Bất kỳ ai | `now >= createdAt + warmup` thì set `tradingStart = now`, `tradingEnd = now + tradingPeriod`, gọi `passAmm.startTwap(tradingStart + twapStartDelay, seedPrice, maxDelta)` và tương tự với fail. State `Trading`. |
| `finalize(uint256 id)` | Bất kỳ ai | `now >= tradingEnd`. Gọi `passAmm.finalizeTwap(tradingEnd)` và `failAmm.finalizeTwap(tradingEnd)` để lấy TWAP. Áp luật quyết định. Gọi `vault.resolve(outcome)` cho cả 2 vault. Đóng AMM (`close()`, chặn swap). Trả bond cho proposer. Nếu Pass: state `Passed`, `executionDeadline = now + executionWindow`, rồi **thử execute ngay** bằng `try this.executeInternal` (bắt lỗi để không làm finalize revert). Nếu Fail: state `Failed`. Xóa `activeProposalId`. |
| `execute(uint256 id, Action[] actions)` | Bất kỳ ai | State Passed, `now <= executionDeadline`, `keccak256(abi.encode(actions)) == actionsHash`. Gọi `treasury.execute(actions)`. State `Executed`. |
| `markExecutionFailed(uint256 id)` | Bất kỳ ai | `now > executionDeadline` và state Passed thì chuyển `ExecutionFailed`. |
| `cancel(uint256 id)` | proposer | Chỉ khi state `Pending`. Bond hoàn lại. Nếu đã `Trading` thì không được cancel. |
| `withdrawLiquidity(uint256 id)` | proposer / LP | Sau finalize: rút LP từ 2 AMM (nhận conditional tokens) rồi redeem phần thắng. Hàm tiện ích, có thể đặt ở Router. |
| `setParams(FutarchyParams)` | `onlyTreasury` (tức qua proposal) | Đổi tham số cho proposal **sau**. |
| `getActions(uint256 id) view` | | |

**Lưu ý thiết kế:** `actions` được lưu đầy đủ on-chain (trong `_actions`) để UI và mọi người đọc. `actionsHash` dùng để check nhanh. Execute dùng `_actions` đã lưu, nên tham số `actions` trong `execute()` có thể bỏ. Chọn **lưu đầy đủ** cho minh bạch.

### Events
```solidity
event ProposalCreated(uint256 indexed id, address indexed proposer, string uri, bytes32 descriptionHash,
    address vaultUsdc, address vaultToken, address passAmm, address failAmm, uint256 seedPriceE18);
event ProposalActivated(uint256 indexed id, uint64 tradingStart, uint64 tradingEnd);
event ProposalFinalized(uint256 indexed id, Outcome outcome, uint256 twapPass, uint256 twapFail);
event ProposalExecuted(uint256 indexed id);
event ProposalExecutionFailed(uint256 indexed id, bytes reason);
event ProposalCancelled(uint256 indexed id);
event ParamsUpdated(FutarchyParams params);
```

### Errors
`ProposalActive()`, `InsufficientLiquidity()`, `SlippageOnSeed()`, `WarmupNotOver()`, `TradingNotOver()`, `WrongState()`, `ExecutionExpired()`, `ActionsMismatch()`.

---

## 7. ConditionalVault.sol & ConditionalToken.sol

### ConditionalVault
```solidity
IERC20 public underlying;
ConditionalToken public passToken;
ConditionalToken public failToken;
address public governor;
uint256 public proposalId;
Outcome public outcome;
```

| Hàm | Hành vi |
|---|---|
| `initialize(underlying, governor, proposalId, condTokenImpl, symbolPrefix)` | Clone 2 ConditionalToken: tên `"PASS-EDU#3"`/`"FAIL-EDU#3"`, decimals = decimals của underlying. |
| `split(uint256 amt, address to)` | `outcome == Unresolved`. Nhận underlying, mint `amt` pass + `amt` fail cho `to`. |
| `merge(uint256 amt, address to)` | `outcome == Unresolved`. Burn `amt` mỗi loại, trả underlying. |
| `resolve(Outcome o)` | `onlyGovernor`, một lần. |
| `redeem(address to) returns (uint256)` | Đã resolve. Burn toàn bộ token thắng của `msg.sender`, trả underlying 1:1. Token thua: không làm gì (giá trị 0). |
| `splitFor` / `mergeFor` | Phiên bản cho Router (dùng `transferFrom` của msg.sender). |

**Invariant (viết invariant test Foundry):**
1. Trước resolve: `underlying.balanceOf(vault) == passToken.totalSupply() == failToken.totalSupply()`.
2. Sau resolve: `underlying.balanceOf(vault) >= winning.totalSupply()`.

### ConditionalToken
ERC20 tối giản, `mint`/`burn` chỉ vault gọi được. `decimals()` trả về giá trị được set lúc initialize.

Events vault: `Split(address indexed user, uint256 amt)`, `Merged(...)`, `Resolved(Outcome)`, `Redeemed(address indexed user, uint256 amt)`.

---

## 8. DecisionAMM.sol (CPMM + lagging TWAP)

Dùng cho **pass pool, fail pool và spot pool**.

### State
```solidity
IERC20 public base;            // TOKEN / pTOKEN / fTOKEN (18 dec)
IERC20 public quote;           // USDC / pUSDC / fUSDC (6 dec)
uint256 public reserveBase;
uint256 public reserveQuote;
uint16  public feeBps;
uint256 public totalShares;
mapping(address => uint256) public shares;
address public controller;     // Governor (conditional) hoặc Treasury/Factory (spot)
bool    public closed;
bool    public lpLocked;       // true cho conditional pool cho tới khi closed

// TWAP
bool    public twapEnabled;
uint64  public twapStart;
uint64  public lastUpdateTime;
uint32  public minUpdateInterval;
uint256 public lastObservation;   // 1e18
uint256 public maxObsDelta;       // 1e18 tuyệt đối
uint256 public aggregator;        // Σ obs × dt
uint64  public aggregatorLastTime;

// Spot pool: thêm ring buffer cumulative để tính TWAP tùy cửa sổ (cho PerformancePackage & seed price)
struct Checkpoint { uint64 time; uint256 cumulative; }  // cumulative = Σ obs × dt từ khi tạo pool
Checkpoint[] public checkpoints;  // ghi tối đa 1 checkpoint / minUpdateInterval
```

### Hàm
| Hàm | Mô tả |
|---|---|
| `initialize(base, quote, feeBps, controller, lpLocked, minUpdateInterval)` | |
| `addLiquidity(uint256 baseAmt, uint256 quoteAmt, uint256 minShares, address to)` | Lần đầu: `shares = sqrt(base × quote)`, khóa `MINIMUM_LIQUIDITY = 1000` share vào `address(0xdead)`. Các lần sau: thêm theo đúng tỷ lệ, lấy min. |
| `removeLiquidity(uint256 shares, uint256 minBase, uint256 minQuote, address to)` | Revert nếu `lpLocked && !closed`. |
| `swapExactQuoteForBase(uint256 quoteIn, uint256 minBaseOut, address to, uint64 deadline)` | `_updateTwap()` trước, rồi swap theo công thức file 02, mục 5.1. |
| `swapExactBaseForQuote(uint256 baseIn, uint256 minQuoteOut, address to, uint64 deadline)` | |
| `getAmountOut(bool quoteToBase, uint256 amountIn) view` | Quote cho UI/Router. |
| `spotPriceE18() view` | `quote × 1e12 × 1e18 / base`. |
| `crank()` | Public, gọi `_updateTwap()`. |
| `startTwap(uint64 start, uint256 initialObs, uint256 maxDelta)` | `onlyController`, chỉ conditional pool. |
| `finalizeTwap(uint64 endTime) returns (uint256 twap)` | `onlyController`: cập nhật lần cuối (bỏ qua minUpdateInterval), tính `aggregator / (endTime − twapStart)`. Nếu `block.timestamp > endTime` thì chỉ tích phân đến `endTime`. |
| `close()` | `onlyController`. Chặn swap, mở khóa LP. |
| `consult(uint32 secondsAgo) view returns (uint256 twapE18)` | Chỉ spot pool. Tính từ checkpoints (giống Uniswap V2 oracle). |

`_updateTwap()` theo đúng pseudocode ở file 02, mục 6.2. Với spot pool, `maxObsDelta` đặt theo % của `lastObservation` (tương đối, cập nhật động), vì spot pool tồn tại lâu dài.

### Events
```solidity
event Swap(address indexed sender, address indexed to, bool quoteToBase, uint256 amountIn, uint256 amountOut, uint256 reserveBase, uint256 reserveQuote);
event LiquidityAdded(address indexed provider, uint256 baseAmt, uint256 quoteAmt, uint256 shares);
event LiquidityRemoved(address indexed provider, uint256 baseAmt, uint256 quoteAmt, uint256 shares);
event TwapUpdated(uint256 observation, uint256 spot, uint64 time);
event Closed();
```

### Errors
`Closed()`, `Expired()`, `InsufficientOutput()`, `LpLocked()`, `ZeroLiquidity()`.

---

## 9. PerformancePackage.sol

```solidity
IERC20 public token;
address public beneficiary;
DecisionAMM public spotAmm;
uint256 public raisePriceE18;
uint64  public startTime;
uint32  public cliff;
uint32  public twapWindow;
uint16[] public multipliersX100;
uint16[] public unlockBps;
uint256 public totalAllocation;
uint256 public unlockedTranches;   // số tranche đã mở (tuần tự)
uint256 public released;
```

| Hàm | Mô tả |
|---|---|
| `unlockNext()` | Bất kỳ ai. `now >= startTime + cliff`. `twap = spotAmm.consult(twapWindow)`. Nếu `twap >= raisePrice × multipliersX100[i] / 100` thì `unlockedTranches++`. |
| `release()` | Chuyển cho beneficiary phần đã mở mà chưa nhận. |
| `setBeneficiary(address)` | `onlyTreasury` (qua proposal). |

---

## 10. FutaraRouter.sol

Gom thao tác nhiều bước vào 1 tx cho UX. Router **không giữ tiền** sau tx.

| Hàm | Các bước |
|---|---|
| `buyOutcome(governor, proposalId, bool pass, uint256 usdcIn, uint256 minTokenOut, uint64 deadline)` | Nhận USDC, split thành pUSDC + fUSDC, swap pUSDC→pTOKEN ở pass pool (hoặc fail tương ứng), trả cho user **pTOKEN + fUSDC dư**. |
| `sellOutcome(governor, proposalId, bool pass, uint256 tokenIn, uint256 minUsdcOut, uint64 deadline)` | Nhận TOKEN, split, bán pTOKEN lấy pUSDC, trả user pUSDC + fTOKEN. |
| `buyOutcomeToToken(...)` | Biến thể nâng cao: mua pTOKEN **và** fTOKEN cân bằng để giữ vị thế "trung tính + nghiêng về Pass". Dành cho agent. |
| `splitAndProvide(...)` | Thêm thanh khoản vào cả 2 pool. |
| `redeemAll(governor, proposalId)` | Redeem cả 2 vault và rút LP nếu có. |
| `mergeAll(governor, proposalId)` | Merge mọi cặp pass/fail đang giữ về underlying. |
| `swapSpot(...)` | Swap trên spot pool. |

Hỗ trợ `permit` (USDC và ProjectToken) để không cần tx approve riêng.

---

## 11. ForecastRegistry.sol (agent)

**Mục đích:** agent công bố dự báo **trước** khi biết kết quả, theo cơ chế commit-reveal để chống copy. Dự báo gắn với `agentId` của ERC-8004.

```solidity
IERC8004Identity public identity;   // Identity Registry trên Fuji
struct Forecast {
    bytes32 commitHash;     // keccak256(abi.encode(governor, proposalId, agentId, pPassBps, salt))
    uint64  committedAt;
    uint16  pPassBps;       // 0..10000, sau reveal
    bool    revealed;
}
// governor => proposalId => agentId => Forecast
mapping(address => mapping(uint256 => mapping(uint256 => Forecast))) public forecasts;
mapping(address => mapping(uint256 => uint256[])) public forecastersOf;
```

| Hàm | Điều kiện |
|---|---|
| `commit(address governor, uint256 proposalId, uint256 agentId, bytes32 hash)` | `msg.sender` là owner của agentId **hoặc** là `agentWallet` đã đăng ký trong Identity Registry (đọc qua `ownerOf` / `getAgentWallet` hoặc metadata, tùy interface của bản deploy, xem file 05). Proposal ở trạng thái `Trading` và `now < tradingEnd`. Mỗi agent chỉ commit 1 lần (có thể ghi đè trước `tradingEnd`, lấy `committedAt` mới). |
| `reveal(address governor, uint256 proposalId, uint256 agentId, uint16 pPassBps, bytes32 salt)` | `now >= tradingEnd` và trong `revealWindow` (24h, demo 3 phút). Hash phải khớp. |
| `getForecast(...) view` | |

Events: `ForecastCommitted(address indexed governor, uint256 indexed proposalId, uint256 indexed agentId, bytes32 hash)`, `ForecastRevealed(..., uint16 pPassBps)`.

> Chỉ dùng `pPassBps` (xác suất Pass) cho chấm điểm, vì Pass/Fail là ground truth rõ ràng nhất. Các dự báo giàu thông tin hơn (giá kỳ vọng) nằm trong báo cáo off-chain mà agent bán qua x402.

---

## 12. ReputationReporter.sol (agent)

**Mục đích:** biến kết quả futarchy thành feedback ERC-8004 một cách **permissionless và xác định** (deterministic).

```solidity
IERC8004Reputation public reputation;
ForecastRegistry public forecasts;
mapping(address => mapping(uint256 => mapping(uint256 => bool))) public reported;
string public constant TAG1 = "futara-forecast";
```

`report(address governor, uint256 proposalId, uint256 agentId)`:
1. Proposal đã finalize (outcome Pass/Fail), forecast đã reveal, chưa report.
2. `o = (outcome == Pass) ? 10000 : 0`.
3. `brier = (pPassBps − o)^2 / 10000` (thang 0..10000).
4. `score = 10000 − brier` (thang 0..10000, tức 0.00–100.00 với 2 decimals).
5. Bonus đúng giờ (tùy chọn): forecast commit sớm (trong nửa đầu trading period) được nhân hệ số 1.0. Forecast muộn bị nhân 0.9. Tham số hóa.
6. Gọi `reputation.giveFeedback(agentId, int128(score), 2, TAG1, tag2, endpoint, feedbackURI, feedbackHash)`, trong đó `tag2 = string(abi.encodePacked(chainId,":",governor,":",proposalId))` và `feedbackURI` trỏ tới JSON tóm tắt do API tạo (có thể để rỗng).

Chữ ký `giveFeedback` theo bản ERC-8004 đã deploy trên Fuji là `giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)`. **Kiểm tra lại ABI thật trên explorer trước khi code**, vì spec từng đổi chữ ký (bản cũ dùng `uint8 score` + `bytes32` tag + `feedbackAuth`). Đặt một adapter `IERC8004Reputation` riêng để chỉ sửa một chỗ nếu ABI khác.

> Lưu ý: ERC-8004 có thể chặn owner/operator của agent tự feedback cho chính mình. `ReputationReporter` là một contract độc lập, không phải owner agent, nên hợp lệ.

`reportBatch(governor, proposalId, uint256[] agentIds)` để keeper gọi một lần.

Event: `ForecastScored(address indexed governor, uint256 indexed proposalId, uint256 indexed agentId, uint16 pPassBps, Outcome outcome, uint256 score)`.

---

## 13. Cross-chain contracts

Xem file 06 để biết đặc tả đầy đủ `GovernanceMessenger` và `L1GovernanceExecutor`.

---

## 14. Danh sách test bắt buộc (Foundry)

### Unit
- Raise: under-subscribed, exact cap, over-subscribed pro-rata (nhiều người, số lẻ), refund khi fail, claim 2 lần revert, permit.
- Treasury: chỉ governor execute; `onlySelf`; budget theo kỳ, không cộng dồn, vượt budget revert.
- Vault: split/merge/redeem, resolve 1 lần, redeem token thua trả 0.
- AMM: công thức swap khớp tham chiếu, phí, slippage, deadline, LP lock.
- TWAP: observation bị clamp đúng `maxDelta`; tích phân đúng khi không có crank; finalize sau `tradingEnd` không tính phần thừa.
- Governor: luật quyết định ở biên (đúng bằng threshold → FAIL), execute đúng actions, executionWindow, chỉ 1 proposal active.
- ForecastRegistry: commit sai quyền, reveal sai hash, reveal ngoài window.
- ReputationReporter: điểm Brier đúng cho pPass = 0, 5000, 10000 với cả 2 outcome; không report 2 lần.

### Fuzz
- Swap ngẫu nhiên giữ `k` không giảm.
- Pro-rata: Σ accepted ≤ hardCap, Σ tokens ≤ saleTokens, không ai nhận nhiều hơn số đã góp.

### Invariant
- Vault solvency (mục 7).
- Treasury chỉ giảm số dư qua `execute` hoặc `claimBudget`.

### Kịch bản tích hợp (fork Fuji)
- Toàn bộ vòng đời: create → raise → finalize → claim → propose → trade → finalize PASS → execute → redeem → reveal → report (ghi thật vào ERC-8004 Fuji trên fork).
- Tấn công thao túng: kẻ tấn công đẩy giá pass ×5 trong 1 block trước khi kết thúc. Assert TWAP chỉ lệch tối đa `maxDelta`.
