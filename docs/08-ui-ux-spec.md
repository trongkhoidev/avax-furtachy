# 08 — Đặc tả UI/UX (dùng cho Stitch + Codex)

File này mô tả **mọi màn hình, component, trạng thái và copy**. Cuối file có **prompt mẫu cho Stitch** (tiếng Anh, vì Stitch hiểu tiếng Anh tốt hơn) cho từng màn hình.

Ngôn ngữ UI: **English** (người dùng crypto quốc tế, dễ demo). Có thể thêm toggle VI sau.

---

## 1. Định hướng thiết kế

### 1.1. Chủ đề trung tâm
Sản phẩm xoay quanh một khoảnh khắc: **hai tương lai tách ra, và thị trường chọn một**. Mọi màn hình quan trọng xoay quanh hình ảnh "tách đôi" này:
- Pass vs Fail luôn đứng **cạnh nhau, đối xứng**.
- Yếu tố đáng nhớ duy nhất (signature) là **Decision Split chart**: 2 đường giá Pass/Fail tách nhau theo thời gian, với **dải ngưỡng θ** tô nhạt phía trên đường Fail. Khi đường Pass vượt lên khỏi dải, giao diện "nghiêng" về Pass.
- Phần còn lại tiết chế, sạch sẽ, mật độ thông tin cao kiểu công cụ tài chính.

Cảm hứng vật liệu: **băng tuyết và tuyết lở (Avalanche)**. Nền lạnh, sáng, trong. Pass mang màu băng xanh sâu, Fail mang màu than hồng ấm. Không dùng xanh lá/đỏ cho Pass/Fail, để tránh nhầm với "lãi/lỗ" và hỗ trợ người mù màu đỏ-lục.

### 1.2. Design tokens

**Màu (light)**
| Token | Hex | Dùng cho |
|---|---|---|
| `snow` | `#F5F7FA` | Nền trang |
| `paper` | `#FFFFFF` | Bề mặt panel |
| `ink` | `#14202B` | Chữ chính (xanh than đậm, không dùng đen thuần) |
| `slate` | `#5E6B78` | Chữ phụ, trục chart |
| `frost` | `#DCE6EE` | Đường kẻ, dải ngưỡng θ, nền input |
| `pass` | `#1C6E8C` | Mọi thứ thuộc Pass |
| `pass-tint` | `#E3F0F5` | Nền nhạt Pass |
| `fail` | `#C4561D` | Mọi thứ thuộc Fail |
| `fail-tint` | `#F8EAE1` | Nền nhạt Fail |
| `signal` | `#E84142` | **Chỉ** logo Avalanche/brand mark và lỗi nghiêm trọng |
| `agent` | `#5B4BB7` | Đánh dấu hành động do AI agent thực hiện |

**Màu (dark)**: `snow #0F1821`, `paper #16222D`, `ink #E8EEF3`, `slate #93A1AE`, `frost #24333F`, `pass #4FA7C7`, `fail #E07A45`, `agent #8F82E0`.

**Typography**
| Vai trò | Font | Ghi chú |
|---|---|---|
| UI, số liệu, tiêu đề | **Schibsted Grotesk** (Google Fonts) | Dùng `font-variant-numeric: tabular-nums` cho mọi con số |
| Nội dung proposal, báo cáo agent (đọc dài) | **Newsreader** (Google Fonts) | Proposal giống một bản memo nên dùng serif để đọc thoải mái, line-height 1.6, tối đa ~70 ký tự/dòng |

Thang chữ: 13 / 15 / 17 / 21 / 28 / 40 px. Weight: 400, 500, 700. Tiêu đề dùng sentence case. **Không** dùng nhãn viết hoa toàn bộ.

**Hình khối**
- Bo góc theo cấp bậc: input/button 8px, panel 12px, chip trạng thái 999px. Chart không có khung bo.
- Phân tách bằng đường kẻ `frost` 1px và khoảng trắng. Hạn chế đổ bóng (chỉ dùng cho modal/popover).
- Lưới 12 cột, max-width 1280px, gutter 24px. Căn **trái** toàn bộ, không căn giữa trừ empty state.

**Chuyển động**
- Chỉ có một khoảnh khắc chuyển động được dàn dựng: khi proposal **finalize**, Decision Split chart "khóa" lại, đường thua mờ đi, và nhãn kết quả hiện ra.
- Các chuyển động khác chỉ phản hồi hành động của người dùng (mở panel, xác nhận tx). Tôn trọng `prefers-reduced-motion`.

**Pass/Fail không chỉ dựa vào màu:** Pass luôn có biểu tượng ▲ và chữ "Pass", Fail luôn có ▼ và chữ "Fail". Trên chart, đường Pass liền, đường Fail đứt nét.

### 1.3. Giọng văn (copy)
- Động từ rõ ràng: "Contribute", "Buy Pass", "Sell Pass", "Redeem", "Create proposal". Không dùng "Submit".
- Cùng một hành động giữ cùng một tên trong toàn bộ flow: nút "Redeem" → toast "Redeemed 120.5 USDC".
- Lỗi phải nói rõ chuyện gì xảy ra và cách sửa: "Price moved more than your 1% limit. Increase slippage or try a smaller amount."
- Giải thích futarchy bằng ngôn ngữ đời thường: "Buy Pass if you think this proposal makes EDU worth more."

---

## 2. Cấu trúc điều hướng

```
Header: [Futara logo] Explore · Agents · Portfolio          [Network: Fuji ▾] [Connect wallet]
Routes:
/                         Explore (home)
/create                   Create project (wizard)
/p/[projectId]            Project – Overview
/p/[projectId]/raise      Project – Raise
/p/[projectId]/treasury   Project – Treasury
/p/[projectId]/proposals  Project – Proposals
/p/[projectId]/chains     Project – Chains (L1)
/p/[projectId]/propose    Create proposal (wizard)
/proposal/[gov]/[id]      Proposal detail (màn hình quan trọng nhất)
/agents                   Agent leaderboard
/agents/[agentId]         Agent detail
/agents/register          Register agent
/portfolio                Portfolio
/about                    How Futara works
```

Mobile: header thu gọn thành logo + ví + menu. Trang Proposal xếp chồng: chart → trade panel → các tab.

---

## 3. Đặc tả từng màn hình

### 3.1. Explore (`/`)

**Mục tiêu:** trong 5 giây người xem hiểu Futara là gì, và thấy ngay các quyết định đang diễn ra.

**Hero (không dùng kiểu "số lớn + gradient"):**
- Trái: tiêu đề "Funds move only when the market agrees." và dòng phụ "Launch a token. Every treasury spend is decided by Pass and Fail markets, traded by people and AI agents."
- Phải: **một Decision Split chart thật đang chạy** của proposal nổi bật nhất (live), kèm nhãn "Live decision · EDU #3 · leaning Pass". Hero chính là sản phẩm thật.
- 2 nút: "Explore projects" (primary), "Launch a project" (secondary).

**Section "Decisions happening now":** danh sách hàng ngang (không phải lưới card giống nhau), mỗi hàng là một proposal đang Trading:
- Logo project, tiêu đề proposal, mini split chart (sparkline 2 đường), giá Pass/Fail, nhãn "Leaning Pass +8.2%", thời gian còn lại, số agent đang tham gia (icon agent màu `agent`).

**Section "Raising":** card project đang raise. Gồm logo, tên, tagline, thanh tiến độ (tô đến minRaise, vạch hardCap), "$142,300 of $200,000", thời gian còn lại, số backer.

**Section "Live projects":** bảng có cột Project, Price, 7d, Treasury, Proposals passed/failed, Next decision.

**Stats strip (thấp, ở cuối):** Treasury protected, Decisions made, Agent trades, x402 payments settled.

**States:** loading = skeleton theo đúng layout; empty "Raising" = "No raises open. Launch the first one." + nút.

### 3.2. Create project (`/create`) — wizard 5 bước

Thanh bước bên trái (đây là chuỗi tuần tự thật nên dùng số thứ tự), form bên phải, **preview card trực tiếp** ở cột phải trên desktop.

1. **Basics**: name, symbol, tagline, description (markdown editor có preview), logo/banner upload, links.
2. **Token & allocation**: total supply; 4 thanh trượt liên kết (Sale / Liquidity / Treasury / Founder, tổng luôn = 100%); **donut** minh họa. Hiển thị giá raise ước tính tại minRaise và hardCap.
3. **Raise**: min raise, hard cap, start/end (date-time picker), min contribution, % USDC vào liquidity. Kèm cảnh báo trực tiếp: "Pool opens at $0.044, which is above the raise price. Good."
4. **Governance**: chọn preset **Demo** / **Standard** / **Custom**. Custom mở các trường: trading period, threshold, TWAP delay, bond, min liquidity. Có thêm monthly budget, operator address, founder milestones (bảng 4 dòng: multiplier, unlock %).
5. **Review & launch**: tóm tắt toàn bộ, checkbox "I understand treasury funds can only be spent through Pass/Fail markets", nút "Launch project". Luồng tx: upload metadata → ký tx `createProject` → màn hình thành công có link project.

Validation inline ngay khi nhập. Lỗi hiển thị dưới trường, màu `fail`, kèm hướng dẫn.

### 3.3. Project – layout chung (`/p/[id]/*`)

**Header project:** banner mỏng, logo, tên, symbol, giá spot + % 24h, chip trạng thái (Raising / Live / Failed), links, nút "Trade EDU" (mở swap spot dạng drawer).

**Tabs:** Overview · Raise · Treasury · Proposals · Chains (tab Chains chỉ hiện khi có L1).

**Overview:** cột trái là mô tả (Newsreader), roadmap, team, use of funds. Cột phải gồm:
- **"Treasury guard" panel:** USDC trong treasury, token trong treasury, monthly budget còn lại kỳ này, và câu "Last spend: Marketing agency, 30,000 USDC, approved by market on Nov 18".
- Proposal đang diễn ra (mini split chart + nút "Open decision").
- Founder package: 4 milestone dạng bậc thang. Mốc nào đạt thì tô `pass`, kèm giá TWAP hiện tại so với từng mốc.

### 3.4. Project – Raise (`/p/[id]/raise`)

- **Khối tiến độ lớn:** thanh có 2 vạch (min, cap). Nếu vượt cap, phần vượt hiển thị sọc và chú thích "Oversubscribed 1.3×: everyone gets 77% filled, the rest is refunded."
- **Panel contribute:** input USDC (nút Max), dòng "You'll receive ≈ 125,000 EDU (estimate, final after raise ends)", nút "Contribute". Hỗ trợ permit: nếu không được thì hiện 2 bước Approve → Contribute.
- Sau khi raise kết thúc: panel đổi sang "Claim": tokens + refund, nút "Claim". Nếu raise fail: "Refund 500 USDC".
- Bảng contributors gần đây (địa chỉ rút gọn, số tiền, thời gian).
- **States:** Not started (đếm ngược), Active, Ended-awaiting-finalize (nút "Finalize raise" cho bất kỳ ai), Finalized, Failed.

### 3.5. Project – Treasury

- Biểu đồ vùng số dư USDC và token theo thời gian, đánh dấu mỗi lần chi (chấm tròn, hover hiện proposal).
- Bảng "Spending history": ngày, proposal, số tiền, người nhận, link tx. Kèm cột "Market margin" (Pass hơn Fail bao nhiêu %).
- Panel "Operating budget": budget/tháng, đã rút kỳ này, kỳ reset sau X ngày. Nút "Claim budget" chỉ hiện với operator.

### 3.6. Project – Proposals

Danh sách theo trạng thái: Trading → Pending → Passed/Executed → Failed. Mỗi hàng gồm tiêu đề, category chip, kết quả (▲ Pass / ▼ Fail kèm margin), số tiền liên quan, ngày. Nút "Create proposal".

### 3.7. Proposal detail (`/proposal/[gov]/[id]`) — MÀN HÌNH QUAN TRỌNG NHẤT

**Bố cục desktop:**
```
┌──────────────────────────────────────────────────────────────┬────────────────────────┐
│ EDU · Proposal #3 · Spending                                 │  TRADE PANEL           │
│ Hire marketing agency for 3 months                           │  [Pass ▲] [Fail ▼] tab │
│ Proposed by 0xab…cd · Trading · 1d 4h left                   │  [Buy] [Sell]          │
├──────────────────────────────────────────────────────────────┤  Amount USDC [____]   │
│ VERDICT BAR                                                  │  You get ≈ 812 pEDU    │
│ Pass TWAP 0.071 ▲     margin +86.8%     Fail TWAP 0.038 ▼    │  Price impact 0.9%     │
│ ███████████████████████░░░░░░░ threshold 3%                  │  Slippage 1% ⚙         │
├──────────────────────────────────────────────────────────────┤  [Buy Pass]            │
│ DECISION SPLIT CHART                                         │  ────────────          │
│  ─── Pass (solid)  - - - Fail (dashed)  ░ threshold band     │  Your position         │
│  toggles: [Spot] [TWAP observation]  range: 1h 1d All        │  pEDU 812  fUSDC 500   │
│  điểm đánh dấu: ◆ lệnh của agent                             │  [Merge] [Redeem]      │
├──────────────────────────────────────────────────────────────┴────────────────────────┤
│ Tabs: Proposal · Actions · Agents & analysis · Trades · Liquidity                      │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

**Verdict bar:** thanh ngang so sánh 2 TWAP, có vạch threshold. Chữ ở giữa: "Leaning Pass, margin +86.8% (needs +3.0%)". Kèm ghi chú nhỏ: "Based on time-weighted prices. Final result at Nov 21, 14:00."

**Decision Split chart (signature):**
- Trục X là thời gian, trục Y là giá USDC/EDU.
- Đường Pass (liền, màu `pass`), đường Fail (đứt, màu `fail`).
- Dải θ: vùng tô `frost` từ đường Fail lên `Fail × (1+θ)`.
- Vùng trước `twapStart` tô xám nhạt kèm nhãn "Price discovery (not counted)".
- Toggle hiển thị **spot** hoặc **observation (TWAP input)**. Mặc định là observation, vì đó là thứ quyết định kết quả.
- Lệnh của agent hiện dạng ◆ màu `agent` trên đường. Hover cho xem "Hawk (#42) bought 50 USDC of Pass".
- Sau finalize: chart khóa, đường thua mờ 40%, và nhãn lớn "Passed ▲" hoặc "Failed ▼" xuất hiện (khoảnh khắc chuyển động duy nhất).

**Trade panel:**
- Tab chọn Pass/Fail (màu theo phía đang chọn). Bên trong có Buy/Sell.
- Input số tiền (USDC khi Buy, EDU khi Sell), số dư, nút Max.
- Hiển thị: nhận được ước tính, giá trung bình, price impact, phí, slippage (popover chỉnh).
- Giải thích 1 dòng: "Buy Pass if you think this proposal makes EDU worth more. If it fails, you get your fUSDC back."
- Nút chính: "Buy Pass" / "Sell Fail"...
- **Your position:** pTOKEN, fTOKEN, pUSDC, fUSDC, LP. Nút "Merge" (khi có cả 2 loại), "Redeem" (sau resolve).
- States: chưa kết nối ví → "Connect wallet to trade"; Pending → "Trading opens in 12:30"; Finalizable → nút "Finalize decision" (ai cũng bấm được); Passed/Failed → chỉ còn Redeem.

**Tabs dưới:**
1. **Proposal:** nội dung markdown (Newsreader), KPI, file đính kèm. Có badge "Content verified" khi hash khớp on-chain, hoặc cảnh báo khi không khớp.
2. **Actions:** danh sách action đã decode ("Transfer 30,000 USDC → 0x12…ef (Agency X)"), kèm raw calldata thu gọn. Với action cross-chain: "On EduChain L1: setRewardPerMatch(15)".
3. **Agents & analysis:**
   - Bảng forecast: agent (avatar, tên, điểm), trạng thái "Committed" (ẩn số) hoặc "Revealed: 72% Pass", thời điểm commit.
   - Danh sách báo cáo đang bán: agent, tier, giá ("$0.05 via x402"), rating. Nút "Unlock report" mở modal x402 (3.12).
   - Báo cáo đã mua hiển thị inline: summary, pPass, expected prices, key factors (thanh +/-), risks, red flags (viền `fail`).
4. **Trades:** bảng lệnh: thời gian, phía (▲/▼), buy/sell, số lượng, giá, trader (badge "Agent" nếu là agent).
5. **Liquidity:** reserve 2 pool, LP của user, nút "Add liquidity to both" (split & provide).

### 3.8. Create proposal (`/p/[id]/propose`) — wizard 4 bước

1. **Describe:** title, summary, body (markdown + preview), category, KPI (danh sách động).
2. **Actions:** builder theo loại: Transfer USDC / Transfer token / Change budget / Change operator / Change governance params / Execute on L1 (chọn L1, chọn contract trong danh sách đã đăng ký, chọn hàm, nhập tham số) / Advanced (target + calldata raw). Mỗi action có preview câu chữ và cảnh báo nếu vượt % treasury.
3. **Bond & liquidity:** hiển thị bond yêu cầu, min liquidity USDC, lượng EDU tính theo TWAP spot, slider tăng thêm liquidity. Giải thích ngắn: "Your liquidity seeds both markets at the same price. You get it back after the decision."
4. **Review:** tóm tắt, ước tính timeline (warmup → trading → result), rồi chuỗi tx: Upload → Approve USDC → Approve EDU → Propose (hiển thị stepper tx).

### 3.9. Agents leaderboard (`/agents`)

- Bộ lọc theo vai trò (Analyst / Trader / Market maker), sắp xếp (Score, Forecasts, PnL, Reports sold).
- Bảng gồm: hạng, avatar + tên + `#agentId`, role chip, **Forecast score** (0–100 kèm mini histogram), số forecast, PnL (USDC), số report bán, rating trung bình, nhãn "Provisional" nếu < 3 forecast.
- Panel trên cùng giải thích: "Scores are written on-chain to the ERC-8004 Reputation Registry after every decision." Có link tới registry trên explorer.
- Nút "Register your agent".

### 3.10. Agent detail (`/agents/[agentId]`)

- Header: avatar, tên, role, `agentId`, owner, agent wallet, link ERC-8004 NFT trên explorer, link registration file.
- Khối điểm: forecast score, overall, PnL, x402 earned/spent.
- **Calibration chart:** trục X là pPass đã dự báo (chia 10 bin), trục Y là tỉ lệ Pass thực tế. Đường chéo là "perfectly calibrated".
- Lịch sử forecast: proposal, pPass, kết quả, điểm Brier, link tx feedback.
- Services (x402): endpoint, giá, số lượt bán.
- **Live activity** (từ `/status`): quyết định gần nhất kèm lý do rút gọn từ LLM, hiển thị dạng log dọc theo thời gian.
- Tab Feedback: danh sách feedback ERC-8004 (client, value, tag, thời gian).

### 3.11. Register agent (`/agents/register`) — 3 bước
1. Thông tin: name, role, description, avatar, endpoint URL, pricing.
2. Preview registration JSON (có thể chỉnh) → "Upload".
3. Ký tx `register(agentURI)` bằng ví owner, rồi (tùy chọn) ký liên kết agent wallet. Màn hình thành công hiển thị `agentId` và snippet `.env` cho agent runtime.

### 3.12. Modal "Unlock report" (x402)

- Tiêu đề: "Unlock analysis from Sage (#42)".
- Hiển thị: giá $0.05 USDC trên Avalanche Fuji, điểm agent, mô tả nội dung báo cáo.
- Giải thích: "You sign a USDC transfer authorization. No gas needed. Payment settles on Avalanche in about 2 seconds."
- Nút "Pay $0.05 and unlock". Ví mở cửa sổ ký EIP-712 (TransferWithAuthorization).
- States: signing → settling (hiện tx hash khi có) → unlocked (đóng modal, báo cáo hiện inline trong tab) / error (ví dụ "Not enough USDC on Fuji. Get test USDC from the Circle faucet." kèm link).

### 3.13. Portfolio (`/portfolio`)

- Tổng giá trị ước tính.
- Mục **"Needs your action"** (ưu tiên trên cùng): Claim raise, Redeem proposal đã xong, Merge cặp pass/fail, Withdraw liquidity.
- Bảng holdings: project tokens, conditional positions (theo proposal, phía, giá trị nếu Pass / nếu Fail), LP.
- Lịch sử giao dịch.

### 3.14. Chains tab (`/p/[id]/chains`)

- Thẻ L1: tên, blockchainID, RPC, explorer, trạng thái relayer (online/offline).
- Bridge EDU (ICTT): form số lượng, chiều C-Chain → L1, trạng thái message.
- **Live config từ L1**: đọc `GameConfig` (rewardPerMatch, fee). Khi proposal cross-chain được execute, giá trị đổi và có dấu "Updated by proposal #4".
- Danh sách message ICM: messageID, proposal, sentAt, executedAt, status.

### 3.15. About (`/about`)
Giải thích 4 bước bằng minh họa: Raise → Treasury locked → Pass/Fail markets → Market decides. Có FAQ: "What if nobody trades?", "Can the founder still get paid?", "What are agents?", "Is this gambling?" (trả lời: đây là công cụ ra quyết định, testnet, không phải cá cược sự kiện).

---

## 4. Component library

| Component | Biến thể / props chính |
|---|---|
| `Button` | primary (ink), pass, fail, ghost, danger; size sm/md/lg; loading |
| `SideToggle` | Pass/Fail segmented control, đổi màu theo phía |
| `AmountInput` | token selector, balance, Max, lỗi |
| `TxStepper` | danh sách bước tx: idle / waiting signature / pending / confirmed / failed |
| `StatusChip` | Raising, Live, Failed, Pending, Trading, Passed, Failed, Executed |
| `OutcomeBadge` | ▲ Pass / ▼ Fail, có margin |
| `DecisionSplitChart` | props: series pass/fail (spot, obs), threshold, twapStart, agentMarkers, finalized |
| `MiniSplit` | sparkline 2 đường cho list |
| `VerdictBar` | twapPass, twapFail, threshold |
| `ProgressRaise` | contributed, min, cap |
| `AllocationDonut` | 4 phần |
| `AgentAvatar` | ảnh + viền màu `agent` + điểm nhỏ |
| `AgentMarker` | ◆ trên chart |
| `ReportCard` | locked / unlocked |
| `MarkdownReader` | Newsreader, đo dòng 70 ký tự |
| `AddressChip` | rút gọn, copy, link explorer, hiển thị tên agent nếu có |
| `CountdownTimer` | |
| `EmptyState` | tiêu đề + 1 câu + 1 hành động |
| `Toast` | success/error/info, có link tx |

## 5. Trạng thái kỹ thuật chung
- **Sai network:** banner cố định "Switch to Avalanche Fuji" + nút chuyển.
- **Tx pending:** toast có link explorer. Không khóa toàn màn hình.
- **Dữ liệu chain vs indexer:** số dư và giá trong trade panel đọc trực tiếp từ contract. Chart và lịch sử lấy từ indexer. Nếu indexer chậm hơn 30 giây, hiển thị "Syncing…".
- **Accessibility:** contrast AA, focus ring 2px `pass`, mọi icon có label, chart có bảng dữ liệu thay thế (nút "View as table").

---

## 6. Prompt mẫu cho Stitch

Dán phần **Global style** trước mỗi prompt màn hình.

**Global style**
```
Product: Futara, a token launchpad on Avalanche where treasury spending is decided by Pass/Fail prediction markets traded by people and AI agents.
Style: clean, dense financial tool. Cool light theme. Background #F5F7FA, panels #FFFFFF, text #14202B, secondary text #5E6B78, hairlines #DCE6EE.
Pass color #1C6E8C (always with ▲ and the word "Pass", solid lines). Fail color #C4561D (always with ▼ and the word "Fail", dashed lines). AI agent accent #5B4BB7 used only to mark agent activity. Red #E84142 only for the logo.
Fonts: Schibsted Grotesk for UI and numbers (tabular figures); Newsreader serif for long proposal text.
Radius: 8px controls, 12px panels, pill chips. Minimal shadows, separate with 1px lines and whitespace. Left-aligned layout, 12-column grid, max width 1280px.
No uppercase labels, no gradient decorations, no identical card grids. Sentence case copy.
```

**Proposal detail**
```
Design the desktop "Proposal detail" page. Top left: breadcrumb "EDU · Proposal #3 · Spending", title "Hire marketing agency for 3 months", meta line with proposer address, status chip "Trading", countdown "1d 4h left".
Below: a full-width verdict bar comparing "Pass TWAP 0.071 ▲" (left, pass color) and "Fail TWAP 0.038 ▼" (right, fail color) with a threshold tick at +3% and center text "Leaning Pass, margin +86.8% (needs +3.0%)".
Below: the signature "Decision split" line chart: solid Pass line and dashed Fail line over time, a light band above the Fail line showing the 3% threshold, a grey shaded early region labeled "Price discovery (not counted)", small purple diamond markers for AI agent trades. Toggles: Spot / TWAP observation, ranges 1h 1d All.
Right column (sticky): trade panel with Pass/Fail segmented control, Buy/Sell tabs, USDC amount input with balance and Max, estimated output "≈ 812 pEDU", price impact, fee, slippage, primary button "Buy Pass", helper text "Buy Pass if you think this proposal makes EDU worth more." Below it "Your position" with pEDU, fUSDC balances and Merge / Redeem buttons.
Bottom: tabs Proposal · Actions · Agents & analysis · Trades · Liquidity, with the Agents & analysis tab open: a forecasts table (agent avatar, name, score, "Committed" or "Revealed: 72% Pass") and locked report cards with price "$0.05 via x402" and button "Unlock report".
```

**Explore**
```
Design the desktop home page. Hero split: left headline "Funds move only when the market agrees." with subline and buttons "Explore projects" / "Launch a project"; right a live decision split chart card labeled "Live decision · EDU #3 · leaning Pass".
Section "Decisions happening now": horizontal rows, each with project logo, proposal title, a two-line sparkline (solid pass, dashed fail), Pass and Fail prices, "Leaning Pass +8.2%", time left, count of agents participating.
Section "Raising": project cards with progress bar showing min raise and hard cap markers, "$142,300 of $200,000", time left, backers.
Section "Live projects": a table with Project, Price, 7d, Treasury, Proposals passed/failed, Next decision.
Low stats strip at the bottom: Treasury protected, Decisions made, Agent trades, x402 payments settled.
```

**Agent leaderboard**
```
Design the "Agents" leaderboard page. Intro panel: "Scores are written on-chain to the ERC-8004 Reputation Registry after every decision." with an explorer link. Filters: role (Analyst, Trader, Market maker), sort. Table columns: rank, avatar with purple ring + name + #agentId, role chip, forecast score 0–100 with small histogram, forecasts count, PnL in USDC, reports sold, average rating, "Provisional" tag for new agents. Button "Register your agent".
```

**Agent detail**
```
Design the "Agent detail" page for "Hawk (#42), Trader". Header with avatar, role, owner and agent wallet address chips, links to ERC-8004 NFT and registration file. Score row: forecast score, overall, PnL, x402 earned and spent. A calibration chart (predicted Pass probability bins vs actual pass rate, diagonal reference line). A vertical activity log of recent decisions with short reasons ("Bought 50 USDC of Pass, edge +7%, analyst reports agree on revenue upside"). Tables: forecast history with Brier score, x402 services with prices.
```

**Project overview, Raise, Create project wizard, Create proposal wizard, Portfolio, Unlock report modal, Chains tab:** viết prompt theo cùng cấu trúc từ mô tả ở mục 3.2–3.14 (nêu bố cục, dữ liệu mẫu cụ thể, tên nút, các state).

### Dữ liệu mẫu dùng xuyên suốt khi thiết kế
- Project: **EduChain (EDU)**, giá $0.071, raise $200,000 (1.3× oversubscribed), treasury 142,000 USDC + 2,000,000 EDU, budget $5,000/tháng.
- Proposal #3: "Hire marketing agency for 3 months", 30,000 USDC, Trading, Pass TWAP 0.071 / Fail TWAP 0.038.
- Proposal #4: "Raise match reward to 15 wEDU on EduChain L1", cross-chain.
- Agents: Sage (#41, Analyst, score 81.4), Hawk (#42, Trader, score 74.9, PnL +212 USDC), Hawk-Cautious (#43, 68.2), Tide (#44, Market maker).
