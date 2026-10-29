# BMW — Nghiệp vụ khách hàng (eForm + eFlow)

> Tài liệu nghiệp vụ, dựng từ dữ liệu **đã pull thật** ngày 2026-09-27 trên `bmw/sandbox`
> (eform host `eform.sandbox.kytaplatform.com`, eflow host `eflow.sandbox.kytaplatform.com`).
> Nguồn: `workspace/bmw/sandbox/eform/` (71 form) + `workspace/bmw/sandbox/eflow/` (12 quy trình).
> Vai trò & thứ tự bước lấy từ **tên node CallActivity trên server** (đã xác minh). Phần suy đoán được gắn nhãn `[Inference]`.

## 1. Tổng quan

BMW là **nhà thầu xây lắp / sản xuất thi công (SXTC)**, quản lý công việc **theo dự án**. Toàn bộ nghiệp vụ số hoá trên Kyta Platform thành **12 quy trình eFlow** (đánh số 1→10, thêm 1 bản Copy HĐ bán và bản 3.1 BCTC cập nhật). Mỗi quy trình gồm nhiều node; node kiểu `CallActivity` là **bước người dùng xử lý một biểu mẫu (eForm)**.

Chuỗi nghiệp vụ khép kín, kết thúc bằng **đồng bộ dữ liệu về SAP**:

```
Đàm phán / HĐ bán (1) → BOQ nội bộ (2) → BCTC đầu DA (3) → BCTC cập nhật (3.1)
                                     │
          Mua sắm:  PR qua DA (6) → Hợp đồng mua (7, eContract) → PO trong nước (8)
                                     │
          Sản xuất: Kế hoạch phối hợp SXTC (4) → Đơn hàng thành phẩm (5)
                                     │
          Thanh toán: Bill thanh toán (9) → Claim gửi CĐT (10)
                                     ▼
                              [ Đồng bộ SAP ]
```

## 2. Quy mô đã pull

| Phân hệ | Số lượng | Vị trí |
|---|---|---|
| eForm | 71 form (38 có code động, 44 có custom UI) | `workspace/bmw/sandbox/eform/` |
| eFlow | 12 quy trình | `workspace/bmw/sandbox/eflow/` |

## 3. Vai trò tham gia (đã xác minh từ tên node)

| Viết tắt hay gặp | Vai trò đầy đủ |
|---|---|
| CHT | Chỉ huy trưởng |
| GĐDA | Giám đốc dự án |
| BCH | Ban chỉ huy — thường là bước "chỉnh sửa / trả lại" biểu mẫu |
| BP kiểm soát | Bộ phận kiểm soát (Chuyên viên → Trưởng bộ phận) |
| BP kế hoạch | Bộ phận kế hoạch (Chuyên viên → Trưởng bộ phận) |
| BP sản xuất | Trưởng bộ phận sản xuất |
| BP cung ứng | Bộ phận cung ứng (mua hàng) |
| P.KTSX | Phòng Kỹ thuật sản xuất (Nhân viên → Trưởng phòng) |
| Chủ trì sản xuất | Người chủ trì khâu sản xuất |
| QS | `[Inference]` Quantity Surveyor — kỹ sư bóc tách khối lượng/dự toán |

## 4. Tích hợp hệ thống (node type trong eFlow)

| Loại node | Ý nghĩa | Xuất hiện ở quy trình |
|---|---|---|
| `Aggregate` "Đẩy dữ liệu về SAP" | Đồng bộ kết quả sang **SAP** | 2, 3, 3.1, 5, 6, 8 |
| `eContract` | Ký hợp đồng điện tử | 7 |
| `eCollabo` | Cộng tác / lấy ý kiến | 1, 7 |
| `eAPI` | Gọi API ngoài | hầu hết quy trình |
| `Aggregate` "Tổng hợp thông tin" | Gom dữ liệu nội bộ luồng | 2, 3, 3.1, 6, 8 |

## 5. Chi tiết 12 quy trình

### 1. Hợp đồng bán trong nước và xuất khẩu — `00007w9IRDRSEnrP05kW`
Lập và phê duyệt hợp đồng bán (phân biệt **trong nước** ↔ **xuất khẩu**). Bước chính:
Tổng hợp nội dung cần đàm phán → Upload excel BOQ đính kèm → Ý kiến phản hồi nội dung đàm phán → **CĐT có comment** (eCollabo) → Bộ phận kế hoạch chỉnh sửa → Nhân viên phê duyệt → Trưởng phòng phê duyệt.
- Form chính: `BMW_Hợp đồng mua bán trong nước và xuất khẩu` (code lớn nhất, 11KB): tự sinh tên HĐ theo loại + ngày, tự fill điều khoản **bảo lãnh / tạm ứng / thanh toán vật tư / quyết toán / phạt** từ bảng dữ liệu; chọn bảng theo loại HĐ (Trong nước → bảng nhập khẩu, Nước ngoài → bảng xuất khẩu).
- Có bản Copy: `1. Hợp đồng bán... - Copy` (`00007bBIkwSQ5MboOLK`) — `[Inference]` bản nháp/thử nghiệm.

### 2. BOQ nội bộ — `00007kKI2vntqQapo6On`
Lập bảng khối lượng (BOQ) nội bộ. Bước: **Chỉ huy trưởng duyệt** → **Chuyên viên kế hoạch duyệt** → (BCH chỉnh sửa nếu trả lại) → Tổng hợp thông tin → **Đẩy dữ liệu về SAP**.

### 3. BCTC — đầu DA — `00007KnI6QWfNvW5LD04`
Báo cáo tài chính (BCTC) đầu dự án. Bước: **CHT duyệt** → **GĐ dự án duyệt** → **rẽ 2 nhánh song song**:
- Nhánh kiểm soát: Chuyên viên BP kiểm soát (4.1.1) → Trưởng BP kiểm soát (4.1.2)
- Nhánh kế hoạch: Chuyên viên BP kế hoạch (4.2.1) → Trưởng BP kế hoạch (4.2.2)

→ Tổng hợp → **Đẩy dữ liệu về SAP**. (BCH chỉnh sửa nếu bị trả lại.)

### 3.1. BCTC — Cập nhật — `000079yI3mgSnRdWygG0`
Cập nhật BCTC trong quá trình chạy dự án. **Luồng phức tạp nhất — 18 node**: giống QT3 nhưng có thêm nhiều vòng duyệt kiểm soát/kế hoạch (4.3.1, 4.4.1) và **2 lần đẩy SAP** (5 và 5.1). Form `eF_3_BCTC_Thay đổi_start` xử lý bảng ngân sách "kỳ trước / kỳ này", ép "kỳ trước = kỳ này" và tự tính chênh lệch lợi nhuận (dòng `C.3`).
> ⚠️ Đây là quy trình rủi ro cao nhất khi bảo trì (nhiều nhánh song song + 2 điểm đồng bộ SAP).

### 4. Kế hoạch phối hợp SXTC — `00007eMImUWBl1wGN2`
Điều phối sản xuất – thi công. Quy trình đơn (1 node CallActivity). Form `BMW Kế hoạch phối hợp SXTC`.

### 5. Đơn hàng thành phẩm — `00007dMIKg6HzdoVd4Mm`
Đặt hàng thành phẩm cho sản xuất. Bước: **CHT duyệt** → QS chỉnh sửa đơn hàng → **GĐ dự án duyệt** → NV P.KTSX → (NV P.KTSX bước 6) → **Trưởng P.KTSX** → **Chủ trì sản xuất** → **Đẩy dữ liệu về SAP**.
- Có **checklist validator** (`eF_5_..._GDDA`): mọi dòng trong cột "Kiểm tra" phải được tích thì kết quả mới `True`.

### 6. Yêu cầu mua hàng (PR) qua dự án — `0000715IDBKh694Bmbk8`
Purchase Request gắn với dự án. Bước: **Trưởng BP sản xuất kiểm tra & xét duyệt** → **CHT phê duyệt** → **BP cung ứng kiểm duyệt** → Tổng hợp → **Đẩy dữ liệu về SAP**.
- Form `eF_7_PR_SP_02_01_start`: tính tổng khối lượng/diện tích theo ĐVT.

### 7. Hợp đồng mua — `00007owIPgguoEpdOL8e`
Ký hợp đồng mua hàng với nhà cung cấp. Bước: **Duyệt HĐ/PL** → BCH chỉnh sửa thông tin HĐ → eCollabo → **eContract (ký điện tử)** → eCollabo → eAPI.

### 8. Đặt hàng (PO trong nước) — `00007N1IEJQUNmeWAbBm`
Phát hành đơn đặt hàng nội địa. Bước: **Trưởng BP sản xuất kiểm tra & xét duyệt** → Tổng hợp → **Đẩy dữ liệu về SAP**.

### 9. Bill thanh toán — `000075yIMnUgQGzw98R`
Lập bill/đề nghị thanh toán. Quy trình đơn (1 node). Nhóm form `BMW Billing ...` (thanh toán, xác định/xác nhận khối lượng, xuất khẩu).

### 10. Claim gửi CĐT — `00007PnIylCQlkB3e92`
Lập và gửi claim (yêu cầu/khiếu nại) cho Chủ đầu tư. Quy trình đơn (1 node). Form `BMW Claim` + `BMW Cliam bản in`.

## 6. Đặc điểm code động (eForm)

Script trong các form chủ yếu làm:
- **Tự sinh tên ticket** theo mã + ngày/giờ (vd `BCTC_đầu DA_<mã>_<ngày>_<giờ>`).
- **Fill dữ liệu chéo giữa các bảng** (điều khoản HĐ lấy từ bảng theo nhãn dòng).
- **Tính toán / tổng hợp**: khối lượng, thành tiền, chênh lệch lợi nhuận, tổng theo ĐVT.
- **Validate trước submit**: checklist bắt buộc tích đủ, đồng bộ ràng buộc giữa các cột.

## 7. Ghi chú vận hành

- BMW chỉ dùng env **`sandbox`** (host chung mặc định của Kyta, không có host riêng trong `config/kyta.json`).
- Có vài form thử nghiệm/nháp cần bỏ qua khi làm việc chính thức: `Test`, `... - Copy`, `... _copy_copy`.
- Muốn xem người thực hiện thật của từng node: `kyta eflow impl list bmw sandbox "<quy trình>" "<node>"`.
- Muốn xem cấu hình thông báo: `kyta eflow notify list-all bmw sandbox "<quy trình>"`.
