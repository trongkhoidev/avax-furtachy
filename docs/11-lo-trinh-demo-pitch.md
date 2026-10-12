# 11 — Lộ trình, Kịch bản demo, Pitch, Checklist nộp bài

## 1. Mốc thời gian của UniHack

| Ngày | Sự kiện |
|---|---|
| 02/11 | Opening, Workshop 1, Team formation, **Challenge Brief** (đọc kỹ, chỉnh định vị nếu brief có track phù hợp) |
| 11/11 | Workshop 2: From Idea to Working MVP |
| 12–15/11 | Technical guidance |
| 17/11 | Workshop 3: Ship & Scale |
| 19–20/11 | Office hours (mang demo đến để mentor góp ý) |
| **24/11** | **Final submission** (Builder Hub ghi hạn 25/11, 05:59 giờ Bangkok) |
| 27/11 | Công bố 10 đội vào chung kết |
| 30/11 | Final Demo Day tại ĐH Tôn Đức Thắng: pitch, demo, Q&A |

## 2. Lộ trình build đề xuất

Có thể bắt đầu ngay trước 02/11 với phần core (không phụ thuộc brief).

| Giai đoạn | Thời gian | Kết quả | Chi tiết |
|---|---|---|---|
| **P0 – Nền móng** | trước 02/11 | Monorepo, CI, AMM + TWAP + Vault có test | File 09 task 1–3 |
| **P1 – Core protocol** | 02–08/11 | Raise, Treasury, Governor, Router, Factory, PerformancePackage. Deploy Fuji + DemoSeed | Task 4–5, 7 |
| **P2 – Data & UI khung** | 06–12/11 | Indexer, API cơ bản, Keeper, thiết kế Stitch, web: Explore, Project, Raise, Proposal detail | Task 8–10, 12 |
| **P3 – Agent economy** | 10–17/11 | ForecastRegistry, ReputationReporter, x402 endpoints, 3 agent chạy thật trên Fuji | Task 6, 9, 11 |
| **P4 – Avalanche L1** | 14–20/11 | L1 EduChain, ICTT, GovernanceMessenger/Executor, tab Chains | Task 13 |
| **P5 – Hoàn thiện** | 19–23/11 | Sửa theo góp ý office hours, polish UI, video demo, slide, README repo | Task 14 |
| **Buffer** | 24/11 | Nộp bài sớm nhiều giờ trước hạn | |
| **P6 – Chung kết** | 27–30/11 | Tập pitch, chuẩn bị Q&A, dựng sẵn trạng thái demo | |

## 3. Kịch bản demo trực tiếp (5 phút)

**Chuẩn bị trước:**
- Project EDU đã Live, treasury có tiền, có 2 proposal đã finalize (1 Pass, 1 Fail), giúp leaderboard agent có dữ liệu.
- **Proposal A** ("Hire marketing agency") được tạo với preset demo sao cho `tradingEnd` rơi vào khoảng phút thứ 3 của phần demo.
- **Proposal B** (cross-chain) đã PASS, message ICM sẵn sàng, hoặc được tạo trước để kết quả rơi vào trong demo.
- Terminal chạy agent log (Sage, Hawk) để chiếu song song.

**Kịch bản:**

| Thời gian | Nội dung nói | Thao tác trên màn hình |
|---|---|---|
| 0:00–0:30 | "Launchpad hiện nay: raise xong là tiền nằm trong ví founder. Futara thì khác: tiền chỉ được chi khi thị trường đồng ý." | Trang Explore, hero với chart đang chạy |
| 0:30–1:15 | "Đây là EduChain đã raise 200k USDC, quá cap 1,3 lần, mọi người được phân bổ công bằng. Tiền nằm trong treasury, founder chỉ rút được 5k mỗi tháng." | Project → Raise → Treasury guard |
| 1:15–2:30 | "Founder muốn chi 30k cho marketing. Thay vì bỏ phiếu, có 2 thị trường: Pass và Fail. Giá Pass là giá EDU nếu chi, giá Fail là nếu không chi." | Proposal A: verdict bar, split chart, chỉ dải threshold |
| 2:30–3:15 | "Không ai rảnh phân tích mọi proposal, nên AI agent làm việc đó. Hawk vừa trả 5 cent qua x402 để mua báo cáo của Sage, rồi đặt lệnh. Bạn thấy dấu ◆ trên chart." | Tab Agents & analysis, bấm "Unlock report", ký x402 trực tiếp, báo cáo hiện ra. Màn terminal hiện log Hawk |
| 3:15–3:45 | Proposal A kết thúc → bấm "Finalize decision". "Thị trường nói Pass, tiền tự động chuyển." | Khoảnh khắc chart khóa, nhãn "Passed ▲", tx explorer |
| 3:45–4:20 | "Mỗi agent bị chấm điểm on-chain theo chuẩn ERC-8004. Ai dự đoán đúng thì reputation tăng, và đó là danh tính dùng được ở mọi app khác." | Agents leaderboard → Agent detail → link Reputation Registry trên explorer |
| 4:20–5:00 | "Và vì đây là Avalanche, quyết định trên C-Chain có thể điều khiển L1 riêng của dự án. Proposal này vừa đổi phần thưởng trong game trên EduChain L1 qua ICM." | Tab Chains: `rewardPerMatch` 10 → 15, message ICM executed |

**Kế hoạch B:** quay sẵn video demo đầy đủ (≤ 3 phút) để phát nếu mạng lỗi.

## 4. Dàn ý slide pitch (10–12 slide)

1. **Futara**: "Funds move only when the market agrees." Kèm tên team.
2. **Problem:** rug pull và chi tiêu sai mục đích trên launchpad (dẫn số liệu và ví dụ thực tế, tự tra cứu và ghi nguồn). Token voting thì không hiệu quả.
3. **Insight:** futarchy biến niềm tin thành tiền. Nhưng futarchy chết vì thanh khoản thấp, và AI agent có thể lấp khoảng trống đó.
4. **Solution:** 3 lớp (Launchpad, Futarchy, Agent economy) và vì sao chúng cần nhau.
5. **How it works:** sơ đồ 4 bước (Raise → Treasury → Pass/Fail → Execute).
6. **Agent economy:** x402 (agent mua/bán phân tích), ERC-8004 (danh tính + reputation tự động).
7. **Built on Avalanche:** C-Chain, x402 với USDC Fuji, ERC-8004 registry trên Fuji, L1 riêng, ICM, ICTT. Kèm sơ đồ.
8. **Demo** (chuyển sang live).
9. **Technical depth:** contract list, lagging TWAP, commit-reveal, test coverage, số tx thực trên Fuji.
10. **Business model:** phí launch (% raise), phí AMM cho protocol, doanh thu x402 từ data API, phí đăng ký Futarchy-as-a-Service cho L1.
11. **Roadmap:** mainnet + audit, nhiều proposal song song, Validation Registry (TEE), Futarchy-as-a-Service cho L1, eERC.
12. **Team & ask:** Team1 Builder Grant (Mini Grant), mentorship.

## 5. Chuẩn bị Q&A

| Câu hỏi có thể gặp | Hướng trả lời |
|---|---|
| "Đây có phải cờ bạc không?" | Không. Người tham gia đánh giá tác động của quyết định lên giá trị dự án mà họ sở hữu, giống cổ đông. Không có sự kiện ngoài đời được đặt cược. Hiện chỉ chạy testnet |
| "Cá voi mua Pass thì sao?" | Muốn đổi TWAP phải giữ giá lệch hàng giờ. Arbitrageur và agent sẽ lấy tiền của họ. Thao túng là tự trả tiền cho người đúng |
| "Nếu không ai trade?" | Proposer buộc seed liquidity, market maker agent luôn hoạt động. Thêm threshold 3% nghĩa là không ai trade thì giữ nguyên hiện trạng (Fail), an toàn cho treasury |
| "Agent bị prompt injection?" | LLM chỉ ước lượng, còn code quyết định kích thước lệnh với giới hạn cứng. Agent sai thì tự mất tiền và mất reputation |
| "Khác MetaDAO thế nào?" | Lớp agent + reputation ERC-8004 + x402, và governance xuyên chain cho Avalanche L1 |
| "Vì sao Avalanche?" | Finality nhanh, phí thấp (cần cho crank TWAP và micropayment). ERC-8004 và x402 đã có trên Avalanche. L1 + ICM cho phép futarchy điều khiển nhiều chain |
| "Founder có động lực gì?" | Được tin tưởng dù vô danh, có budget hằng tháng, và performance package mở khóa khi token tăng giá thật |

## 6. Checklist nộp bài (Builder Hub)

- [ ] Repo GitHub **public**, README gồm: mô tả 1 đoạn, sơ đồ kiến trúc, link demo, địa chỉ contract Fuji (đã verify), hướng dẫn chạy local, video demo
- [ ] Slide pitch (PDF + link)
- [ ] Video demo ≤ 3 phút
- [ ] Link web app chạy trên Fuji
- [ ] Danh sách contract + link explorer (C-Chain và L1)
- [ ] Link ERC-8004 agent NFT của các agent demo, kèm ví dụ tx feedback
- [ ] Ví dụ tx x402 settle trên Fuji
- [ ] Ví dụ message ICM (messageID, tx 2 đầu)
- [ ] Thêm đủ thành viên team trên Builder Hub
- [ ] Nộp trước hạn **ít nhất 12 giờ**
- [ ] Đăng ký Luma: Demo Day, workshop, office hours
- [ ] Tham gia minigame Builder Pass (`team1vn.xyz`)
