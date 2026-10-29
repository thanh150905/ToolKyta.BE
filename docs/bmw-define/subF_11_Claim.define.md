# Define — subF_11_Claim (Claim nghiệm thu/quyết toán)

> Export đầy đủ từ `subF_11_Claim.xlsx` (142 dòng). Nguồn chuẩn đối chiếu field cho agent thực thi. KHÔNG sửa tay — sửa thì export lại.
>
> ⚠️ **ĐỌC KỸ — khối công thức `bangThanhToan` (dòng 95→142) có 2 BIẾN THỂ theo `claimType`, trình bày SONG SONG trên cùng 1 dòng:**
> - **Cột trái** (`Tên trường | Định dạng | Code | Required(=Giá trị mẫu)`) = **`ClaimType = Claim hàng kỳ`** → luồng **SD.01.01 (nghiệm thu theo đợt)**.
> - **Cột phải** (sau cột "Chỉ đọc": `Mô tả | Logic lấy data | Logic đẩy data | Logic ẩn hiện`) = **`ClaimType = Claim Quyết toán`** → luồng **SD.01.02.02 (quyết toán hợp đồng)**.
> - Cùng 1 ký hiệu (C1.1, C2, C4...) nhưng **công thức KHÁC NHAU** giữa 2 luồng (vd quyết toán: C1.1 lấy `0`; C2 = `C10*(1-% Thanh toán quyết toán)*(-1)`). Widget/logic phải **branch theo `claimType`**.
> - Các dòng field thường (6→93) thì 2 cột trùng nội dung — đọc cột trái là đủ.

| # | Tên trường thông tin | Định dạng (yêu cầu chọn  | Code | Required | Display | Chỉ đọc | Mặc định | Dữ liệu mẫu: Giá trị exa | Mô tả | Logic lấy data | Logic đẩy data | Logic ẩn hiện |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 |  |  |  |  |  |  |  | - Mặc định không viết gì là người dùng nhập |  |  | - Trường này có được dùng để MERGEFIELD không? |  |
| 5 | subF_1_SD | SubForm |  |  |  | x |  |  | Lấy các trường dữ liệu từ subF_1_SD |  |  |  |
| 6 | Số Claim | Input text | claimNo | x | x | x |  |  | Hệ thống tự sinh khi lưu claim lần đầu, NSD không nhập, không sửa. |  |  |  |
| 7 |  |  |  |  |  |  |  |  | Quy tắc: Claim/Mã BCH/[Loại hồ sơ: TU/HK/QT/GL]/[Đợt nghiệm thu]. |  |  |  |
| 8 |  |  |  |  |  |  |  |  | VD: BCH D.26.004-01.01, claim hàng kỳ đợt 3 → Claim/D.26.004-01.01/HK/Đợt3. |  |  |  |
| 9 |  |  |  |  |  |  |  |  | Mã là duy nhất. Claim bị Hủy giữ nguyên mã, không cấp lại cho claim khác. |  |  |  |
| 10 |  |  |  |  |  |  |  |  | --> Claim bị hủy làm trùng mã. Ví dụ nếu claim đợt 3 bị hủy rồi tạo lại đợt 3, mã sẽ trùng với claim đã hủy. |  |  |  |
| 11 |  |  |  |  |  |  |  |  | Thêm hậu tố lần tạo Claim/Mã BCH/[Loại hồ sơ: TU/HK/QT/GL]/[Đợt nghiệm thu]/STT (STT giá trị khởi tạo = 2 và STT += 1 ) ,Ví dụ Claim/D.26.004-01.01/HK/Đợt3/Lần2. |  |  |  |
| 12 | Loại hồ sơ | Dropdown | claimType |  |  |  |  |  | Lấy từ Catalog: ClaimType |  |  |  |
| 13 |  |  |  |  |  |  |  |  | Trường dữ liệu: ClaimType |  |  |  |
| 14 |  |  |  |  |  |  |  |  | Chỉ lấy các giá trị : |  |  |  |
| 15 |  |  |  |  |  |  |  |  | +Claim hàng kỳ |  |  |  |
| 16 |  |  |  |  |  |  |  |  | +Claim quyết toán |  |  |  |
| 17 | Mã dự án | Dropdown | WBSElement | x | x |  |  |  |  | Lấy từ catalog : Project |  |  |
| 18 |  |  |  |  |  |  |  |  |  | -Trường : Project ID |  |  |
| 20 |  |  |  |  |  |  |  |  |  | Check điều kiện: chỉ hiển thị mã dự án của user thuộc dự án. |  |  |
| 21 |  |  |  |  |  |  |  |  |  | Logic: Kiểm tra dữ liệu user theo catalog bảng: Approval Matrix, trường: acc mail. Và trạng thái = "1" |  |  |
| 22 | Số hợp đồng gốc | Input text | SalesContract | x | x | x |  |  |  | Lấy mã  hợp đồng tương ứng với mã dự án ở trạng thái hoàn tất |  |  |
| 23 | Mã BCH | Dropdown | WBSElement_LV2 | x | x |  |  |  |  | Join trường: Project ID Giữa 2 bảng: Project và Approval Matrix project |  |  |
| 24 |  |  |  |  |  |  |  |  |  | Để giá trị trường: BCH theo Project ID |  |  |
| 25 | BOQ triển khai | Input text | BOQID | x | x | x |  |  |  | Tự điền theo BCH đã chọn (1 BCH = 1 BOQ). Chỉ lấy BOQ đã duyệt. BCH chưa có BOQ đã duyệt thì chặn tạo claim |  |  |
| 26 | Claim kỳ trước tham chiếu | Dropdown | prevClaimNo | x | x |  |  |  |  |  |  |  |
| 27 |  |  |  |  |  |  |  |  |  | Hệ thống cho chọn khi : NSD đã chọn Mã dự án và Mã BCH |  |  |
| 28 |  |  |  |  |  |  |  |  |  | Logic lấy dữ liệu : Lấy những claim nào: claim cùng Mã dự án + Ban chỉ huy, Trạng thái = Hoàn tất, sắp xếp đợt mới nhất lên đầu. |  |  |
| 29 |  |  |  |  |  |  |  |  |  | ---> Nếu hệ thống KHÔNG tìm claim cùng Mã dự án + Ban chỉ huy, Trạng thái = Hoàn tất ---> Thì "Claim kỳ trước tham chiếu" == Đợt đầu |  |  |
| 30 |  |  |  |  |  |  |  |  |  | Giá trị hiển thị: |  |  |
| 31 |  |  |  |  |  |  |  |  |  | +Trong danh sách: Số Claim VD: Claim/D.26.004-01.01/HK/Đợt3. |  |  |
| 33 |  |  |  |  |  |  |  |  |  | Nếu cùng Mã dự án + Mã BCH và claim có "Approvalstatus" != Hoàn thành / Hủy thì chặn tạo claim mới, báo "Còn claim [Số Claim] chưa hoàn tất". |  |  |
| 34 |  |  |  |  |  |  |  |  |  | Nếu cùng Mã dự án + Mã BCH và "Loại hồ sơ" = Quyết toán claim có "Approvalstatus" = Hoàn thành thì chặn tạo claim mới, báo "Claim đã tạo quyết toán". |  |  |
| 35 | Đợt nghiệm thu | Number | BillingPlanItem | x | x | x |  |  |  | Tự động, NSD không nhập. |  |  |
| 36 |  |  |  |  |  |  |  |  |  | Đợt = Đợt của Claim kỳ trước tham chiếu + 1. Không có Claim kỳ trước (đợt đầu) thì Đợt = 1. |  |  |
| 37 |  |  |  |  |  |  |  |  |  | Đánh số riêng theo từng Mã dự án + Ban chỉ huy (mỗi BCH bắt đầu từ đợt 1). |  |  |
| 38 |  |  |  |  |  |  |  |  |  | Claim bị Hủy không tính; claim mới lấy theo claim Hoàn tất gần nhất. |  |  |
| 39 |  |  |  |  |  |  |  |  |  | Giá trị lưu là số (1, 2, 3…). |  |  |
| 40 |  |  |  |  |  |  |  |  |  | ---> Gái trị hiển thị dạng "Đợt [số] / [Mã BCH]", VD: Đợt 1 / D.26.004-01.01. |  |  |
| 41 |  |  |  |  |  |  |  |  |  | Nếu "Claim kỳ trước tham chiếu" == "Đợt đầu" --> "Đợt nghiệm thu" == Đợt 1 / Mã BCH |  |  |
| 42 | Chủ đầu tư | Input text | SoldToParty | x | x | x |  |  |  | Kế thừa từ Hợp đồng có "Số hợp đồng gốc tương ứng" |  |  |
| 43 | Gói thầu | Input text | Bidpackage | x | x | x |  |  |  | Kế thừa từ Hợp đồng có "Số hợp đồng gốc tương ứng" |  |  |
| 44 | Tiền tệ | Input text | TransactionCurrency | x | x | x |  |  |  | Kế thừa từ Hợp đồng có "Số hợp đồng gốc tương ứng" |  |  |
| 45 | Kênh dự án | Input text | SalesOrganization | x | x | x |  |  |  | Kế thừa từ Hợp đồng có "Số hợp đồng gốc tương ứng" |  |  |
| 46 | Mã tracking từ HĐ CĐT | Input text | CustomerReference | x | x | x |  |  |  | Kế thừa từ Hợp đồng có "Số hợp đồng gốc tương ứng" |  |  |
| 47 | Thông tin đợt |  |  |  |  |  |  |  |  |  |  |  |
| 48 | Ngày nghiệm thu | Datepicker | BillingPlanBillingDate | x | x |  |  |  |  |  |  |  |
| 49 | Ngày kết thúc kỳ | Datepicker | periodEndDate |  | x |  |  |  |  |  |  |  |
| 50 | Ngày thanh toán dự kiến | Datepicker | expectedPaymentDate |  | x |  |  |  |  |  |  |  |
| 51 | Thuế suất GTGT(%) | Number | TaxAmount | x | x |  |  |  |  |  |  |  |
| 52 | Bù trừ tạm ứng theo % HĐ | Number | Downpaymentclearing |  | x |  |  |  |  |  |  |  |
| 53 | Tỷ lệ giữ lại theo đợt | Number | Retention | x | x |  |  |  |  |  |  |  |
| 54 | Giá trị đề nghị thanh toán thực đợt | Number | NetAmount | x | x |  |  |  |  |  |  |  |
| 55 | Ngày ký bản cứng CĐT | Datepicker | ownerSignDate |  | x | x |  |  | Ngày ghi nhận sản lượng. Chỉ mở ở bước 5 |  |  |  |
| 56 | Số IPC (CĐT cấp) | Number | AssignmentReference |  | x | x |  |  | Số IPC (CĐT cấp). Chỉ mở ở bước 5 |  |  |  |
| 57 | Ngày CĐT cấp IPC | Datepicker | BillingDocumentDate |  | x | x |  |  | Ngày CĐT cấp IPC. Chỉ mở ở bước 5 |  |  |  |
| 58 | Giá trị sau VAT | Number | GrossAmount |  |  |  |  |  |  |  |  |  |
| 59 | Số Billing (SAP) | Number | billingDocNo |  | x | x |  |  | Tích hợp lấy từ SAP |  |  |  |
| 60 | Ngày kế toán đẩy SAP | Datepicker | sapPostingDate |  |  |  |  |  | Tích hợp lấy từ SAP |  |  |  |
| 61 | Số HDĐT (hóa đơn) | Number | eInvoiceNo |  |  |  |  |  | Tích hợp lấy từ SAP |  |  |  |
| 62 | Ngày phát hành hóa đơn | Datepicker | eInvoiceDate |  |  |  |  |  | Tích hợp lấy từ SAP |  |  |  |
| 63 | Nhóm Xuất khẩu |  |  |  |  |  |  |  | Hiển thị khi Kênh dự án = Xuất khẩu |  |  | Hiển thị khi Kênh dự án = Xuất khẩu |
| 64 | Điều kiện giao hàng | Input text | IncotermsClassification | x | x |  |  |  | Hiển thị khi Kênh dự án = Xuất khẩu |  |  |  |
| 65 | Ngày thông quan | Datepicker | CustomsClearanceDate | x | x |  |  |  | Hiển thị khi Kênh dự án = Xuất khẩu |  |  |  |
| 66 | Số tờ khai HQ | Input text | CustomsDeclarationNo | x | x |  |  |  | Hiển thị khi Kênh dự án = Xuất khẩu |  |  |  |
| 67 | Hồ sơ quyết toán |  |  |  |  |  |  |  | Hiển thị khi Loại hồ sơ = Quyết toán |  |  | Loại hồ sơ = Quyết toán |
| 68 | Thanh lý hợp đồng | Upload file |  |  | x |  |  |  | Hiển thị khi Loại hồ sơ = Quyết toán |  |  |  |
| 69 | Biên bản nghiệm thu | Upload file |  |  | x |  |  |  | Hiển thị khi Loại hồ sơ = Quyết toán |  |  |  |
| 70 | Bảng giá trị quyết toán | Upload file |  |  | x |  |  |  | Hiển thị khi Loại hồ sơ = Quyết toán |  |  |  |
| 71 | Bảo lãnh / Bảo hành / Thư cam kết | Upload file |  |  | x |  |  |  | Hiển thị khi Loại hồ sơ = Quyết toán |  |  |  |
| 72 | Biên bản khấu trừ | Upload file |  |  | x |  |  |  | Hiển thị khi Loại hồ sơ = Quyết toán |  |  |  |
| 73 | Tham chiếu chứng từ XK | Input text |  |  | x | x |  |  | Kế thừa từ Số CI/B/L (từ INT-ChungTuXK)  Kế thừa ProdX |  |  |  |
| 74 | Bảng khối lượng nghiệm thu |  |  |  |  |  |  |  |  |  |  |  |
| 75 | (Hạng mục kế thừa từ BOQ triển khai. NSD chỉ nhập lũy kế kỳ này; KL kỳ này = Lũy kế kỳ này − Lũy kế kỳ trước. Lũy kế kỳ này phải ≥ kỳ trước và ≤ KL hợp đồng, sai thì bôi đỏ.) |  |  |  |  |  |  |  |  |  |  |  |
| 76 | STT |  |  |  |  |  |  |  |  |  |  |  |
| 77 | Mã hạng mục | Number | Material | x | x | x |  |  |  | Lấy từ BOQ tương ứng với "Mã BOQ triển khai" trường "Mã hạng mục" |  |  |
| 78 | Tên hạng mục | Table input | SalesContractItemText | x | x | x |  |  |  | Lấy từ BOQ tương ứng với "Mã BOQ triển khai" trường "Tên hạng mục" |  |  |
| 79 | ĐVT | Table input | RequestedQuantityUnit | x | x | x |  |  |  | Lấy từ BOQ tương ứng với "Mã BOQ triển khai" trường "ĐVT" |  |  |
| 80 | KL hợp đồng | Number | RequestedQuantity | x | x | x |  |  |  | Tự động lấy từ BOQ triển khai của BCH đã chọn: tổng Khối lượng các dòng đã duyệt (HĐ + PL + VO, VO giảm tính âm) theo Mã hạng mục. |  |  |
| 81 | KL lũy kê Vật tư kỳ trước | Number | prevCumQtyMaterial | x | x | x |  |  |  | Lấy cumQtyMaterial của dòng cùng Mã hạng mục trên Claim kỳ trước tham chiếu căn cứ vào trường "Đợt nghiệm thu". Không có claim kỳ trước (đợt đầu) hoặc hạng mục mới phát sinh thì = 0 |  |  |
| 82 | KL lũy kê Lắp đặt kỳ trước | Number | prevCumQtyLabor | x | x | x |  |  |  | Lấy cumQtyLabor của dòng cùng Mã hạng mục trên Claim kỳ trước tham chiếu căn cứ vào trường "Đợt nghiệm thu". Không có claim kỳ trước (đợt đầu) hoặc hạng mục mới phát sinh thì = 0 |  |  |
| 83 | KL lũy kê Vật tư kỳ này | Number | cumQtyMaterial | x | x |  |  |  |  | Bắt buộc. Điều kiện: prevCumQtyMaterial ≤ giá trị ≤ KL HĐ (RequestedQuantity). Sai thì bôi đỏ. |  |  |
| 84 | KL lũy kê Lắp đặt kỳ này | Number | cumQtyLabor | x | x |  |  |  |  | Bắt buộc. Điều kiện: prevCumQtyLabor ≤ giá trị ≤ KL HĐ (RequestedQuantity). Sai thì bôi đỏ. |  |  |
| 85 | KL vật tư Kỳ này | Number | periodQtyMaterial | x | x | x |  |  |  | Hệ thống tự tính : = |  |  |
| 86 |  |  |  |  |  |  |  |  |  | cumQtyMaterial − prevCumQtyMaterial |  |  |
| 87 | KL lắp đặt kỳ này | Number | periodQtyLabor | x | x | x |  |  |  | Hệ thống tự tính: = |  |  |
| 88 |  |  |  |  |  |  |  |  |  | cumQtyLabor − prevCumQtyLabor |  |  |
| 89 | Đơn giá vật tư | Number | ConditionRateValue_1 | x | x | x |  |  |  | Lấy từ BOQ tương ứng với "Mã BOQ triển khai" trường "Thành tiền vật tư" |  |  |
| 90 | Đơn giá lắp đặt | Number | ConditionRateValue_2 | x | x | x |  |  |  | Lấy từ BOQ tương ứng với "Mã BOQ triển khai" trường "Thành tiền nhân công" |  |  |
| 91 | Thành tiền vật tư | Number | ConditionAmount_1 | x | x | x |  | Hệ thông tự tính : KL vật tư Kỳ này * Đơn giá vật tư |  |  |  |  |
| 92 | Thành tiền lắp đặt | Number | ConditionAmount_2 | x | x | x |  | Hệ thông tự tính : KL lắp đặt Kỳ này * Đơn giá lắp đặt |  |  |  |  |
| 93 | Thành tiền tổng | Number | NetAmount | x | x | x |  | Tự tính: Thành tiền vật tư + Thành tiền lắp đặt |  |  |  |  |
| 95 | Nội dung | Diễn giải | Cách lấy dữ liệu | Giá trị (VNĐ) | ÁP DỤNG VỚI ClaimType = Claim hàng kỳ |  | Ký hiệu | Nội dung | Diễn giải | Cách lấy dữ liệu | Giá trị (VNĐ) | ÁP DỤNG VỚI ClaimType = Claim Quyết toán |
| 96 |  |  |  |  |  |  | Chi tiết hợp đồng: |  |  |  |  |  |
| 97 | Giá trị hợp đồng ban đầu (chưa VAT) : | H1 | Lấy từ hợp đồng | 1987173971 |  |  |  | Giá trị hợp đồng ban đầu (chưa VAT) : | H1 | Lấy từ hợp đồng | 1987173971 |  |
| 98 | Tổng giá trị PLHĐ  (chưa VAT) : | H2 | Lấy từ hợp đồng | 0 |  |  |  | Tổng giá trị PLHĐ  (chưa VAT) : | H2 | Lấy từ hợp đồng | 0 |  |
| 99 | Giá trị hợp đồng điều chỉnh (chưa VAT) : | H3 = H1+H2 | H1+H2 | 1987173971 |  |  |  | Giá trị hợp đồng điều chỉnh (chưa VAT) : | H3 = H1+H2 | H1+H2 | 1987173971 |  |
| 100 |  |  |  |  |  |  | Chi tiết thanh toán kỳ này: |  |  |  |  |  |
| 101 | Giá trị thực hiện kỳ này (chưa VAT) | C1 = C1.1 + C1.2 | C1 = C1.1 + C1.2 | 585514134 |  |  |  | Giá trị thực hiện kỳ này (chưa VAT) | C1 = C1.1 + C1.2 | C1 = C1.1 + C1.2 | 585514134 |  |
| 102 | Giá trị vật tư kỳ này (chưa VAT) | C1.1 | Lấy trường dữ liệu :"Thành tiền vật tư" | 516299382 |  |  |  | Giá trị vật tư kỳ này (chưa VAT) | C1.1 | 0 | 516299382 |  |
| 103 | Giá trị lắp đặt kỳ này (chưa VAT) | C1.2 | Lấy trường dữ liệu :"Thành tiền lắp đặt" | 69214752 |  |  |  | Giá trị lắp đặt kỳ này (chưa VAT) | C1.2 | 0 | 69214752 |  |
| 104 | Giá trị khấu trừ xuất hóa đơn kỳ này | C8 | NSD nhập tay Giá trị <=0 nếu nhập giá trị > 0 báo đỏ |  |  |  |  | Giá trị khấu trừ xuất hóa đơn kỳ này | C8 | NSD nhập tay Giá trị <=0 nếu nhập giá trị > 0 báo đỏ |  |  |
| 105 | Giá trị VAT kỳ này | C7 = (C1+C8) * %VAT | C7 = (C1+C8) * trường "Thuế suất GTGT(%)" | 46841131 |  |  |  | Giá trị VAT kỳ này | C7 = (C1+C8) * %VAT | C7 = (C1+C8) * trường "Thuế suất GTGT(%)" | 46841131 |  |
| 106 | Giá trị thực hiện kỳ này (gồm VAT): | C10 = C1 + C8 + C7 | C10 = C1 + C8 + C7 | 632355265 |  |  |  | Giá trị thực hiện kỳ này (gồm VAT): | C10 = C1 + C8 + C7 | C10 = C1 + C8 + C7 | 632355265 |  |
| 107 | Giá trị tiền giữ lại kỳ này | C2 = (C1.1*(1-% Thanh toán vật tư)+(C1.2+C8)*(1-% Thanh toán lắp đặt))*(1+%VAT) * (-1) | TH1: 'C2 tạm = (C1.1*(1-% Thanh toán vật tư)+(C1.2+C8)*(1-% Thanh toán lắp đặt))*(1+%VAT) * (-1) | -178493790 |  |  |  | Giá trị tiền giữ lại kỳ này | C2 = C10 * (1-% Thanh toán quyết toán) * (-1) | TH1: 'C2 tạm = C10 * (1-% Thanh toán quyết toán) * (-1) | -178493790 |  |
| 108 |  | Nếu B2 vượt quá [H3 * % Tiền giữ lại tối đa giá trị hợp đồng] thì C2=H3 * % Tiền giữ lại tối đa giá trị hợp đồng - Tổng C2 lũy kế đến kỳ trước | TH2 : Nếu B2 = B2 kỳ trước + C2 tạm  > [H3 * % Tiền giữ lại tối đa giá trị hợp đồng] ----> C2 tạm =H3 * % Tiền giữ lại tối đa giá trị hợp đồng - Tổng C2 lũy kế đến kỳ trước |  |  |  |  |  | Nếu B2 vượt quá [H3 * % Tiền giữ lại tối đa giá trị hợp đồng] thì C2=H3 * % Tiền giữ lại tối đa giá trị hợp đồng - Tổng C2 lũy kế đến kỳ trước | TH2 : Nếu B2 = B2 kỳ trước + C2 tạm  > [H3 * % Tiền giữ lại tối đa giá trị hợp đồng] ----> C2 tạm =H3 * % Tiền giữ lại tối đa giá trị hợp đồng - Tổng C2 lũy kế đến kỳ trước |  |  |
| 110 |  |  | CHÚ Ý : |  |  |  |  |  |  | CHÚ Ý : |  |  |
| 111 |  |  | +% Thanh toán vật tư , % Thanh toán lắp đặt , % Tiền giữ lại tối đa giá trị hợp đồng --> Lấy từ Hợp đồng tương ứng |  |  |  |  |  |  | +% Thanh toán vật tư , % Thanh toán lắp đặt , % Tiền giữ lại tối đa giá trị hợp đồng --> Lấy từ Hợp đồng tương ứng |  |  |
| 112 |  |  | +%VAT lấy theo trường dữ liệu :"Thuế suất GTGT(%)" |  |  |  |  |  |  | +%VAT lấy theo trường dữ liệu :"Thuế suất GTGT(%)" |  |  |
| 113 | Giá trị tạm ứng kỳ này | C3, nhập tay | C3 , Người dùng nhập tay |  |  |  |  | Giá trị tạm ứng kỳ này | 0 | 0 |  |  |
| 114 | Giá trị hoàn trả tạm ứng kỳ này | C4 = C3 * % Khấu trừ tạm ứng * (-1) | Tự tính, NSD không nhập. | -87827120.1 |  |  |  | Giá trị hoàn trả tạm ứng kỳ này | C4 = B3 - Tổng B4 lũy kế đến kỳ trước | C4 = B3 - Tổng B4 lũy kế đến kỳ trước | -87827120.1 |  |
| 115 |  | Nếu A1 vượt quá [H3 * % Giá trị thực hiện cần khấu trừ toàn bộ tạm ứng] thì C4 = B3 - Tổng B4 lũy kế đến kỳ trước | Ngưỡng = H3 × % Giá trị thực hiện cần khấu trừ toàn bộ tạm ứng (HĐ bán). |  |  |  |  |  |  |  |  |  |
| 117 |  |  | Nếu A1 ≤ Ngưỡng: C4 = −C3 × % Khấu trừ tạm ứng (HĐ bán). |  |  |  |  |  |  |  |  |  |
| 118 |  |  | Nếu A1 > Ngưỡng:  C4 = B3 - Tổng B4 lũy kế đến kỳ trước |  |  |  |  |  |  |  |  |  |
| 120 |  |  | B4 kỳ trước lấy từ Claim kỳ trước tham chiếu (đợt đầu = 0). |  |  |  |  |  |  |  |  |  |
| 121 | Giá trị khấu trừ không xuất hóa đơn kỳ này | C5, nhập tay giá trị âm | C5, nhập tay giá trị âm |  |  |  |  | Giá trị khấu trừ không xuất hóa đơn kỳ này | C5, nhập tay giá trị âm | C5, nhập tay giá trị âm |  |  |
| 122 | Giá trị tiền phạt kỳ này | C9, nhập tay giá trị âm | C9, nhập tay giá trị âm |  |  |  |  | Giá trị tiền phạt kỳ này | C9, nhập tay giá trị âm | C9, nhập tay giá trị âm |  |  |
| 123 | Số tiền được thanh toán đợt này: | C6 = C10 + C2 + C3 + C4 + C5 + C9 | C6 = C10 + C2 + C3 + C4 + C5 + C9 | 366034355 |  |  |  | Số tiền được thanh toán đợt này: | C6 = C10 + C2 + C3 + C4 + C5 + C9 | C6 = C10 + C2 + C3 + C4 + C5 + C9 | 366034355 |  |
| 124 |  |  |  |  |  |  | Chi tiết lũy kế đến kỳ này: |  |  |  |  |  |
| 125 | Giá trị thực hiện lũy kế đến kỳ này (chưa VAT) | A1 = Tổng C1 lũy kế đến kỳ này | A1 = A1 kỳ trước + C1 |  |  |  |  | Giá trị thực hiện lũy kế đến kỳ này (chưa VAT) | A1 = Tổng C1 lũy kế đến kỳ này | A1 = A1 kỳ trước + C1 |  |  |
| 126 |  |  | Nếu là kỳ đầu tiền : A1 = 0 |  |  |  |  |  |  | Nếu là kỳ đầu tiền : A1 = 0 |  |  |
| 127 | Giá trị khấu trừ xuất hóa đơn lũy kế đến kỳ này | A2 = Tổng C8 lũy kế đến kỳ này | A2 kỳ trước + C8 |  |  |  |  | Giá trị khấu trừ xuất hóa đơn lũy kế đến kỳ này | A2 = Tổng C8 lũy kế đến kỳ này | A2 kỳ trước + C8 |  |  |
| 128 |  |  | Nếu là kỳ đầu tiền : A2 = 0 |  |  |  |  |  |  | Nếu là kỳ đầu tiền : A2 = 0 |  |  |
| 129 | Giá trị VAT lũy kế đến kỳ này | B7 = Tổng C7 lũy kế đến kỳ này | B7 kỳ trước + C7 |  |  |  |  | Giá trị VAT lũy kế đến kỳ này | B7 = Tổng C7 lũy kế đến kỳ này | B7 kỳ trước + C7 |  |  |
| 130 |  |  | Nếu là kỳ đầu tiền : B7 = 0 |  |  |  |  |  |  | Nếu là kỳ đầu tiền : B7 = 0 |  |  |
| 131 | Giá trị thực hiện lũy kế đến kỳ này (gồm VAT): | B10 = Tổng C10 lũy kế đến kỳ này | B10 kỳ trước + C10 |  |  |  |  | Giá trị thực hiện lũy kế đến kỳ này (gồm VAT): | B10 = Tổng C10 lũy kế đến kỳ này | B10 kỳ trước + C10 |  |  |
| 132 |  |  | Nếu là kỳ đầu tiền : B10 = 0 |  |  |  |  |  |  | Nếu là kỳ đầu tiền : B10 = 0 |  |  |
| 133 | Giá trị tiền giữ lại lũy kế đến kỳ này | B2 = Tổng C2 lũy kế đến kỳ này | B2 kỳ trước + C2 |  |  |  |  | Giá trị tiền giữ lại lũy kế đến kỳ này | B2 = Tổng C2 lũy kế đến kỳ này | B2 kỳ trước + C2 |  |  |
| 134 |  |  | Nếu là kỳ đầu tiền : B2 = 0 |  |  |  |  |  |  | Nếu là kỳ đầu tiền : B2 = 0 |  |  |
| 135 | Giá trị tạm ứng lũy kế đến kỳ này | B3 = Tổng C3 lũy kế đến kỳ này | B3 kỳ trước + C3 |  |  |  |  | Giá trị tạm ứng lũy kế đến kỳ này | B3 = Tổng C3 lũy kế đến kỳ này | B3 kỳ trước + C3 |  |  |
| 136 |  |  | Nếu là kỳ đầu tiền : B3 = 0 |  |  |  |  |  |  | Nếu là kỳ đầu tiền : B3 = 0 |  |  |
| 137 | Giá trị hoàn trả tạm ứng lũy kế đến kỳ này | B4 = Tổng C4 lũy kế đến kỳ này | B4 = B4 kỳ trước + C4. |  |  |  |  | Giá trị hoàn trả tạm ứng lũy kế đến kỳ này | B4 = Tổng C4 lũy kế đến kỳ này | B4 = B4 kỳ trước + C4. |  |  |
| 138 |  | Nếu A1 vượt quá [H3 * % Giá trị thực hiện cần khấu trừ toàn bộ tạm ứng] thì B4 = B3 | Nếu A1 > H3 × % Giá trị thực hiện cần khấu trừ toàn bộ tạm ứng (HĐ bán) ---> B4 = B3 |  |  |  |  |  | Nếu A1 vượt quá [H3 * % Giá trị thực hiện cần khấu trừ toàn bộ tạm ứng] thì B4 = B3 | Nếu A1 > H3 × % Giá trị thực hiện cần khấu trừ toàn bộ tạm ứng (HĐ bán) ---> B4 = B3 |  |  |
| 139 |  |  | Nếu là kỳ đầu tiền : B4 = 0 |  |  |  |  |  |  | Nếu là kỳ đầu tiền : B4 = 0 |  |  |
| 140 | Giá trị khấu trừ không xuất hóa đơn lũy kế đến kỳ này | B5 = Tổng C5 lũy kế đến kỳ này | B5 kỳ trước + C5 |  |  |  |  | Giá trị khấu trừ không xuất hóa đơn lũy kế đến kỳ này | B5 = Tổng C5 lũy kế đến kỳ này | B5 kỳ trước + C5 |  |  |
| 141 |  |  | Nếu là kỳ đầu tiền : B5 = 0 |  |  |  |  |  |  | Nếu là kỳ đầu tiền : B5 = 0 |  |  |
| 142 | Giá trị tiền phạt lũy kế đến kỳ này | B9 = Tổng C9 lũy kế đến kỳ này | B9 kỳ trước + C9 |  |  |  |  | Giá trị tiền phạt lũy kế đến kỳ này | B9 = Tổng C9 lũy kế đến kỳ này | B9 kỳ trước + C9 |  |  |
| 143 |  |  | Nếu là kỳ đầu tiền : B9 = 0 |  |  |  |  |  |  | Nếu là kỳ đầu tiền : B9 = 0 |  |  |
| 144 | Số tiền được thanh toán lũy kế đến kỳ này: | B6 = Tổng C6 lũy kế đến kỳ này | B6 kỳ trước + C6 |  |  |  |  | Số tiền được thanh toán lũy kế đến kỳ này: | B6 = Tổng C6 lũy kế đến kỳ này | B6 kỳ trước + C6 |  |  |
| 145 |  |  | Nếu là kỳ đầu tiền : B6 = 0 |  |  |  |  |  |  | Nếu là kỳ đầu tiền : B6 = 0 |  |  |
