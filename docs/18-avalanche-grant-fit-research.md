# WolfDAO: khả năng xin grant trong hệ Avalanche

**Ngày tra cứu:** 12-10-2026  
**Phạm vi:** đối chiếu trang Immunefi được gửi với các tuyến grant Avalanche và trạng thái dự án ghi trong repo.

## Kết luận

**Không thể dùng trang Immunefi này để xin grant cho WolfDAO.** Đây là chương trình bug bounty của Ava Labs: trả thưởng cho người báo cáo lỗ hổng ảnh hưởng các tài sản nằm trong phạm vi của chương trình. Trang hiện gắn nhãn **Paused**, nêu mức bounty tối đa 100.000 USD, yêu cầu PoC và KYC. Điều khoản cũng nói rõ smart contract của bên thứ ba triển khai trên Avalanche nằm ngoài phạm vi. Vì vậy, việc WolfDAO xây trên Avalanche không khiến WolfDAO đủ điều kiện nhận khoản tiền này.

**Tuyến grant gần nhất là Team1 Mini Grants.** Trang Team1 hiện mô tả đây là hồ sơ mở cho builder giai đoạn đầu, tối đa 10.000 USD; Avalanche Builder Hub cũng phân loại Team1 Builder Grants riêng với Security Bug Bounty. Ý tưởng WolfDAO phù hợp về mặt loại dự án và hệ sinh thái, nhưng hồ sơ hiện có hai điểm yếu: chưa có deployment hay giao dịch Fuji được xác nhận, và cổng nộp hồ sơ công khai hiện ghi chỉ dành cho Ấn Độ. Nếu nhóm dự định nộp từ Việt Nam, điều kiện địa lý là trở ngại cần được Team1 xác nhận.

## Trang được gửi đang cung cấp gì?

Immunefi liệt kê chương trình dưới tên **Ava Labs Avalanche**. Trang thông tin mô tả các mức thưởng theo mức độ lỗ hổng; trang phạm vi nói các smart contract của bên thứ ba trên Avalanche bị loại trừ và chỉ các tài sản được liệt kê cho chương trình mới thuộc phạm vi. Đây là phần thưởng cho báo cáo bảo mật, không phải nguồn vốn để xây sản phẩm. [Thông tin chương trình](https://immunefi.com/bug-bounty/avalanche/information/) · [Phạm vi chương trình](https://immunefi.com/bug-bounty/avalanche/scope/)

Trang [Avalanche Builder Hub – Grants](https://build.avax.network/grants) cũng đặt Security Bug Bounty thành một mục riêng, bên cạnh các chương trình grant. Trang Immunefi đang hiển thị trạng thái **Paused** và yêu cầu PoC/KYC; mức tối đa được hiển thị là 100.000 USD. Đây không phải lời mời cho một dự án muốn xin ngân sách phát triển.

## Tuyến grant phù hợp hơn

### Team1 Mini Grants

Trang [Team1 Builder Grants](https://www.team1.network/grants) hiện ghi Mini Grants đang mở nhận hồ sơ, dành cho builder/dự án mới hoặc đã thành lập, với mức tối đa 10.000 USD. Trang nêu rõ tham gia hoặc nộp hồ sơ không bảo đảm được tài trợ. [Avalanche Builder Hub](https://build.avax.network/grants/team1-mini-grants) mô tả chương trình hỗ trợ nhà phát triển ứng dụng, smart contract và các đóng góp cho hệ sinh thái.

Trang nộp hồ sơ [grants.team1.network](https://grants.team1.network/) mô tả quy trình đi từ hồ sơ và đánh giá, qua phỏng vấn, đến milestone và giải ngân theo tiến độ để xây MVP. Họ yêu cầu thông tin như litepaper/whitepaper, prototype, market analysis và đội ngũ. Cùng trang đó hiện ghi **“Only in India (Globally coming soon)”**. Vì vậy, trạng thái chương trình được quảng bá là mở nhưng phạm vi địa lý trên cổng nộp hồ sơ chưa mở toàn cầu; hồ sơ từ Việt Nam chưa thể xem là đủ điều kiện dựa trên thông tin công khai hiện tại.

### Các lựa chọn khác

- [Avalanche Research Proposals](https://academy.avax.network/grants/avalanche-research-proposals) cấp tối đa 50.000 USD cho nghiên cứu học thuật về định giá cryptoasset hoặc kinh tế validator/an ninh mạng; trang hiện nói đã đóng nhận hồ sơ. Đây không phải tuyến chính cho sản phẩm WolfDAO.
- [Blizzard Fund](https://www.blizzard.fund/) mô tả mình là quỹ đầu tư venture capital, gồm cả Seed và Series A, nên đây là hướng gọi vốn đầu tư chứ không phải grant không pha loãng.

## Mức độ phù hợp của WolfDAO

| Tiêu chí | Bằng chứng hiện có | Nhận định |
|---|---|---|
| Phù hợp Avalanche | Repo thiết kế launchpad/futarchy trên C-Chain, cùng các tích hợp x402, ERC-8004 và hướng mở rộng L1 qua ICM/Teleporter, ICTT. | **Tốt về định hướng.** Cần chứng minh Avalanche là một phần thiết yếu của sản phẩm bằng một luồng chạy được trên Fuji. |
| Có prototype và khả năng giao hàng | Repo có giao diện sản phẩm, API/agent/keeper scaffold và Solidity contracts; README nêu rõ dữ liệu EduChain là demo fixture. | **Có nền tảng để nộp Mini Grant**, nhưng hồ sơ cần demo/artefact dễ kiểm chứng. README hiện nói chưa có deployment Fuji hoặc giao dịch đã settle; không thấy artifact deployment trong repo. |
| Bằng chứng người dùng/thị trường | Tài liệu có mô tả vấn đề, persona và so sánh đối thủ. | **Chưa đủ bằng chứng công khai trong repo** về phỏng vấn người dùng, tester, khách hàng, hoạt động cộng đồng hoặc traction. Cần bổ sung trước khi nộp để giảm rủi ro bị xem là chỉ có ý tưởng. |
| Tính tập trung của MVP | Phạm vi đề xuất kết hợp launchpad, thị trường Pass/Fail, treasury, agent, x402, ERC-8004 và cross-chain. | **Rủi ro scope.** Nên xin tiền cho một mốc nhỏ, đo được: hoàn tất một luồng raise → proposal Pass/Fail → quyết định treasury trên Fuji; bổ sung một tích hợp agent sau khi luồng lõi ổn định. Đây là khuyến nghị suy ra từ phạm vi hiện tại, không phải điều kiện chính thức của Team1. |
| Sẵn sàng hồ sơ | Người dùng xác nhận **WolfDAO** là tên chính thức. `README.md` gốc và một số tài liệu sản phẩm trong repo vẫn còn tên/branding cũ; `docs/README.md` đã dùng WolfDAO và nói bối cảnh UniHack Vietnam. | **Cần chuẩn hóa branding theo WolfDAO** trước khi gửi hồ sơ. Litepaper, demo, repo và application phải dùng cùng một tên, đồng thời phân biệt rõ dữ liệu demo với dữ liệu on-chain thật. |

Đánh giá trong bảng dựa trên [README](../README.md), [tổng quan sản phẩm](01-tong-quan-san-pham.md), [danh mục tài liệu](README.md) và các contract hiện có trong `packages/contracts/src/`. Tên chính thức WolfDAO được lấy theo xác nhận của người dùng; một số file trong repo vẫn cần cập nhật branding. Trạng thái deployment được lấy từ README và danh sách artifact hiện có.

## Việc nên chuẩn bị trước khi nộp

1. Xác nhận Team1 có nhận hồ sơ từ quốc gia nơi nhóm đăng ký hay không; cổng hiện hiển thị giới hạn Ấn Độ.
2. Dùng thống nhất tên **WolfDAO** trong repo và mọi tài liệu gửi đi; cập nhật các mô tả sản phẩm còn branding cũ.
3. Chuẩn bị litepaper ngắn, market/competitor analysis, vai trò từng thành viên, ngân sách theo milestone, và tiêu chí hoàn thành có thể kiểm tra trên Fuji.
4. Có demo tối thiểu cho một luồng giao dịch testnet và ghi lại địa chỉ contract/transaction; nhãn demo cần phân biệt rõ dữ liệu giả lập với dữ liệu on-chain.
5. Thu thập phản hồi từ nhóm founder/backer hoặc cộng đồng Avalanche và đưa số liệu, trích dẫn hay thư quan tâm vào hồ sơ. Hướng dẫn chung của Avalanche Foundation nhấn mạnh ecosystem fit, khả năng giao sản phẩm, traction cộng đồng và tác động dài hạn. Đây là hướng dẫn chung, không khẳng định Team1 dùng đúng cùng một bộ chấm điểm. [Tiêu chí grant](https://academy.avax.network/academy/entrepreneur/fundraising-finance/10-grants/02-success-criteria)

## Nguồn đã kiểm tra

- [Ava Labs Avalanche Bug Bounty – Information](https://immunefi.com/bug-bounty/avalanche/information/)
- [Ava Labs Avalanche Bug Bounty – Scope](https://immunefi.com/bug-bounty/avalanche/scope/)
- [Avalanche Builder Hub – Grants](https://build.avax.network/grants)
- [Team1 Builder Grants](https://www.team1.network/grants)
- [Team1 Mini Grants application portal](https://grants.team1.network/)
- [Team1 Mini Grants trên Avalanche Builder Hub](https://build.avax.network/grants/team1-mini-grants)
- [Avalanche Foundation grant evaluation guidance](https://academy.avax.network/academy/entrepreneur/fundraising-finance/10-grants/02-success-criteria)
- [Avalanche Research Proposals](https://academy.avax.network/grants/avalanche-research-proposals)
- [Blizzard Fund](https://www.blizzard.fund/)
