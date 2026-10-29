# Define — subF_10_HĐmua (Hợp đồng mua)

> Export đầy đủ từ `subF_10_HĐmua.xlsx` (219 dòng). Nguồn chuẩn đối chiếu field cho agent thực thi. KHÔNG sửa tay — sửa thì export lại.

| # | NOTE | Tên trường thông tin | Định dạng (yêu cầu chọn  | Code | Required | Display | Chỉ đọc | Mặc định | Dữ liệu mẫu: Giá trị exa | Mô tả | Logic đẩy data |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 |  |  |  |  |  |  |  |  | - Mặc định không viết gì là người dùng nhập |  | - Trường này có được dùng để MERGEFIELD không? |
| 5 | Update 05/10/2026 | Thông tin hợp đồng | Dropdown |  | x | x |  | Theo mẫu | Dropdown: |  |  |
| 6 |  |  |  |  |  |  |  |  | - Theo mẫu: Hiển thị full trường, trừ dòng 108 |  |  |
| 7 |  |  |  |  |  |  |  |  | - Không theo mẫu: Hiển thị các trường bôi đỏ. ẩn các trường còn lại |  |  |
| 8 |  | Số hợp đồng mua hàng (PC) | input text | PurchaseContract | x | x | x |  | Mã Hợp đồng trên SAP, trả lại cho KYTA sau khi khởi tạoPurchase Contract thành công trên SAP |  |  |
| 9 |  | Loại chứng từ Contract | Dropdown | PurchaseContractType | x | x |  |  | Catalog: Contract Type |  |  |
| 10 |  |  |  |  |  |  |  |  | Trường: Contract Type - Contract Description |  |  |
| 12 |  |  |  |  |  |  |  |  | Lưu ý: Không tích hợp về SAP với Contract Type = ZNTC - Hợp đồng nguyên tắc |  |  |
| 13 |  | Mã dự án | Dropdown | WBSElement | x | x |  |  |  | Lấy gía trị theo PR. |  |
| 14 |  |  |  |  |  |  |  |  |  | Trường hợp PR không có user chọn từ catalog : Project |  |
| 15 |  |  |  |  |  |  |  |  |  | -Trường : Project ID |  |
| 17 |  |  |  |  |  |  |  |  |  | Check điều kiện: chỉ hiển thị mã dự án của user thuộc dự án. |  |
| 18 |  |  |  |  |  |  |  |  |  | Logic: Kiểm tra dữ liệu user theo catalog bảng: Approval Matrix, trường: acc mail. Và trạng thái = "1" |  |
| 19 |  | Công trình | Input text |  | x | x | x | x |  | Fill giá trị theo mã dự án, trong PR |  |
| 20 |  | Mã công ty | Dropdown | CompanyCode | x | x |  |  | Catalog:Company code |  |  |
| 21 |  |  |  |  |  |  |  |  | Trường: Company Name |  |  |
| 22 |  | Ngày tạo chứng từ | Datepicker | CreationDate | x | x |  |  |  |  |  |
| 23 |  | Mã nhà cung cấp | Dropdown | Supplier | x | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR & Trên PR Item giá trị trường Supplier <> rỗng → Lấy giá trị theo PR: Supplier |  |  |
| 24 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR hoặc trên PR Item không có giá trị Supplier → User lựa chọn trong danh sách Suppier gọi API từ SAP lên |  |  |
| 25 |  | Tổ chức mua hàng | Dropdown | PurchasingOrganization | x | x |  |  | Catalog: Purchasing Orrganization |  |  |
| 26 |  |  |  |  |  |  |  |  | Trường: Purchasing Orrganization-Purchasing Orrganization description |  |  |
| 28 |  |  |  |  |  |  |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR & Trên PR Item giá trị trường PurchasingOrganization <> rỗng → Lấy giá trị theo PR: _PurchaseRequisitionItem[].PurchasingOrganization |  |  |
| 29 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR  → User lựa chọn trong danh sách data list PurchasingOrganization |  |  |
| 30 |  | Nhóm mua hàng | Dropdown | PurchasingGroup | x | x |  |  | Catalog: Purchasing Group |  |  |
| 31 |  |  |  |  |  |  |  |  | Trường: Purchasing Group-Purchasing Group Description |  |  |
| 33 |  |  |  |  |  |  |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR & Trên PR Item giá trị trường PurchasingGroup <> rỗng → Lấy giá trị theo PR:_PurchaseRequisitionItem[].PurchasingGroup. |  |  |
| 34 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR  → User lựa chọn trong danh sách data list ProductGroup |  |  |
| 35 |  | Điều khoản thanh toán | Dropdown | PaymentTerms |  | x |  |  | Catalog: Payment Term |  |  |
| 36 |  |  |  |  |  |  |  |  | Trường: Payment Term-Name |  |  |
| 38 |  |  |  |  |  |  |  |  | Lấy giá trị PaymentTerms theo Supplier được chọn:PaymentTerms. |  |  |
| 39 |  |  |  |  |  |  |  |  | Nếu Payment Term trên Suppier không có thì cho user chọn PaymentTerms theo data list |  |  |
| 40 |  | Loại tiền tệ chứng từ | Dropdown | DocumentCurrency | x | x |  |  | Catalog: Currency |  |  |
| 41 |  |  |  |  |  |  |  |  | Trường: Company Name |  |  |
| 43 |  |  |  |  |  |  |  |  | Lấy giá trị Currency theo Supplier được chọn:PurchaseOrderCurrency. |  |  |
| 44 |  |  |  |  |  |  |  |  | Nếu data supplier không có thì cho user chọn Currency theo data list |  |  |
| 45 |  | Tỷ giá quy đổi | input text | ExchangeRate |  | x |  |  |  |  |  |
| 46 |  | Fix tỷ giá quy đổi theo hợp đồng | Check box | ExchangeRateIsFixed |  | x |  |  |  |  |  |
| 47 |  | Ngày ký hợp đồng | Datepicker |  |  | x |  |  |  |  |  |
| 48 |  | Ngày bắt đầu hiệu lực hợp đồng | Datepicker | ValidityStartDate | x | x |  |  |  |  |  |
| 49 |  | Ngày kết thúc hiệu lực hợp đồng | Datepicker | ValidityEndDate | x |  |  |  |  |  |  |
| 50 |  | Giá trị mục tiêu của hợp đồng | number | PurchaseContractTargetAmount | x | x |  |  | Hệ thống tính tổng giá trị (TargetQuantity * (ContractNetPriceAmount * OrderPriceUnitToOrderUnitNmrtr/OrdPriceUnitToOrderUnitDnmntr)) |  |  |
| 51 |  | Tham chiếu ngoài (external reference) | input text | PurgDocExternalReference |  | x |  |  | Trường này lưu thông tin Mã Ticket khởi tạo Hợp đồng của KYTA |  |  |
| 52 |  | Tên/mô tả chứng từ | input text | PurchasingDocumentName |  | x |  |  |  |  |  |
| 53 |  | Bên A |  |  |  |  |  |  |  |  |  |
| 54 |  | Tên doanh | Dropdown |  | x | x |  |  | Lấy từ catalog: Orgchat |  |  |
| 55 |  |  |  |  |  |  |  |  | Trường :ost center name |  |  |
| 56 |  | Tên viết tắt | input text |  | x | x |  |  | Fill giá trị theo Tên doanh nghiệp |  |  |
| 57 |  | Địa chỉ trụ sở | input text |  | x | x |  |  | Fill giá trị theo Tên doanh nghiệp |  |  |
| 58 |  | Điện thoại | input text |  | x | x |  |  | Fill giá trị theo Tên doanh nghiệp |  |  |
| 59 |  | Số Fax | input text |  | x | x |  |  | Fill giá trị theo Tên doanh nghiệp |  |  |
| 60 |  | Mã số thuế | input text |  | x | x |  |  | Fill giá trị theo Tên doanh nghiệp |  |  |
| 61 |  | Người đại diện | Dropdown |  | x | x |  |  | Lấy từ catalog: Approval Matrix project |  |  |
| 62 |  |  |  |  |  |  |  |  | Trường: Name |  |  |
| 63 |  | Chức vụ | input text |  | x | x |  |  | Fill giá trị theo Tên người đại diện |  |  |
| 64 |  | Theo ủy quyền | input text |  |  | x |  |  |  |  |  |
| 65 |  | Bên B |  |  |  |  |  |  |  |  |  |
| 66 |  | Tên doanh nghiệp | input text |  |  | x |  |  |  |  |  |
| 67 |  | Địa chỉ trụ sở | input text |  |  | x |  |  |  |  |  |
| 68 |  | Địa chỉ CN/VPĐD | input text |  |  | x |  |  |  |  |  |
| 69 |  | Điện thoại | input text |  |  | x |  |  |  |  |  |
| 70 |  | Mã số thuế | input text |  |  | x |  |  |  |  |  |
| 71 |  | Số Fax | input text |  |  | x |  |  |  |  |  |
| 72 |  | Tài khoản số | input text |  |  | x |  |  |  |  |  |
| 73 |  | Tại ngân hàng | input text |  |  | x |  |  |  |  |  |
| 74 |  | Người đại diện | input text |  |  | x |  |  |  |  |  |
| 75 |  | Chi nhánh | input text |  |  | x |  |  |  |  |  |
| 76 |  | Chức vụ | input text |  |  | x |  |  |  |  |  |
| 77 |  | Theo ủy quyền | input text |  |  | x |  |  |  |  |  |
| 78 | lable | Danh sách dòng hạng mục Contract |  |  |  | x |  |  |  |  |  |
| 79 | table | Số thứ tự dòng Contract | input text | PurchaseContractItem | x | x |  |  | Sinh tự động tăng dần |  |  |
| 80 | table | Mã công ty (dòng) | input text | CompanyCode | x | x |  |  | Fill giá trị từ CompanyCode trên header |  |  |
| 81 | table | Nhà máy | Dropdown | Plant | x | x |  |  | Catalog: Plant |  |  |
| 82 |  |  |  |  |  |  |  |  | Trường: Plant-Plant Description |  |  |
| 84 |  |  |  |  |  |  |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Lấy giá trị theo PR: Plant |  |  |
| 85 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR →  User lựa chọn theo data list Plant |  |  |
| 86 | table | Kho lưu trữ | input text | StorageLocation |  | x |  |  | Catalog: StorageLocation |  |  |
| 87 |  |  |  |  |  |  |  |  | Trường: Storage Location-Description |  |  |
| 89 |  |  |  |  |  |  |  |  | Lấy giá trị theo nhà máy |  |  |
| 90 | table | Mã vật tư | Dropdown | Material | x | x |  |  | Catalog: Material |  |  |
| 91 |  |  |  |  |  |  |  |  | Trường: Product |  |  |
| 93 |  |  |  |  |  |  |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Lấy giá trị theo PR: Material |  |  |
| 94 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR →  User lựa chọn theo data list gọi từ API_MATERIAL_SRV |  |  |
| 95 |  |  |  |  |  |  |  |  | Lưu ý: Nếu AccountAssignmentCategory = "" "" Rỗng & Q Proj.make-to-order |  |  |
| 96 |  |  |  |  |  |  |  |  | --> Bắt buộc phải có giá trị Material |  |  |
| 97 | table | Mô tả ngắn dòng hạng mục | input text | PurchaseContractItemText | x | x |  |  | Catalog: Material |  |  |
| 98 |  |  |  |  |  |  |  |  | Trường: ProductDescription |  |  |
| 100 |  |  |  |  |  |  |  |  | Lấy giá trị theo mã vật tư |  |  |
| 101 | table | Mô tả tên dài của vật tư | input text | NoteDescription |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy các giá trị PlainLongText |  |  |
| 102 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR: |  |  |
| 103 |  |  |  |  |  |  |  |  | - Người dùng nhập nếu như tên hiển thị lên hợp đồng cần chi tiết hơn tên diễn giải theo mã vật tư Material trên SAP để lên form in. |  |  |
| 104 | table | Ngôn ngữ văn bản |  | .Language | x |  |  |  | Mặc định "EN" |  |  |
| 105 | table | Loại đối tượng văn bản |  | TextObjectType | x |  |  |  | Mặc định "K01" giá trị Item Text |  |  |
| 106 | table | Loại đối tượng kỹ thuật (Text ID) |  | TechnicalObjectType | x |  |  |  | Mặc định "EKPO" giá trị Item Text |  |  |
| 107 | table | Mã vật tư NCC | Dropdown | SupplierMaterialNumber | x | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Lấy giá trị theo PR:SupplierMaterialNumber |  |  |
| 108 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → Người dùng điền thủ công |  |  |
| 109 | table | Nhóm vật tư | Dropdown | MaterialGroup |  | x |  |  | Catalog: Material Group |  |  |
| 110 |  |  |  |  |  |  |  |  | Trường: Material Group-Description |  |  |
| 112 |  |  |  |  |  |  |  |  | Lấy Material Group theo Material |  |  |
| 113 |  |  |  |  |  |  |  |  | Nếu Material = Null --> Người dùng chọn theo data list từ API Material Group |  |  |
| 114 | table | Đơn vị tính số lượng đặt hàng | Dropdown | OrderQuantityUnit | x | x |  |  | Catalog: ĐVT |  |  |
| 115 |  |  |  |  |  |  |  |  | Trường: Đơn vị tính-Description |  |  |
| 117 |  |  |  |  |  |  |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy các giá trị |  |  |
| 118 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR:Người dùng điền theo data list ĐVT |  |  |
| 119 | table | Số lượng mục tiêu của dòng | input text | TargetQuantity | x | x |  |  |  |  |  |
| 120 | table | Đơn vị tính giá đặt hàng | input text | OrderPriceUnit |  | x |  |  |  |  |  |
| 121 | table | Đơn giá thuần theo hợp đồng | number | ContractNetPriceAmount |  | x |  |  |  |  |  |
| 122 | table | Loại tiền tệ (dòng) | input text | DocumentCurrency |  |  |  |  | Fill giá trị từ DocumentCurrency trên header |  |  |
| 123 | table | Số lượng ứng với đơn giá thuần | input text | NetPriceQuantity |  | x |  |  |  |  |  |
| 124 | table | Tỷ lệ dung sai giao thừa (%) | input text | OverdelivTolrtdLmtRatioInPct |  | x |  |  |  |  |  |
| 125 | table | Tỷ lệ dung sai giao thiếu (%) | input text | UnderdelivTolrtdLmtRatioInPct |  | x |  |  |  |  |  |
| 126 | table | Loại dòng chứng từ mua hàng | Dropdown | PurchasingDocumentItemCategory |  | x |  |  | "Lấy từ catalog : Item Category |  |  |
| 127 |  |  |  |  |  |  |  |  | -Trường : Description |  |  |
| 128 |  |  |  |  |  |  |  |  | VD: L - Subcontracting" |  |  |
| 130 |  |  |  |  |  |  |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Lấy giá trị trên PR: PurchasingDocumentItemCategory |  |  |
| 131 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User lựa chọn trong danh sách data list Item Category |  |  |
| 132 | table | Loại hạch toán | Dropdown | AccountAssignmentCategory |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Lấy giá trị trên PR: PurchaseReqnAcctAssgmt |  |  |
| 133 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User lựa chọn trong danh sách data list Account Assignment Category |  |  |
| 134 | table | Bán kính ngoài | input text | YY1_Bnknhngoi_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_Bnknhngoi_PRI |  |  |
| 135 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 136 | table | Bản vẽ | input text | YY1_Bnv_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_Bnv_PDI |  |  |
| 137 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 138 | table | Chiều dài phần cong | input text | YY1_Chiudiphncong_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: Chiudiphncong_PDI |  |  |
| 139 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 140 | table | Chiều dài phần thẳng 1 | input text | YY1_Chiudiphnthng1_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: Chiudiphnthng1_PDI |  |  |
| 141 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 142 | table | Chiều dài phần thẳng 2 | input text | YY1_Chiudiphnthng2_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: Chiudiphnthng2_PDI |  |  |
| 143 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 144 | table | Chu vi sơn | input text | YY1_Chuvisn_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: Chuvisn_PDI |  |  |
| 145 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 146 | table | Diện tích sơn | input text | YY1_Dintchsn_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_Dintchsn_PDI |  |  |
| 147 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 148 | table | Dày (T) | input text | YY1_DyT_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_DyT_PDI |  |  |
| 149 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 150 | table | Góc cắt | input text | YY1_Gcct_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_Gcct_PDI |  |  |
| 151 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 152 | table | (%) Hao hụt | input text | YY1_Haoht_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_Haoht_PDI |  |  |
| 153 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 154 | table | Hoàn thiện | input text | YY1_Honthin_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_Honthin_PDI |  |  |
| 155 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 156 | table | % Dự trù | input text | YY1_Dutru |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_Dutru |  |  |
| 157 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 158 | table | Khối lượng dự toán (Kg) | input text | YY1_KhilngdtonKg_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: KhilngdtonKg_PDI |  |  |
| 159 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 160 | table | Khối lượng dự trù (Kg) | input text | YY1_KhilngdtrKg_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: KhilngdtrKg_PDI |  |  |
| 161 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 162 | table | Khối lượng hao hụt (Kg) | input text | YY1_KhilnghaohtKg_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: KhilnghaohtKg_PDI |  |  |
| 163 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 164 | table | Khối lượng MOQ (Kg) | input text | YY1_KhilngMOQKg_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: KhilngMOQKg_PDI |  |  |
| 165 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 166 | table | Ký hiệu | input text | YY1_Khiu_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_Khiu_PDI |  |  |
| 167 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 168 | table | KL đặt hàng 2 | input text | YY1_KLthng2_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_KLthng2_PDI |  |  |
| 169 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 170 | table | KL đặt hàng 3 | input text | YY1_KLthng3_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_KLthng3_PDI |  |  |
| 171 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 172 | table | KT Phương X | input text | YY1_KTPhngX_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_KTPhngX_PDI |  |  |
| 173 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 174 | table | KT Phương Y | input text | YY1_KTPhngY_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_KTPhngY_PDI |  |  |
| 175 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 176 | table | KT Phương Z | input text | YY1_KTPhngZ_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_KTPhngZ_PDI |  |  |
| 177 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 178 | table | MAC | input text | YY1_MAC_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_MAC_PDI |  |  |
| 179 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 180 | table | Màu | input text | YY1_mau_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_mau_PDI |  |  |
| 181 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 182 | table | (%) MOQ | input text | YY1_MOQ_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_MOQ_PDI |  |  |
| 183 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 184 | table | Đơn vị quy đổi 2 | input text | YY1_nvquyi2_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_nvquyi2_PDI |  |  |
| 185 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 186 | table | Đơn vị quy đổi 3 | input text | YY1_nvquyi3_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_nvquyi3_PDI |  |  |
| 187 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 188 | table | Số lượng dự toán | input text | YY1_Slngdton_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_Slngdton_PDI |  |  |
| 189 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 190 | table | Số lượng dự trù | input text | YY1_Slngdtr_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_Slngdtr_PDI |  |  |
| 191 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 192 | table | Số lượng MOQ | input text | YY1_SlngMOQ_PDI |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy giá trị trên PR: YY1_SlngMOQ_PDI |  |  |
| 193 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 194 | table | Trường mở rộng (custom field) do KYTA định nghĩa | input text | YY1_ItemTicketPC_PDI |  | x |  |  | Trường này lưu thông tin Mã Item Ticket khởi tạo Hợp đồng của KYTA |  |  |
| 195 | table | Danh sách phân bổ hạch toán của dòng |  | to_PurCtrAccount |  |  |  |  |  |  |  |
| 196 | table | Số thứ tự dòng phân bổ | input text | AccountAssignment |  |  |  |  |  |  |  |
| 197 | table | Số lượng phân bổ | input text | Quantity |  |  |  |  |  |  |  |
| 198 | table | Đơn vị tính số lượng phân bổ | input text | OrderQuantityUnit |  |  |  |  |  |  |  |
| 199 | table | Tài khoản GL | Dropdown | GLAccount | x | x |  |  | Lấy từ catalog : GL Account |  |  |
| 200 |  |  |  |  |  |  |  |  | -Trường : G/L Account Long Text |  |  |
| 202 |  |  |  |  |  |  |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Lấy giá trị GLAccount |  |  |
| 203 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 204 | table | Trung tâm chi phí | Dropdown | CostCenter |  | x |  |  | "Lấy từ catalog : Cost Center |  |  |
| 205 |  |  |  |  |  |  |  |  | -Trường : Cost Center Name |  |  |
| 207 |  |  |  |  |  |  |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Lấy giá trị CostCenter |  |  |
| 208 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 209 | table | Tài sản cố định (chủ) | Dropdown | MasterFixedAsset |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Lấy giá trị MasterFixedAsset |  |  |
| 210 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 211 |  |  |  |  |  |  |  |  | Lưu ý: Bắt buộc nếu AccountAssignmentCategory = "A" |  |  |
| 212 | table | Tài sản cố định (phụ) | Dropdown | FixedAsset |  | x |  |  | TH1: Có tham chiếu từ 1 ticket tạo PR → Tự động lấy các giá trị tương ứng của Item |  |  |
| 213 |  |  |  |  |  |  |  |  | TH2: Không tham chiếu từ ticket tạo PR → User nhập |  |  |
| 214 | table | Ghi chú/văn bản dài của dòng hạng mục | input text | to_PurCtrItemNotes |  | x |  |  |  |  |  |
| 215 | Update 05/10/2026 | Nội dung | Rich editor |  |  | x |  |  |  |  |  |
