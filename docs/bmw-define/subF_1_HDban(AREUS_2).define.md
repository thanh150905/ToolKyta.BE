# Define — subF_1_HDban (AREUS_2) — [Bán hàng] Ký kết hợp đồng, Hợp đồng Areus

> Export đầy đủ từ `subF_1_HDban(AREUS_2).xlsx` (128 dòng). Nguồn chuẩn đối chiếu field cho agent thực thi. KHÔNG sửa tay — sửa thì export lại.

| # | NOTE | Tên trường thông tin | Định dạng (yêu cầu chọn đúng tên element trên form: eg: input text, dropdown) | Code | Required | Display | Chỉ đọc | Mặc định | Dữ liệu mẫu: Giá trị example | Mô tả | Logic lấy data | Logic đẩy data | Logic ẩn hiện | Link kéo eflow | Ngày cập nhật mô tả |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 |  |  |  |  |  |  |  |  | Nguồn lấy dữ liệu: |  | (Mô tả cách/logic dữ liệu hiển thị ) | - Nếu khối OCR: điền đích fill dữ liệu |  |  |  |
| 3 |  |  |  |  |  |  |  |  | - API, Catalog, Biến hệ thống |  |  | - Mô tả ảnh hưởng (ẩn/hiện, lấy giá trị) của trường này đến trường khác |  |  |  |
| 4 |  |  |  |  |  |  |  |  | - Mặc định không viết gì là người dùng nhập |  |  | - Trường này có được dùng để MERGEFIELD không? |  |  |  |
| 5 |  | subF_1_SD | Subform |  |  |  |  |  | Các trường thông tin lấy ở sheet "subF_1_SD" |  |  |  |  |  |  |
| 6 |  | Mã dự án | Dropdow | WBSElement | x | x |  |  | Lấy từ catalog : Project |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |  |  | -Trường : Project ID |  |  |  |  |  |  |
| 9 |  |  |  |  |  |  |  |  | Check điều kiện: chỉ hiển thị mã dự án của user thuộc dự án và Loại dự án ="Areus" . |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |  |  | Logic: Kiểm tra dữ liệu user theo catalog bảng: Approval Matrix, trường: acc mail. Và trạng thái = "1" |  |  |  |  |  |  |
| 11 | Bỏ | Loại hợp đồng bán | Dropdown | SalesContractType | x | x |  |  | Danh sách dữ kiệu gồm : |  |  |  |  |  |  |
| 12 |  |  |  |  |  |  |  |  | +Hợp đồng gốc |  |  |  |  |  |  |
| 13 |  |  |  |  |  |  |  |  | +Phụ lục |  |  |  |  |  |  |
| 14 |  | Hợp đồng có khối lượng không? | Check box | HasVolumeContract | x | x |  |  | check box 2 giá trị: |  |  |  |  |  |  |
| 15 |  |  |  |  |  |  |  |  | +Có |  |  |  |  |  |  |
| 16 |  |  |  |  |  |  |  |  | +không |  |  |  |  |  |  |
| 17 |  | Hợp đồng có ký số không ? | Check box | HasDigitalSignature | x | x |  |  | check box 2 giá trị: |  |  |  |  |  |  |
| 18 |  |  |  |  |  |  |  |  | +Có |  |  |  |  |  |  |
| 19 |  |  |  |  |  |  |  |  | +không |  |  |  |  |  |  |
| 20 |  | Số hợp đồng bán | Input text | SalesContract |  | x |  |  |  |  |  |  | Hiển thị khi :"Loại hợp đồng bán " = Hợp đồng gốc |  |  |
| 21 | Bỏ | Số phụ lục | Input text | ContractAddendumNumber |  | x |  |  |  |  |  |  | Hiển thị khi :"Loại hợp đồng bán " = Phụ lục |  |  |
| 22 | Bỏ | Số hợp đồng gốc | Dropdown |  |  | x | x |  |  |  |  |  | Hiển thị khi :"Loại hợp đồng bán " = Phụ lục |  |  |
| 23 |  |  |  |  |  |  |  |  |  |  |  |  | Hệ thống tự fill giá trị : "Số hợp đồng gốc" tương ứng đối với trường "Mã dự án " |  |  |
| 24 |  | Loại đối tượng HĐ | Dropdown | ContractObjectType | x | x |  |  | Lấy giá trị từ catalog: Contract Type |  | Dịch vụ / Thi công CĐT / HĐ khung với đại lý (áp dụng với BM Living) | Với Dịch vụ và HĐ khung với đại lý thì ko đẩy về SAP |  |  |  |
| 25 |  |  |  |  |  |  |  |  | - Trường: Contract Description |  |  |  |  |  |  |
| 26 |  |  |  |  |  |  |  |  | VD: Thi công CĐT |  |  |  |  |  |  |
| 27 |  | Gói thầu | Input text | package | x | x |  |  |  |  |  |  |  |  |  |
| 28 |  | Địa chỉ công trường | Input text | address | x | x |  |  |  |  |  |  |  |  |  |
| 29 |  | Khách hàng / Chủ đầu tư | Input text | SoldToParty | x |  |  |  | Lấy giá trị từ catalog: |  |  |  |  |  |  |
| 30 |  |  |  |  |  |  |  |  | - Bảng: Business Partner |  |  |  |  |  |  |
| 31 |  |  |  |  |  |  |  |  | - Trường:  Full Name |  |  |  |  |  |  |
| 32 |  |  |  |  |  |  |  |  | VD: CÔNG TY CỔ PHẦN TẬP ĐOÀN CÔNG NGHỆ CMC |  |  |  |  |  |  |
| 33 |  | Vai trò ở hợp đồng | Dropdow | CustomerGroup | x | x |  |  | Danh sách dữ kiệu gồm : |  |  |  |  |  |  |
| 34 |  |  |  |  |  |  |  |  | 'Hệ sinh thái / CĐT / tổng thầu |  |  |  |  |  |  |
| 35 |  | Kênh bán hàng | Dropdow | SalesOrganization | x | x |  |  | Lấy giá trị từ catalog: |  |  |  |  |  |  |
| 36 |  |  |  |  |  |  |  |  | - Bảng: Profit Center |  |  |  |  |  |  |
| 37 |  |  |  |  |  |  |  |  | - Trường:  Profit Center Name |  |  |  |  |  |  |
| 38 |  |  |  |  |  |  |  |  | VD: Xuất khẩu |  |  |  |  |  |  |
| 39 |  | Quốc gia | Dropdow | Country | x | x |  |  | Lấy giá trị từ catalog: Country |  |  |  |  |  |  |
| 40 |  |  |  |  |  |  |  |  | - Trường: Country Name |  |  |  |  |  |  |
| 41 |  |  |  |  |  |  |  |  | VD: Việt nam |  |  |  |  |  |  |
| 42 |  | Đơn vị tiền tệ | Dropdow | TransactionCurrency | x | x | x |  | Lấy giá trị từ catalog: Project |  |  |  |  |  |  |
| 43 |  |  |  |  |  |  |  |  | - Trường: Currency |  |  |  |  |  |  |
| 44 |  |  |  |  |  |  |  |  | Lấy theo trường "Mã dự án " tương ứng |  |  |  |  |  |  |
| 45 |  | Ngày hiệu lực hợp đồng | Date | SalesContractValidityStartDate |  | x | x |  |  |  | Thời hạn HĐ, required khi complete luồng, khi khởi tạo sẽ chưa có thông tin |  |  |  |  |
| 46 |  | Ngày kết thúc hợp đồng | Date | SalesContractValidityEndDate |  | x | x |  |  |  | Thời hạn HĐ, required khi complete luồng, khi khởi tạo sẽ chưa có thông tin |  |  |  |  |
| 47 |  | Ngày ký hợp đồng | Date | Document Date |  | x | x |  |  |  | Hệ thống tự sinh khi mà hợp đồng được Ký số |  |  |  |  |
| 48 |  |  |  |  |  |  |  |  |  |  | -NSD sẽ điền khi mà hợp đồng ký bên ngoài |  |  |  |  |
| 49 |  | Số ủy quyền BMW | input text | BMWAuthorizationNumber |  | x | x |  |  |  |  |  |  |  |  |
| 50 |  | Người ký CĐT/NTC | input text | InvestorContractorSignerName |  | x | x |  |  |  |  |  |  |  |  |
| 51 |  | Chức danh người ký CĐT/NTC | input text | InvestorContractorSignerTitle |  | x | x |  |  |  |  |  |  |  |  |
| 52 |  | Số ủy quyền CĐT/NTC | input text | InvestorContractorAuthorizationNumber |  | x | x |  |  |  |  |  |  |  |  |
| 53 |  | Giá trị hợp đồng (chưa gồm VAT) | Number | TotalNetAmount | x | x |  |  |  |  |  |  |  |  |  |
| 54 | Bỏ | Giá trị điều chỉnh phụ lục | Number | appendixValueTotal | x | x |  |  |  |  |  |  |  |  |  |
| 55 | Bỏ | Giá trị hợp đồng sau điều chỉnh phụ lục | Number | contractValueAdjusted | x | x |  |  |  |  |  |  |  |  |  |
| 56 | Label | TIẾN ĐỘ THANH TOÁN | Heading1 |  |  |  |  |  |  | Căn giữa, bôi đậm |  |  |  |  |  |
| 57 | TABLE LIST | Điều khoản thanh toán | Number | CustomerPaymentTerms |  | x |  |  |  |  |  |  |  |  |  |
| 58 |  | % Tạm ứng (GTHĐ trước thuế) | Number | AdvancePaymentPercentage |  | x |  |  |  |  |  |  |  |  |  |
| 59 |  | Giá trị tạm ứng- nguyên tệ | Number | AdvancePaymentAmount |  | x |  |  |  |  |  |  |  |  |  |
| 60 |  | Giá trị tạm ứng- VND | Number | AdvancePaymentAmountVND |  | x |  |  |  |  |  |  |  |  |  |
| 61 |  | % Khấu trừ tạm ứng | Number | AdvanceDeduction |  | x |  |  |  |  |  |  |  |  |  |
| 62 |  | Thời gian tạm ứng | Date time | AdvancePaymentPeriod |  | x |  |  |  |  |  |  |  |  |  |
| 63 |  | % Giá trị thực hiện cần khấu trừ toàn bộ tạm ứng | Number | AdvancePayment |  | x |  |  |  |  |  |  |  |  |  |
| 64 |  | % Xác nhận khối lượng vật tư thực hiện | Number | materialQuantitiesUsed |  | x |  |  |  |  |  |  |  |  |  |
| 65 |  | % Xác nhận khối lượng lắp đặt thực hiện | Number | actualInstallationVolume |  | x |  |  |  |  |  |  |  |  |  |
| 66 |  | % Thanh toán vật tư | Input text | PaymentForMaterials |  | x |  |  |  |  |  |  |  |  |  |
| 67 |  | % Thanh toán lắp đặt | Number | InstallationPayment |  | x |  |  |  |  |  |  |  |  |  |
| 68 |  | Thời gian thanh toán vật tư | Date time | PaymentPeriod |  | x |  |  |  |  |  |  |  |  |  |
| 69 |  | Thời gian thanh toán lắp đặt | Date time | PaymentInstallationSchedule |  | x |  |  |  |  |  |  |  |  |  |
| 70 |  | % Giữ lại hàng kỳ | Number | RetainedPerPeriod |  | x |  |  |  |  |  |  |  |  |  |
| 71 |  | % Tiền giữ lại tối đa giá trị hợp đồng | Number | contractValueRetained |  | x |  |  |  |  |  |  |  |  |  |
| 72 |  | % Thanh toán quyết toán | Number | FinalSettlementPayment |  | x |  |  |  |  |  |  |  |  |  |
| 73 |  | Thời gian thanh toán quyết toán | Date time | FinalSettlementPeriod |  | x |  |  |  |  |  |  |  |  |  |
| 74 |  | Thời gian thanh toán tiền giữ lại | Date time | TimingofRetentionPayment |  | x |  |  |  |  |  |  |  |  |  |
| 75 |  | % Bảo lãnh tạm ứng | Number | advancePaymentGuarantee |  | x |  |  |  |  |  |  |  |  |  |
| 76 |  | % Bảo lãnh thực hiện hợp đồng (giá trị Hợp đồng sau thuế) | Number | contractPerformanceGuarantee |  | x |  |  |  |  |  |  |  |  |  |
| 77 |  | % Bảo lãnh bảo hành (GTHĐ trước thuế) | Number | warrantyGuarantee |  | x |  |  |  |  |  |  |  |  |  |
| 78 |  | Thời gian bảo hành | Number | warrantyPeriod |  | x |  |  | Dữ liệu điền số tháng |  |  |  |  |  |  |
| 79 |  | Ngày hiệu lực bảo lãnh tạm ứng | Date time | AdvancePaymentGuaranteeEffectiveDate |  | x |  |  |  |  |  |  |  |  |  |
| 80 |  | Ngày hiệu lực bảo lãnh bảo hành | Date time | WarrantyGuaranteeEffectiveDate |  | x |  |  |  |  |  |  |  |  |  |
| 81 |  | % Phạt chất lượng | Number | QualityPenaltyPercentage |  | x |  |  |  |  |  |  |  |  |  |
| 82 |  | % Phạt chậm tiến độ | Number | ScheduleDelayPenaltyPercentage |  | x |  |  |  |  |  |  |  |  |  |
| 83 |  | % Phạt chậm thanh toán | Number | PaymentDelayPenaltyPercentage |  |  |  |  |  |  |  |  |  |  |  |
| 84 |  | Các chứng từ liên quan đến Hợp đồng | Upload File |  |  | x |  |  |  |  |  |  |  |  |  |
| 85 |  | Nội dung hợp đồng | eColla | ContractContent |  |  |  |  | Sử dụng định dạng word để soạn thảo nội dung hợp đồng |  |  |  |  |  |  |
| 86 | Lấy giá trị từ subF_1_HDban fill xuống dưới và bảng dưới cho phép chỉnh sửa thêm chữ để in ra eWriter |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 87 | I. GIÁ TRỊ HỢP ĐỒNG |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 88 | 1 | Giá trị hợp đồng (chưa gồm VAT) | {TotalNetAmountVND} VND |  |  |  |  |  |  |  |  |  |  |  |  |
| 89 | 2 | Giá trị điều chỉnh phụ lục | {appendixValueTotal} VND |  |  |  |  |  |  |  |  |  |  |  |  |
| 90 | 3 | Giá trị hợp đồng sau điều chỉnh phụ lục | {contractValueAdjusted} VND | Bằng Giá trị hợp đồng + Giá trị điều chỉnh phụ lục |  |  |  |  |  |  |  |  |  |  |  |
| 91 | II. ĐIỀU KHOẢN THANH TOÁN |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 92 | 4 | Điều khoản thanh toán | {CustomerPaymentTerms} |  |  |  |  |  |  |  |  |  |  |  |  |
| 93 | III. TẠM ỨNG |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 94 | 5 | % Tạm ứng (GTHĐ trước thuế) | {AdvancePaymentPercentage}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 95 | 6 | Giá trị tạm ứng – nguyên tệ | {AdvancePaymentAmount} |  |  |  |  |  |  |  |  |  |  |  |  |
| 96 | 7 | Giá trị tạm ứng – VND | {AdvancePaymentAmountVND} VND |  |  |  |  |  |  |  |  |  |  |  |  |
| 97 | 8 | % Khấu trừ tạm ứng | {AdvanceDeduction}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 98 | 9 | Thời gian tạm ứng | {AdvancePaymentPeriod} |  |  |  |  |  |  |  |  |  |  |  |  |
| 99 | 10 | % Giá trị thực hiện cần khấu trừ toàn bộ tạm ứng | {AdvancePayment}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 100 | IV. THANH TOÁN VẬT TƯ VÀ LẮP ĐẶT |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 101 | 11 | % Xác nhận khối lượng vật tư thực hiện | {materialQuantitiesUsed}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 102 | 12 | % Xác nhận khối lượng lắp đặt thực hiện | {actualInstallationVolume}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 103 | 13 | % Thanh toán vật tư | {PaymentForMaterials}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 104 | 14 | % Thanh toán lắp đặt | {InstallationPayment}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 105 | 15 | Thời gian thanh toán vật tư | {PaymentPeriod} |  |  |  |  |  |  |  |  |  |  |  |  |
| 106 | 16 | Thời gian thanh toán lắp đặt | {PaymentInstallationSchedule} |  |  |  |  |  |  |  |  |  |  |  |  |
| 107 | V. TIỀN GIỮ LẠI VÀ QUYẾT TOÁN |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 108 | 17 | % Giữ lại hàng kỳ | {RetainedPerPeriod}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 109 | 18 | % Tiền giữ lại tối đa giá trị hợp đồng | {contractValueRetained}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 110 | 19 | % Thanh toán quyết toán | {FinalSettlementPayment}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 111 | 20 | Thời gian thanh toán quyết toán | {FinalSettlementPeriod} |  |  |  |  |  |  |  |  |  |  |  |  |
| 112 | 21 | Thời gian thanh toán tiền giữ lại | {TimingofRetentionPayment} |  |  |  |  |  |  |  |  |  |  |  |  |
| 113 | VI. THANH TOÁN TRẢ TRƯỚC (DỰ ÁN XUẤT KHẨU) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 114 | 22 | % Thanh toán trả trước | {prepayment}% | Chỉ hiển thị khi Kênh bán hàng = Xuất khẩu |  |  |  |  |  |  |  |  |  |  |  |
| 115 | 23 | Số tiền thanh toán trả trước | {prepaymentAmount} | Chỉ hiển thị khi Kênh bán hàng = Xuất khẩu |  |  |  |  |  |  |  |  |  |  |  |
| 116 | VII. BẢO LÃNH VÀ BẢO HÀNH |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 117 | 24 | % Bảo lãnh tạm ứng | {advancePaymentGuarantee}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 118 | 25 | Ngày hiệu lực bảo lãnh tạm ứng | {AdvancePaymentGuaranteeEffectiveDate} |  |  |  |  |  |  |  |  |  |  |  |  |
| 119 | 26 | % Bảo lãnh thực hiện hợp đồng (giá trị hợp đồng sau thuế) | {contractPerformanceGuarantee}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 120 | 27 | % Bảo lãnh bảo hành (GTHĐ trước thuế) | {warrantyGuarantee}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 121 | 28 | Ngày hiệu lực bảo lãnh bảo hành | {WarrantyGuaranteeEffectiveDate} |  |  |  |  |  |  |  |  |  |  |  |  |
| 122 | 29 | Thời gian bảo hành | {warrantyPeriod} tháng |  |  |  |  |  |  |  |  |  |  |  |  |
| 123 | VIII. PHẠT HỢP ĐỒNG |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 124 | 30 | % Phạt chất lượng | {QualityPenaltyPercentage}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 125 | 31 | % Phạt chậm tiến độ | {ScheduleDelayPenaltyPercentage}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 126 | 32 | % Phạt chậm thanh toán | {PaymentDelayPenaltyPercentage}% |  |  |  |  |  |  |  |  |  |  |  |  |
| 128 |  | Xem bản in | Preview document |  |  |  |  |  |  |  |  |  |  |  |  |
