# 01 — Tổng quan sản phẩm

## 1. Vấn đề

### 1.1. Launchpad hiện nay: tiền vào tay founder là hết kiểm soát
- Trên các launchpad phổ biến (kiểu pump.fun, các IDO platform), khi raise xong thì **toàn bộ tiền chuyển về ví founder hoặc multisig của team**. Nhà đầu tư không có cơ chế nào để ngăn founder tiêu tiền sai mục đích, rút tiền bỏ trốn (rug pull) hoặc bán xả.
- Biện pháp hiện có (vesting, multisig, audit) chỉ **trì hoãn** chứ không **gắn việc chi tiêu với giá trị**.
- Quản trị bằng token voting (1 token = 1 phiếu) có nhiều vấn đề: cá voi áp đảo, người nắm token thờ ơ không đi bỏ phiếu, và phiếu bầu không tốn chi phí nên không phản ánh niềm tin thật.

### 1.2. Futarchy giải quyết được, nhưng có điểm yếu chết người: thanh khoản
- Futarchy (Robin Hanson đề xuất, MetaDAO triển khai trên Solana) thay bỏ phiếu bằng thị trường. Ai tin quyết định tốt thì phải **bỏ tiền** đặt cược.
- Vấn đề thực tế: với dự án nhỏ, **rất ít người trade** các market pass/fail. Giá dễ bị thao túng hoặc đứng im, quyết định trở nên ngẫu nhiên.
- Người dùng phổ thông cũng **không có thời gian phân tích** từng proposal.

### 1.3. AI agent có năng lực nhưng thiếu "chỗ làm" và thiếu uy tín kiểm chứng được
- Agent có thể đọc proposal, phân tích dữ liệu on-chain và đặt lệnh 24/7, nhưng:
  - Không có cách chuẩn để biết agent nào đáng tin. Reputation hiện nằm trong các nền tảng đóng.
  - Không có cơ chế thanh toán máy-với-máy rẻ và nhanh cho dữ liệu hay phân tích.

## 2. Giải pháp: Futara

Futara gồm 3 lớp gắn chặt với nhau:

| Lớp | Vai trò | Công nghệ |
|---|---|---|
| **Launchpad** | Gọi vốn công bằng (fair raise, pro-rata), tự tạo token, pool thanh khoản và treasury khóa | Solidity trên Avalanche C-Chain |
| **Futarchy Governance** | Mọi khoản chi từ treasury phải qua cặp thị trường Pass/Fail. Chỉ thực thi nếu TWAP Pass cao hơn TWAP Fail một biên θ | Conditional vault, CPMM AMM, lagging TWAP oracle |
| **Agent Economy** | AI agent có danh tính ERC-8004 phân tích và trade, bán phân tích qua x402, được chấm điểm reputation tự động dựa trên độ chính xác dự đoán | ERC-8004 registries, x402 (USDC EIP-3009), LLM |

Lớp mở rộng **Avalanche-native**: dự án có thể có **Avalanche L1 riêng**. Token được bridge qua **ICTT**, và quyết định futarchy được thực thi xuyên chain qua **ICM/Teleporter** (xem file 06).

### 2.1. Vì sao 3 lớp này phải đi cùng nhau (không phải gộp cho có)
- Launchpad cần futarchy để **chống rug**. Đây là giá trị cốt lõi cho nhà đầu tư.
- Futarchy cần agent để **có thanh khoản và price discovery**. Đây là lời giải cho điểm yếu lớn nhất của futarchy.
- Agent cần futarchy để **có môi trường kiếm tiền và tạo reputation kiểm chứng được**. Kết quả pass/fail là "ground truth" khách quan để chấm điểm agent.
- x402 là **đường ống thanh toán** để agent mua dữ liệu và phân tích của nhau. Nhờ đó hình thành thị trường thông tin quanh mỗi quyết định.

## 3. Người dùng (personas)

| Persona | Mục tiêu | Hành động chính trên Futara |
|---|---|---|
| **Founder** (sinh viên khởi nghiệp, team indie) | Gọi vốn nhanh, được tin tưởng dù chưa có tên tuổi | Tạo project, raise, đề xuất chi tiêu, nhận ngân sách vận hành hằng tháng |
| **Backer** (nhà đầu tư nhỏ lẻ) | Đầu tư mà không sợ bị rug | Góp USDC, nhận token, trade Pass/Fail, đọc phân tích của agent |
| **Trader** (người am hiểu) | Kiếm lời từ thông tin tốt | Trade conditional market, kiếm lời khi đúng |
| **Agent operator** (dev AI) | Kiếm tiền từ agent | Đăng ký agent ERC-8004, chạy agent trade + bán phân tích qua x402, tích lũy reputation |
| **Data provider** | Bán dữ liệu | Mở endpoint x402 (ví dụ chỉ số on-chain, dữ liệu GitHub của dự án) |

## 4. User journey tóm tắt

1. **Founder** tạo project "EduChain" và nhập thông tin: raise tối thiểu 50.000 USDC, hard cap 200.000 USDC, kéo dài 3 ngày, ngân sách vận hành 5.000 USDC/tháng.
2. **Backer** góp USDC. Kết thúc raise với 260.000 USDC góp vào, vượt cap. Mỗi người được chấp nhận 200/260 số tiền đã góp và nhận phần dư hoàn lại.
3. Hệ thống tự động mint token, tạo pool spot `EDU/USDC`, chuyển phần còn lại vào **Treasury**, và khóa phần token của founder theo cột mốc giá.
4. Founder tạo proposal *"Chi 30.000 USDC thuê agency marketing X trong 3 tháng"*, kèm bond và thanh khoản ban đầu.
5. Hai market `pEDU/pUSDC` và `fEDU/fUSDC` mở trong 3 ngày.
6. **Agent A** (đã đăng ký ERC-8004) mua báo cáo dữ liệu từ **Agent B** qua x402 với giá $0.05. Agent A kết luận khoản chi này đáng giá, commit dự báo on-chain rồi mua `pEDU`.
7. Backer xem bảng xếp hạng agent và đọc tóm tắt phân tích (trả $0.02 qua x402), sau đó tự trade.
8. Hết hạn: TWAP_pass = 1.12, TWAP_fail = 1.04. Vì 1.12 > 1.04 × 1.03 nên **PASS**. Treasury tự động chuyển 30.000 USDC cho agency.
9. Người giữ `pUSDC`/`pEDU` redeem 1:1. Token `f*` trở về 0.
10. Contract `ReputationReporter` chấm điểm dự báo của mọi agent và ghi feedback vào **ERC-8004 Reputation Registry**.

## 5. Value proposition

| Đối tượng | Giá trị |
|---|---|
| Backer | Tiền nằm trong treasury, mọi khoản chi phải được thị trường chấp thuận nên **không thể bị rug**. Có thể "phản đối bằng tiền" bằng cách mua Fail và kiếm lời nếu đúng. |
| Founder | Có **uy tín mặc định** dù vô danh, vì nhà đầu tư biết tiền được bảo vệ. Vẫn có ngân sách vận hành hằng tháng để làm việc. |
| Agent operator | **Thị trường kiếm tiền mới** (trade + bán phân tích) và **reputation on-chain di động** (ERC-8004) dùng được ở mọi app khác. |
| Hệ sinh thái Avalanche | Showcase cho x402 + ERC-8004 trên Avalanche, kèm use case cho L1 + ICM/ICTT (governance xuyên chain). |

## 6. Khác biệt so với đối thủ

| | Pump.fun / launchpad thường | MetaDAO (Solana) | Snapshot / token voting | **Futara** |
|---|---|---|---|---|
| Chống rug | Không | Có | Một phần | **Có** |
| Quyết định dựa trên | Founder | Thị trường | Phiếu bầu | **Thị trường** |
| Giải quyết thanh khoản thấp | — | Chưa triệt để | — | **AI agent + x402** |
| Reputation người dự báo | — | Không | — | **ERC-8004 on-chain** |
| Chain | Solana/EVM | Solana | Off-chain | **Avalanche (+ L1, ICM)** |

## 7. Mapping với tiêu chí chấm UniHack

| Tiêu chí | Futara đáp ứng thế nào | Bằng chứng khi demo |
|---|---|---|
| **Value proposition** | Chống rug cho launchpad, giải bài toán thanh khoản của futarchy, tạo thị trường cho AI agent | Demo một proposal xấu bị agent và thị trường "bác bỏ", treasury giữ nguyên |
| **Technical complexity** | Conditional vault, CPMM, lagging TWAP oracle, commit-reveal forecast, agent tự trị, x402, cross-chain execution | Repo có test coverage cao, invariant test, kiến trúc đa thành phần |
| **Usage of Avalanche technologies** | C-Chain (Fuji), ERC-8004 registry trên Fuji, x402 với USDC Fuji, Avalanche L1 riêng cho dự án, ICM/Teleporter, ICTT | Tx trên Snowtrace/Avalanche Explorer, message ICM giữa C-Chain và L1 |

## 8. Phạm vi (scope)

### In scope
- Launchpad đầy đủ: tạo project, raise pro-rata, refund, finalize, mint, spot pool, treasury.
- Futarchy đầy đủ: proposal, conditional vault, 2 AMM, lagging TWAP, finalize, execute, redeem.
- Ngân sách vận hành hằng tháng cho founder.
- Gói thưởng founder mở khóa theo cột mốc giá (performance package).
- Agent: tối thiểu 3 agent mẫu (Analyst, Trader, Market Maker). Có đăng ký ERC-8004, giao dịch thật, bán phân tích qua x402.
- ForecastRegistry (commit-reveal) và ReputationReporter ghi vào ERC-8004.
- API dữ liệu trả phí x402.
- Avalanche L1 demo cho một project kèm ICTT và ICM execution.
- Web app đầy đủ (xem file 08).

### Out of scope (ghi vào phần "Future work" khi pitch)
- Mainnet, audit chuyên nghiệp.
- Nhiều proposal song song trên cùng một project.
- Validation Registry của ERC-8004 (TEE/zk validation).
- Token hóa cổ phần pháp lý / KYC.
