# TÀI LIỆU BÀN GIAO & TÓM TẮT DỰ ÁN PR BMW (SESSION HANDOVER)

> **Mục đích**: Lưu trữ toàn bộ bối cảnh, kết quả kỹ thuật, danh sách form/template và các quy tắc nghiệp vụ đã thực hiện để session mới có thể đọc và nắm bắt ngay lập tức 100%.
> **Môi trường**: `bmw@sandbox` (Kyta Platform - `https://eform.sandbox.kytaplatform.com`)

---

## 1. Bản đồ tổng thể 11 Form PR (Luồng 1 & Luồng 2)

### Form con gốc (Subform):
- `subF_7_PR - Yêu cầu mua hàng` (`00007163IlBSv858DO8MhVdJx`)

### Luồng 1: PR Dự án (Sản xuất / Khối Sản Xuất - KSX)
| STT | Tên Form | Form ID | Vai trò & Đặc thù |
|---|---|---|---|
| 1 | `eF_7_PR_start` | `000071MgIBLclgRPMP9JSzdKR` | Form tạo mới YCMH |
| 2 | `eF_7_PR_update` | `000071mzIg8IW4azGeb4hMnQV` | Form chỉnh sửa (Khóa trường `textField-2` Số PR) |
| 3 | `eF_7_PR_TBPSX` | `00007115IJLi69MGdMDlu5KyN` | Form duyệt TBPSX (Trưởng BP Sản Xuất) |
| 4 | `eF_7_PR_CHT` | `000071RmI49C1VOl31zOTzrG6` | Form duyệt CHT (Chỉ Huy Trưởng) |
| 5 | `eF_7_PR_BPCU` | `000071GyIM2Ck5lRBK4Rh9vgA` | Form duyệt BPCU (Bộ Phận Cung Ứng) |
| 6 | `eF_7_PR_Đã duyệt` | `000071kKIRPIqQB5M0OnS2OMd` | Form xem bản PR hoàn tất (Read-only toàn bộ) |

### Luồng 2: PR Ban Chỉ Huy (BCH)
| STT | Tên Form | Form ID | Vai trò & Đặc thù |
|---|---|---|---|
| 7 | `eF_7_PR_BCH_start` | `000071QwIE1SnyRXb1J5uD2Vo` | Form tạo mới YCMH BCH |
| 8 | `eF_7_PR_BCH_update` | `000071w9Ir1SEnx5Qp5KTzWrQ` | Form chỉnh sửa BCH (Khóa trường `textField-2` Số PR) |
| 9 | `eF_7_PR_BCH_TBPSX` | `0000714XINBtdKqJWGQptPG3J` | Form duyệt BCH (TBPSX duyệt) |
| 10 | `eF_7_PR_BCH_Đã duyệt` | `0000719yIk1FnRXObvrdhlXQv` | Form xem bản PR BCH hoàn tất (Read-only) |

### Luồng 3: PR Nhà Máy / Vận Hành (SP.02.02)
| STT | Tên Form hiển thị | Form ID | Tên thư mục local | Vai trò & Chữ ký |
|---|---|---|---|---|
| 11 | `ver2_eF_7_PR_SP_02_02_start` | `000071BXIEsgxB4Kn10TObxD` | `eF_7_PR_SP_02_02_start` | Khởi tạo YCMH SP.02.02 |
| 12 | `ver2_eF_7_PR_SP_02_02_update` | `000071PnIeTQlAdokDwsDRna` | `eF_7_PR_SP_02_02_update` | Kỹ sư BP Sản xuất điều chỉnh PR (Khóa số PR) |
| 13 | `ver2_eF_7_PR_SP_02_02_TBPSX` | `0000718DIWI18DVQNdAtLdwo` | `eF_7_PR_SP_02_02_TBPSX` | Trưởng BP sản xuất duyệt (Ký xác nhận 1) |
| 14 | `ver2_eF_7_PR_SP_02_02_TBPVH` | `000071N1IrHNmzyrLGefJ8zD` | `eF_7_PR_SP_02_02_TBPVH` | Trưởng BP Vận hành duyệt (Ký xác nhận 2) |
| 15 | `ver2_eF_7_PR_SP_02_02_TBPKTVH` | `000071nPINcbLQ4wKLpiWpB8` | `eF_7_PR_SP_02_02_TBPKTVH` | Trưởng BP Kỹ thuật kế hoạch duyệt (Ký xác nhận 2) |
| 16 | `ver2_eF_7_PR_SP_02_02_NVCU` | `000071kKIQSqQ1OAWGRI2OMd` | `eF_7_PR_SP_02_02_NVCU` | Nhân viên cung ứng duyệt (Ký xác nhận 3) |
| 17 | `ver2_eF_7_PR_SP_02_02_Đã_duyệt` | `00007115IVF69mvRk1pI5KyN` | `eF_7_PR_SP_02_02_Đã duyệt` | Form xem hoàn tất sau khi đẩy SAP (Read-only) |

### Luồng 4: PR Phòng Ban (SP.02.03)
| STT | Tên Form hiển thị | Form ID | Tên thư mục local | Vai trò & Chữ ký |
|---|---|---|---|---|
| 18 | `ver2_eF_7_PR_SP_02_03_start` | `0000715yIgsgQ6LeEGLSKeQv` | `eF_7_PR_SP_02_03_start` | Khởi tạo YCMH SP.02.03 |
| 19 | `ver2_eF_7_PR_SP_02_03_update` | `000071XrInTvVgzeblBHMa9n` | `eF_7_PR_SP_02_03_update` | Chỉnh sửa PR SP.02.03 (Khóa số PR) |
| 20 | `ver2_eF_7_PR_SP_02_03_TPB` | `00007115IOI69mvQNDEs5KyN` | `eF_7_PR_SP_02_03_TPB` | Trưởng phòng ban duyệt (Ký xác nhận 1) |
| 21 | `ver2_eF_7_PR_SP_02_03_NVMS` | `000071JlI1H4An9vWQ3uQEv2` | `eF_7_PR_SP_02_03_NVMS` | Nhân viên mua sắm duyệt (Ký xác nhận 2) |
| 22 | `ver2_eF_7_PR_SP_02_03_Đã_duyệt` | `000071kKIrcqQ1Omx0Qc2OMd` | `eF_7_PR_SP_02_03_Đã duyệt` | Form xem hoàn tất sau khi đẩy SAP (Read-only) |

---

## 2. Toàn bộ các công việc đã giải quyết xong trong session này

### 2.1. Cơ chế Chặn Submit khi Bảng PR thiếu thông tin bắt buộc:
- Bắt sự kiện submit của nền tảng Kyta thông qua **ô Gate (`textField-12`)** và **Event Interceptor** trên các nút Submit/Gửi giao dịch.
- Nếu người dùng bấm "Gửi giao dịch" mà các cột bắt buộc trong bảng (`table_advance-3`) chưa điền đủ $\rightarrow$ Chặn submit ngay lập tức, hiển thị Modal cảnh báo với giao diện đơn giản, trang nhã, không icon rườm rà.
- Đã dọn dẹp toàn bộ console.log debug thừa trên cả 11 form.

### 2.2. Phân quyền Read-only cho các Form Duyệt:
- **Nguyên tắc**: Toàn bộ 26 trường thông tin kế thừa từ form soạn thảo/subform khi sang các form duyệt (`TBPSX`, `CHT`, `BPCU`, `Đã duyệt`) đều được thiết lập **`readonly: true`**.
- Người duyệt **không thể sửa** dữ liệu của nhân viên.
- Chỉ mở cho phép thao tác ở các trường tác vụ duyệt riêng:
  - `dropdown-4`: Yêu cầu chỉnh sửa (Duyệt / Yêu cầu chỉnh sửa)
  - `table_advance-2`: Nhập lý do chỉnh sửa
  - `signature-1`, `signature-2`, `signature-3`: Ô chữ ký xác nhận của cấp duyệt.

### 2.3. eWriter Luồng 2 BCH (`000071arIG6u5woqD2p0`):
- Chuẩn hóa template bản in cho Luồng 2:
  - Đã nhúng đủ 14 biến dữ liệu form sang bản in word/docx.
  - Xóa bỏ chữ ký thừa của BPCU và TBPSX, **chỉ giữ lại duy nhất 1 ô chữ ký của Chỉ huy trưởng (`l87d4wvv2`)**.
  - Đã đồng bộ cấu hình biến và nạp file docx chuẩn lên server sandbox.

### 2.4. Đổi tên Table & Cơ chế Đồng bộ Subform tự động:
- Đổi tên bảng `table_advance-3` (`jvpvs9zbt`) thành **`Table`**.
- Phát triển kịch bản đồng bộ tự động 10 form cha khi sửa subform:
  - Tài liệu chi tiết: `docs/eform-subform-sync-playbook.md`
  - Script thực thi 1 click: `node scratch/sync_subform_to_all.js --execute`
  - Tự động áp dụng đúng quy tắc: Start mở bình thường, Update khóa số PR, Duyệt khóa 100% trường con.

### 2.5. Khóa chọn ngày quá khứ cho cột "Ngày giao hàng mong muốn":
- Áp dụng trên cột **Ngày giao hàng mong muốn** (`DeliveryDate` - index 19) của bảng:
  - **Lịch Datepicker**: Gắn thuộc tính `min="YYYY-MM-DD"` (ngày hiện tại) $\rightarrow$ Các ngày trong quá khứ bị mờ xám và không thể click chọn.
  - **Nhập / Thay đổi giá trị**: Bắt sự kiện `change` và `blur`, nếu ngày nhỏ hơn ngày hiện tại $\rightarrow$ Tự động xóa về rỗng và bật toast cảnh báo: *"Ngày giao hàng mong muốn không được chọn ngày trong quá khứ"*.
  - **Dán dữ liệu (Paste)**: Kiểm tra từng ô dán vào, tự động loại bỏ ngày quá khứ.
  - **Kiểm tra Submit**: Kiểm tra toàn bộ dòng trước khi submit, chặn gửi giao dịch nếu có dòng chứa ngày quá khứ.
  - **Chế độ Duyệt (Readonly)**: Giữ nguyên hiển thị ngày dạng văn bản cho người duyệt xem, không can thiệp.

### 2.6. Khắc phục lỗi Enter xuống dòng ở "8. Ghi chú" trong eWriter bị sinh dòng 9:
- **Nguyên nhân**: Đoạn văn bản chứa mục `8. Ghi chú` trong template Word gốc đang bật tính năng danh sách tự động (`<w:numPr><w:numId w:val="1"/></w:numPr>`). Khi người dùng nhấn Enter xuống dòng trong form, engine MailMerge sinh đoạn văn bản mới và Word tự động gán số thứ tự tiếp theo (`9.`).
- **Giải pháp**:
  - Gỡ bỏ `<w:numPr>` khỏi đoạn văn bản của mục 8 trong cả 2 template (`000071mzIofW4a0DRXp` Luồng 1 và `000071arIG6u5woqD2p0` Luồng 2).
  - Cố định số thứ tự `8.` bằng văn bản kèm tab thụt lề chuẩn: `<w:t>8.</w:t><w:tab/><w:t>Ghi chú: </w:t>`.
  - Kết quả: Khi nhấn Enter xuống nhiều dòng, các dòng tiếp theo chỉ là các đoạn văn bản tiếp nối của mục 8, **tuyệt đối không bị sinh thêm dòng 9, 10...**

### 2.7. Khắc phục lỗi mất 3 trường "Hoàn thiện", "% Dự trù", "Bản vẽ" khi submit form:
- **Hiện tượng**: Người dùng nhập dữ liệu ở form start vào 3 cột cuối cùng của bảng PR: "Hoàn thiện", "% Dự trù", "Bản vẽ", nhưng khi bấm Submit gửi form thì data table lưu được tất cả các cột trước đó, chỉ thiếu đúng 3 cột này.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Bảng PR có tổng cộng **56 cột** (index 0 đến 55). Trong đó 3 cột cuối là:
    - Index 53: `Hoàn thiện` (`YY1_Honthin_PRI`)
    - Index 54: `% Dự trù` (`YY1_Dutru`)
    - Index 55: `Bản vẽ` (`YY1_Bnv_PRI`)
  - Bảng có 3 cột kỹ thuật ẩn đối với người dùng là: index 7, 8, 9 (`PlainLongText`, `TextObjectCategory`, `TextObjectType`).
  - Trong hàm `syncManifest()` của `table_advance-3/script.js` và `table_advance-1/script.js`:
    ```javascript
    // Code cũ gây lỗi:
    var visibleCols = [];
    for (var i = 0; i < COL_COUNT; i++) {
      if (!HIDDEN_COLS[i]) visibleCols.push({ title: COLUMN_TITLES[i], type: 'text' });
    }
    bridge.setConfig({ columns: visibleCols, ... });
    ```
  - Do lọc bỏ 3 cột ẩn, mảng `visibleCols` chỉ có độ dài là **53 cột** ($56 - 3 = 53$).
  - Trong khi đó, dữ liệu các hàng được đẩy vào qua `bridge.setValue(data)` có **56 phần tử/hàng**.
  - Nền tảng Kyta căn cứ theo `columns` (53 cột) trong manifest để chuẩn hóa/lưu trữ dữ liệu form. Vì manifest chỉ khai báo 53 cột, Kyta đã **cắt bớt (truncate) các phần tử từ index 53 trở đi** (`data[r].slice(0, 53)`).
  - Do đó, đúng 3 cột ở index 53, 54, 55 ("Hoàn thiện", "% Dự trù", "Bản vẽ") bị cắt bỏ hoàn toàn khi submit!
- **Giải pháp**:
  - Sửa `syncManifest()` khai báo đủ toàn bộ **56 cột** vào `bridge.setConfig`:
    ```javascript
    function syncManifest() {
      try {
        var allCols = [];
        for (var i = 0; i < COL_COUNT; i++) {
          allCols.push({ title: COLUMN_TITLES[i], type: 'text' });
        }
        bridge.setConfig({ columns: allCols, merges: [], fixedRowsTop: 0, version: 1 });
      } catch (e) {}
    }
    ```
  - Các cột 7, 8, 9 vẫn được ẩn hoàn toàn trên giao diện HTML của widget (`buildHeaderHtml` và `buildRowHtml` giữ nguyên `if (HIDDEN_COLS[ci]) continue`).
  - Đã đồng bộ và push cập nhật lên toàn bộ 11 form (`subF_7_PR` và 10 form cha) trên môi trường sandbox.

### 2.8. Cấu hình bắt buộc (Required) cho 3 cột: "Tổ chức mua hàng", "Nhóm mua hàng", "Nhà máy":
- **Yêu cầu**: 3 trường thông tin:
  - Cột 15: `Tổ chức mua hàng` (`PurchasingOrganization`)
  - Cột 16: `Nhóm mua hàng` (`PurchasingGroup`)
  - Cột 17: `Nhà máy` (`Plant`)
  phải là các trường bắt buộc nhập (`required`).
- **Thực hiện**:
  - Bổ sung các index `15, 16, 17` vào danh sách `STATIC_REQUIRED`:
    ```javascript
    var STATIC_REQUIRED = [5, 6, 11, 15, 16, 17, 38, 39, 40, 41];
    ```
  - Cập nhật cả ở tầng widget UI (`table_advance-3`, `table_advance-1`) và tầng script form (`code/main.js` hàm `validateGuard`).
  - Khi người dùng để trống 1 trong 3 ô này:
    - Ô bị đánh dấu viền đỏ cảnh báo (`pr-req-missing`).
    - Nút submit bị chặn bởi guard và hiện modal popup liệt kê rõ tên cột bị thiếu.
  - Đã đồng bộ và push lên toàn bộ 11 form trên `bmw@sandbox`.

### 2.9. Nhân bản 12 form mới cho luồng SP.02.02 và SP.02.03 & chuyển trạng thái "Phát hành" (Release):
- **Danh sách 12 form mới**:
  - **Luồng SP.02.02 (7 forms)**:
    1. `ver2_eF_7_PR_SP_02_02_start`: `000071BXIEsgxB4Kn10TObxD` (Phát hành)
    2. `ver2_eF_7_PR_SP_02_02_update`: `000071PnIeTQlAdokDwsDRna` (Phát hành)
    3. `ver2_eF_7_PR_SP_02_02_TBPSX`: `0000718DIWI18DVQNdAtLdwo` (Phát hành)
    4. `ver2_eF_7_PR_SP_02_02_TBPVH`: `000071N1IrHNmzyrLGefJ8zD` (Phát hành)
    5. `ver2_eF_7_PR_SP_02_02_TBPKTVH`: `000071nPINcbLQ4wKLpiWpB8` (Phát hành)
    6. `ver2_eF_7_PR_SP_02_02_NVCU`: `000071kKIQSqQ1OAWGRI2OMd` (Phát hành)
    7. `ver2_eF_7_PR_SP_02_02_Đã_duyệt`: `00007115IVF69mvRk1pI5KyN` (Phát hành)
  - **Luồng SP.02.03 (5 forms)**:
    8. `ver2_eF_7_PR_SP_02_03_start`: `0000715yIgsgQ6LeEGLSKeQv` (Phát hành)
    9. `ver2_eF_7_PR_SP_02_03_update`: `000071XrInTvVgzeblBHMa9n` (Phát hành)
    10. `ver2_eF_7_PR_SP_02_03_TPB`: `00007115IOI69mvQNDEs5KyN` (Phát hành)
    11. `ver2_eF_7_PR_SP_02_03_NVMS`: `000071JlI1H4An9vWQ3uQEv2` (Phát hành)
    12. `ver2_eF_7_PR_SP_02_03_Đã_duyệt`: `000071kKIrcqQ1Omx0Qc2OMd` (Phát hành)
### 2.10. Tích hợp và cấu hình hoàn chỉnh eWriter cho Luồng SP.02.02 và SP.02.03:
- **Tài liệu eWriter Luồng SP.02.02**:
  - URL / ID: [000071GyIk5Tk5aBzNnq](https://ewriter.sandbox.kytaplatform.com/file-edit/update/000071GyIk5Tk5aBzNnq)
  - Tên: `PR(SP.02.02).Yêu cầu mua vật tư tồn kho chưa chỉ định dự án (Areus, BM Living).docx`
  - Tiêu đề bản in: `YÊU CẦU MUA VẬT TƯ TỒN KHO CHƯA CHỈ ĐỊNH DỰ ÁN`
  - Form liên kết (`eformId`): `000071BXIEsgxB4Kn10TObxD` (start form) và 7 form versions của luồng.
  - Cấu hình chữ ký (4 ô):
    1. `Trưởng BP sản xuất (Ký xác nhận)` (`garxjoouy`)
    2. `Trưởng BP Vận hành (Ký xác nhận)` (`l87d4wvv2`)
    3. `Trưởng BP Kỹ thuật kế hoạch (Ký xác nhận)` (`kt8d4wvv2`)
    4. `Nhân viên cung ứng (Ký xác nhận)` (`wywp3t91e`)
  - Đã cập nhật nút `view_ewriter` trên cả 7 form của `SP_02_02` trỏ đúng vào docId này.
- **Tài liệu eWriter Luồng SP.02.03**:
  - URL / ID: [0000719yI5MTnRXwqz2g](https://ewriter.sandbox.kytaplatform.com/file-edit/update/0000719yI5MTnRXwqz2g)
  - Tên: `PR(SP.02.03).Yêu cầu mua sắm tập trung.docx`
  - Tiêu đề bản in: `YÊU CẦU MUA SẮM TẬP TRUNG`
  - Form liên kết (`eformId`): `0000715yIgsgQ6LeEGLSKeQv` (start form) và 5 form versions của luồng.
  - Cấu hình chữ ký (2 ô):
    1. `Trưởng phòng ban (Ký xác nhận)` (`garxjoouy`)
    2. `Nhân viên mua sắm (Ký xác nhận)` (`l87d4wvv2`)
  - Đã cập nhật nút `view_ewriter` trên cả 5 form của `SP_02_03` trỏ đúng vào docId này.
- **Bảng dữ liệu & Biến**:
  - Cả 2 tài liệu đều sử dụng bảng vật tư chuẩn 56 cột (`col_1` đến `col_56`) và thẻ lặp `DOCVARIABLE "Danh sách dòng hạng mục PR (jvpvs9zbt)"`.
  - Toàn bộ 13 trường Header & Footer của `subF_7_PR` đã được map đúng mã `hashid`.
  - Đã chạy kiểm thử E2E trực tiếp qua API `POST /documents/preview/{id}`: Kết quả kiểm tra trích xuất file trả về **khớp 100% dữ liệu** (công trình, số PR, bảng vật tư...).
  - **Tiêu đề Form (`h1`)**: Đã cập nhật tiêu đề trên cả 12 form khớp 100% với tiêu đề bản in eWriter:
    + 7 form Luồng SP.02.02: `YÊU CẦU MUA VẬT TƯ TỒN KHO CHƯA CHỈ ĐỊNH DỰ ÁN (AREUS, BM LIVING)`
    + 5 form Luồng SP.02.03: `YÊU CẦU MUA SẮM TẬP TRUNG`

### 2.11. Khắc phục lỗi Form Chỉnh sửa thêm dòng trống vẫn Submit được và không hiện cảnh báo:
- **Hiện tượng**: Ở form start, khi thiếu thông tin required thì bấm submit hiện modal popup cảnh báo và chặn gửi. Tuy nhiên ở các form update (chỉnh sửa), khi người dùng bấm "Thêm dòng" và để trống thông tin ở dòng mới thêm thì không có popup cảnh báo và vẫn submit được bình thường.
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. Trong `ui/table_advance-3/script.js` (hàm `getMissingCells()`):
     - Có đoạn kiểm tra `if (!rowHasData(row)) continue;`.
     - Ở form update, dòng 1 đã có sẵn dữ liệu PR cũ nên `hasAny === true`. Dòng mới thêm hoàn toàn trống dữ liệu nên `rowHasData(row)` trả về `false` $\rightarrow$ bị lệnh `continue` bỏ qua, dẫn đến `getMissingCells()` trả về rỗng (`[]`).
     - Bộ lắng nghe nút Submit (`hookSubmitClick`) thấy `missing.length === 0` nên không chặn sự kiện click và không hiển thị modal popup cảnh báo.
  2. Trong `code/main.js` (hàm `validateGuard()`):
     - Có điều kiện `if (!hasData) return;` bỏ qua các dòng không có dữ liệu thật.
     - Dòng mới thêm bị bỏ qua nên biến đếm `missing` vẫn bằng 0, điều kiện `isOk` vẫn thỏa mãn và gán `GUARD` (`textField-12`) thành `"OK"`.
     - Nền tảng Kyta thấy trường guard thỏa mãn nên cho phép submit thành công.
- **Giải pháp**:
  - **Trong `ui/table_advance-3/script.js`**:
    + Sửa `getMissingCells()`: Duyệt qua tất cả các dòng hiện có trong `data`, kiểm tra từng ô bắt buộc mà không bỏ qua dòng trống.
    + Bổ sung trong `checkAndAlertMissing()`: Đánh dấu `touched = true` và thêm class `pr-req-missing` ngay lập tức cho toàn bộ các ô bị thiếu để hiển thị viền đỏ trực quan trên bảng.
    + Trong `pushValue()`: Cập nhật trực tiếp trạng thái `textField-12` (`GUARD`) thành rỗng `""` ngay khi có ô thiếu hoặc `data` không hợp lệ.
  - **Trong `code/main.js`**:
    + Sửa `validateGuard()`: Kiểm tra toàn bộ các dòng trả về từ `dataRows()`, chỉ gán `"OK"` khi toàn bộ các dòng đều không thiếu trường required nào (`rows.length > 0 && missing === 0`).
### 2.12. Đính chính vai trò node & nhãn chữ ký `ver2_eF_7_PR_SP_02_02_TBPKTVH`:
- **Đính chính**: Tên viết tắt `TBPKTVH` là **Trưởng BP Kỹ thuật kế hoạch** (không phải "Kỹ thuật vận hành").
- **Cập nhật thực hiện**:
  - Đã đổi nhãn trường ký `kt8d4wvv2`: `Trưởng BP Kỹ thuật vận hành (Ký xác nhận)` $\rightarrow$ **`Trưởng BP Kỹ thuật kế hoạch (Ký xác nhận)`** trên cả 3 form của Luồng SP_02_02:
    1. `ver2_eF_7_PR_SP_02_02_TBPKTVH` (`000071nPINcbLQ4wKLpiWpB8`)
    2. `ver2_eF_7_PR_SP_02_02_NVCU` (`000071kKIQSqQ1OAWGRI2OMd`)
    3. `ver2_eF_7_PR_SP_02_02_Đã_duyệt` (`00007115IVF69mvRk1pI5KyN`)
  - Đã cập nhật tên biến chữ ký `kt8d4wvv2` trong tài liệu eWriter `000071GyIk5Tk5aBzNnq`:
    `Trưởng BP Kỹ thuật kế hoạch (Ký xác nhận) (kt8d4wvv2)`.
  - Toàn bộ 12 form của 2 luồng SP.02.02 và SP.02.03 vẫn ở trạng thái **Phát hành** (`releasing`), sẵn sàng gán vào eFlow.

### 2.13. Đồng bộ cập nhật mới của `subF_7_PR` sang toàn bộ 22 Form cha:
- **Nội dung cập nhật trong subform**:
  - Bổ sung trường `datepicker-2` (Ngày hiện tại - `y7jgre2nm`) với cấu hình `useDateLocal = true`.
  - Cập nhật ràng buộc ngày tối thiểu cho `datepicker-1` (Ngày tạo phiếu): `minDate = "#00007163IlBSv858DO8MhVdJx_datepicker-2"` (chặn chọn ngày trong quá khứ).
  - Giữ nguyên toàn bộ logic validation bảng `table_advance-3` và code động `code/main.js`.
- **Thực hiện đồng bộ 22 Form cha** (tuân thủ nghiêm ngặt Playbook `docs/eform-subform-sync-playbook.md`):
  1. **Nhóm Start (4 form)**: `ver2_eF_7_PR_SP-02-01-01_start`, `ver2_eF_7_PR_SP-02-01-02_start`, `ver2_eF_7_PR_SP_02_02_start`, `ver2_eF_7_PR_SP_02_03_start`.
     - Kế thừa 100% components mới, các trường nhập liệu giữ nguyên Editable.
  2. **Nhóm Update (4 form)**: `ver2_eF_7_PR_SP-02-01-01_update`, `ver2_eF_7_PR_SP-02-01-02_update`, `ver2_eF_7_PR_SP_02_02_update`, `ver2_eF_7_PR_SP_02_03_update`.
     - Kế thừa components mới + Cố định số phiếu (`textField-2.readonly = true`).
  3. **Nhóm Approval / View (14 form)**: Toàn bộ form TBPSX, CHT, NPCU/NVCU, TBPVH, TBPKTVH, TPB, NVMS, Đã duyệt.
     - Kế thừa components mới + Khóa 100% trường kế thừa (`readonly = true`), bảo toàn tuyệt đối quyền ký duyệt và các action phê duyệt ngoài subform.
- **Trạng thái**: Đã mở khóa, PUT cập nhật và Phát hành lại (`releasing`) thành công 100% trên `bmw@sandbox`. Snapshot local sạch 100%.

### 2.14. Bổ sung trường Dropdown "Kênh dự án" (`CostCenter`) cho toàn bộ 7 Form Luồng SP.02.02:
- **Yêu cầu**: Thêm dropdown `Kênh dự án`, mã code: `CostCenter`, bắt buộc (`required: true`) và hiển thị (`display: true`), dữ liệu lấy từ Catalog:
  - Bảng: `Profit Center` (ID: `6a7d354a2c83e233fe007733`)
  - Trường: `Profit Center Name` (Field ID: `textField_profitcenter-2`)
- **Phạm vi áp dụng (7 Form luồng SP.02.02)**:
  1. `ver2_eF_7_PR_SP_02_02_start` (`000071BXIEsgxB4Kn10TObxD`) - `readonly: false`
  2. `ver2_eF_7_PR_SP_02_02_update` (`000071PnIeTQlAdokDwsDRna`) - `readonly: false`
  3. `ver2_eF_7_PR_SP_02_02_TBPSX` (`0000718DIWI18DVQNdAtLdwo`) - `readonly: true`
  4. `ver2_eF_7_PR_SP_02_02_TBPVH` (`000071N1IrHNmzyrLGefJ8zD`) - `readonly: true`
  5. `ver2_eF_7_PR_SP_02_02_TBPKTVH` (`000071nPINcbLQ4wKLpiWpB8`) - `readonly: true`
  6. `ver2_eF_7_PR_SP_02_02_NVCU` (`000071kKIQSqQ1OAWGRI2OMd`) - `readonly: true`
  7. `ver2_eF_7_PR_SP_02_02_Đã_duyệt` (`00007115IVF69mvRk1pI5KyN`) - `readonly: true`
- **Vị trí bố trí**:
  - Nằm trong cột thông tin chung (Column 1 bên trái) ngay dưới trường `Mã dự án` (`dropdown-2`).
  - Key: `dropdown-5`, hashid duy nhất toàn hệ thống: `cstcntr01`.
- **Trạng thái**:
  - Đã nạp thành công lên server qua API và chuyển lại trạng thái **Phát hành** (`releasing` - statusForm: 2) cho toàn bộ 7 form.
  - Đã đồng bộ `fields.json` và snapshot local cho tất cả các folder `ver2_*` và `eF_*` tương ứng.

### 2.15. Bổ sung dữ liệu "BM Living" vào Catalog `Profit Center`:
- **Bối cảnh**: Luồng eFlow `PR(SP.02.02).Yêu cầu mua vật tư tồn kho chưa chỉ định dự án (Areus, BM Living)` chia 2 nhánh duyệt sau bước TBPSX:
  - Nhánh **Areus** $\rightarrow$ `6. Trưởng BP Kỹ thuật kế hoạch duyệt`
  - Nhánh **BM Living** $\rightarrow$ `5. Trưởng BP Vận hành duyệt`
- **Thực hiện**: Đã tạo bản ghi dữ liệu mới cho nhánh BM Living trên Catalog `Profit Center` (`6a7d354a2c83e233fe007733`):
  - `textField_input-1` (Profit Center Code): `O.26.002`
  - `textField_profitcenter-2` (Profit Center Name): `Dự Án BM Living`
- **Trạng thái**: Đã thêm thành công trên server sandbox (`id: 6abc8b378fbafd46f642e226`), đã pull snapshot về local `workspace/bmw/sandbox/ecatalog/Profit Center/data.json`.

### 2.16. Cấu hình Luật Điều kiện (jsonFormCondition) cho các Form Phê duyệt:
- **Hiện tượng**: Khi người duyệt chọn tác vụ `dropdown-4 = "Yêu cầu chỉnh sửa"`, form không tự động hiển thị bảng nhập lý do (`table_advance-2`) và không ẩn khung chữ ký (`columns-20`).
- **Nguyên nhân**: Trường `jsonFormCondition` trên các form phê duyệt nhân bản mới chưa được khai báo luật rẽ nhánh tương tác theo giá trị của dropdown tác vụ.
- **Giải pháp thực hiện**:
  - Cấu hình luật điều kiện chuẩn (`jsonFormCondition`) cho toàn bộ các form duyệt:
    ```json
    {
      "value": "Yêu cầu chỉnh sửa",
      "action": [
        { "type": "show", "fieldIds": ["<formId>_table_advance-2"] },
        { "type": "hide", "fieldIds": ["<formId>_columns-20"] }
      ],
      "enable": true,
      "fieldId": "<formId>_dropdown-4",
      "operator": "equal",
      "typeValue": "1",
      "conditionId": "YeuCauCS1"
    }
    ```
  - **Phạm vi áp dụng (10 Form duyệt)**:
    - **Luồng SP.02.02 (4 form)**: `TBPSX`, `TBPVH`, `TBPKTVH`, `NVCU`
    - **Luồng SP.02.03 (2 form)**: `TPB`, `NVMS`
    - **Luồng SP.02.01.01 & 02 (4 form)**: `TBPSX`, `CHT`, `NPCU`, `BCH_CHT`
  - **Trạng thái**: Đã cập nhật thành công lên server và Phát hành lại (`statusForm = 2`). Khi người dùng chọn "Phê duyệt": ẩn bảng lý do, hiện chữ ký; khi chuyển sang "Yêu cầu chỉnh sửa": hiện bảng nhập lý do, ẩn toàn bộ ô chữ ký xác nhận.

### 2.17. Cơ chế Bắt buộc nhập Lý do khi chọn "Yêu cầu chỉnh sửa" và Focus trực tiếp:
- **Yêu cầu**: Khi người duyệt chọn Kết quả duyệt là **"Yêu cầu chỉnh sửa"**, ô **"Lý do"** trong bảng `table_advance-2` (`ThongTinYeuCauChinhSua`) là **BẮT BUỘC**. Nếu để trống hoặc chỉ có khoảng trắng mà bấm Gửi/Submit thì hệ thống **chặn gửi ngay lập tức**, **không hiện popup cảnh báo**, mà sẽ **tự động focus trực tiếp** vào ô nhập lý do.
- **Giải pháp kỹ thuật (trong `ui/table_advance-2/script.js` & `style.css`)**:
  - **Submit Interceptor**: Bắt sự kiện click nút Submit / Gửi giao dịch (`click` & `submit` với `useCapture = true`) ở mọi ngữ cảnh (`document`, `window.parent`, `window.top`).
  - **Kiểm tra trạng thái**:
    - Khi `dropdown-4 == "Phê duyệt"` hoặc form readonly: Không can thiệp, cho submit bình thường.
    - Khi `dropdown-4 == "Yêu cầu chỉnh sửa"`: Kiểm tra ô `input.cell-input` (cột Lý do).
  - **Hành vi UX khi thiếu lý do**:
    - Ngăn chặn hoàn toàn sự kiện submit (`preventDefault`, `stopImmediatePropagation`).
    - Bật class `.cell-input-error`: Viền đỏ (`#ef4444`), viền sáng nhẹ, nền đỏ nhạt (`#fef2f2`), đổi placeholder thành: *"Bắt buộc nhập lý do yêu cầu chỉnh sửa..."*.
    - Cuộn mượt màn hình tới ô nhập (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) và tự động focus con trỏ vào ô nhập (`focus()`).
    - Ngay khi người duyệt gõ ký tự bất kỳ, viền đỏ và highlight tự động gỡ bỏ.
- **Phạm vi áp dụng (10 Form duyệt trên toàn bộ 4 luồng)**:
  - **Luồng 1 (3 form)**: `TBPSX` (`00007115IJLi69MGdMDlu5KyN`), `CHT` (`000071RmI49C1VOl31zOTzrG6`), `BPCU` (`000071GyIM2Ck5lRBK4Rh9vgA`).
  - **Luồng 2 (1 form)**: `BCH_TBPSX` (`0000714XINBtdKqJWGQptPG3J`).
  - **Luồng 3 - SP.02.02 (4 form)**: `TBPSX` (`0000718DIWI18DVQNdAtLdwo`), `TBPVH` (`000071N1IrHNmzyrLGefJ8zD`), `TBPKTVH` (`000071nPINcbLQ4wKLpiWpB8`), `NVCU` (`000071kKIQSqQ1OAWGRI2OMd`).
  - **Luồng 4 - SP.02.03 (2 form)**: `TPB` (`00007115IOI69mvQNDEs5KyN`), `NVMS` (`000071JlI1H4An9vWQ3uQEv2`).
- **Trạng thái**: Đã đồng bộ local + nạp lên server và Re-release thành công 100% (`statusForm = 2`).

### 2.18. Bỏ Popup cảnh báo ở Bảng PR, tự động Focus ô thiếu đầu tiên và Hiện cảnh báo đỏ tức thì cho toàn bộ ô thiếu:
- **Yêu cầu**: 
  - Khi người dùng bấm Gửi/Submit mà bảng PR thiếu dữ liệu bắt buộc: **Bỏ hoàn toàn modal popup** (không bắt người dùng phải bấm nút trên popup mới được chuyển tới ô thiếu).
  - **Mặc định cuộn và focus ngay lập tức vào ô thiếu đầu tiên** (theo đúng thứ tự quét dòng 1 $\rightarrow$ dòng n, cột trái $\rightarrow$ cột phải).
  - **Tất cả các ô thiếu còn lại trong bảng cũng lập tức hiện cảnh báo viền đỏ** để người dùng nhìn thấy toàn cảnh các vị trí cần nhập, chứ không cần phải click vào rồi rời đi mới hiện.
  - Khi người dùng nhập dữ liệu vào bất kỳ ô nào, viền đỏ của ô đó tự động biến mất ngay khi gõ phím.
- **Giải pháp kỹ thuật (trong `ui/table_advance-3/script.js` & `style.css`)**:
  - Gỡ bỏ hoàn toàn việc gọi `showMissingModal(missing)`.
  - Trong `checkAndAlertMissing()`:
    + Đánh dấu `touched[r-c] = true` và thêm class `.pr-req-missing` cho toàn bộ các ô trong danh sách `missing`.
    + Lấy phần tử đầu tiên `missing[0]`, gọi `focusAndHighlightCell(first.rowIdx, first.colIdx)` để cuộn mượt và đặt con trỏ chuột vào ô này.
  - Cải tiến CSS `.pr-req-missing`: Viền đỏ `#ff4d4f`, bóng trong mờ `box-shadow: inset 0 0 0 1px rgba(255, 77, 79, 0.4)`, nền đỏ nhạt `#fff1f0`. Ô đang focus có viền đậm `#dc2626` rõ nét.
  - Lắng nghe sự kiện `input` và `change` trên toàn bộ inputs và selects: Ngay khi ô có dữ liệu thì tự động gỡ bỏ class lỗi ngay lập tức mà không cần đợi blur.
- **Phạm vi áp dụng**: Đã đồng bộ cho `subF_7_PR - Yêu cầu mua hàng` và **toàn bộ 22 Form cha** (45 thư mục local + 23 form trên server) thuộc cả 4 luồng PR.
- **Trạng thái**: Đã PUT nạp lên server và Re-release thành công 100% (`statusForm = 2`).

### 2.19. Ngoại lệ form duyệt `ver2_eF_7_PR_SP_02_03_NVMS` — chỉ xác nhận, không yêu cầu chỉnh sửa:
- **Nghiệp vụ**: Dù là form duyệt, NVMS chỉ xác nhận và ký; không có nhánh trả yêu cầu chỉnh sửa.
- **Cập nhật**:
  - Gỡ trường tác vụ `dropdown-4` và bảng lý do `table_advance-2` khỏi form `000071JlI1H4An9vWQ3uQEv2`.
  - Xóa luật `YeuCauCS1` khỏi `jsonFormCondition`.
  - Giữ nguyên chữ ký `signature-1` (Trưởng phòng ban) và `signature-2` (Nhân viên mua sắm), trong đó chữ ký NVMS là bước xác nhận hiện tại.
- **Trạng thái**: Đã cập nhật và phát hành lại trên `bmw@sandbox` (`statusForm = 2`), pull snapshot local và xác nhận không còn luật điều kiện. Đây là ngoại lệ so với danh sách các form duyệt cần nhánh yêu cầu chỉnh sửa tại mục 2.17.

### 2.20. Gate bắt buộc lý do chỉnh sửa bằng field required của nền tảng:
- **Vấn đề**: Interceptor click/submit trong custom UI `table_advance-2` không luôn chặn được luồng Submit nội bộ của Kyta.
- **Cách sửa**:
  - Dùng field bắt buộc có sẵn `textField-12` (Gate của bảng PR) làm chốt chặn thực sự.
  - Trong `code/main.js`, khi `dropdown-4` là `Yêu cầu chỉnh sửa`, chỉ đặt Gate = `OK` nếu bảng `table_advance-2` có ít nhất một ô Lý do không rỗng; nếu không, giữ Gate rỗng để validation native của Kyta chặn Submit.
  - Bind thay đổi của dropdown và bảng lý do để cập nhật Gate; custom UI cũng đồng bộ Gate rỗng ngay khi submit thiếu lý do để tránh race.
  - Điều kiện kiểm tra này được kết hợp với validation bảng PR hiện có, không làm mất các ràng buộc required của bảng.
- **Phạm vi**: 9 form có nhánh yêu cầu chỉnh sửa: TBPSX, CHT, BPCU, BCH_TBPSX, 4 form duyệt SP.02.02 và TPB SP.02.03. Không áp dụng cho NVMS vì form này chỉ xác nhận.
- **Trạng thái**: Đã cập nhật và phát hành lại 9 form trên `bmw@sandbox`; API xác nhận `statusForm = 2` và mã gate mới có trên server. Đã pull snapshot về local; status của các form kiểm tra sạch.

---

### 2.21. Bảng ẩn 18 cột dùng riêng cho eWriter
- **Mục đích**: eWriter không còn dùng trực tiếp bảng PR 56 cột. Tạo bảng ẩn `table_advance-4` / hash `prprint01` (label `Danh sách dòng hạng mục PR bản in`) và đồng bộ ở 22 form cha; `display=false`, `allowAddRow=true` để runtime có thể ghi hàng bằng code.
- **Nguồn dữ liệu**: widget `table_advance-3` ghi bảng ẩn `table_advance-4` ngay trong `pushValue()` sau mỗi lần lưu bảng PR; lọc hàng trống rồi ánh xạ 18 cột. Code form cha cũng đồng bộ dự phòng từ `table_advance-3`/`table_advance-1`.
- **Thứ tự cột đầu ra (0-based nguồn)**: `0, 4, 5, 6, 35, 51, 38, 52, 28, 42, 40, 12, 39, 38, 19, 11, 55, 7` — tương ứng: Số thứ tự dòng PR; Mã vật tư; Tên mã vật tư; Material PO Text; Ký hiệu; MAC; Màu; KT Phương X; KT Phương Y; KT Phương Z; Dày (T); Đơn vị tính cơ sở; Diện tích; Màu (lặp theo yêu cầu); Ngày giao hàng mong muốn; Số lượng yêu cầu; Bản vẽ; Ghi chú/văn bản theo item.
- **eWriter**: bốn tài liệu SP.02.01.01 (`000071mzIofW4a0DRXp`), SP.02.01.02 (`000071arIG6u5woqD2p0`), SP.02.02 (`000071GyIk5Tk5aBzNnq`) và SP.02.03 (`0000719yI5MTnRXwqz2g`) đã đổi DOCVARIABLE sang `Danh sách dòng hạng mục PR bản in (prprint01)`, dùng MERGEFIELD `col_1`…`col_18` và được gán biến từ field `00007163IlBSv858DO8MhVdJx_table_advance-4`. Mapping `resourceId` phải trỏ tới form nguồn cha tương ứng của từng tài liệu; `fieldId` trỏ tới field bảng ẩn trong subform.
- **Kiểm tra sandbox**: xác nhận 22/22 form cha có field ẩn đủ 18 cột; cả bốn tài liệu có mapping `prprint01` với `applyServer=true`. Preview giả lập có dữ liệu đã merge đủ 18/18 cột trong cả bốn tài liệu. Phân tích DOCX xác nhận các placeholder `col_1`…`col_18`; các file đã render để kiểm tra bố cục bảng ngang.
- **Cỡ chữ tiêu đề**: hàng tiêu đề của cả bốn DOCX eWriter đặt 6.5 pt, in đậm, khớp cỡ phần dữ liệu; đã render lại và xác nhận tiêu đề xuống dòng gọn trong 18 cột.
- **Khắc phục bảng ẩn không nhận dữ liệu**:
  - Đã bật `pushHiddenField: true` trong `previewDocumentConfig` của component nút `view_ewriter-1` trên toàn bộ 22 form cha (giải quyết lỗi trình duyệt chặn gửi field ẩn sang eWriter).
  - Cập nhật hàm `syncPrintTable()` vào `code/main.js` trên cả 23 form (chạy trong `onChange()` khi bảng thay đổi) để đảm bảo dữ liệu luôn được trích xuất sang `table_advance-4`.
  - Cấu hình `table_advance-4`: `allowAddRow = true`, `readonly = false` (kể cả form duyệt), `display = false` để script luôn có quyền ghi dữ liệu.
### 2.22. Tính năng Xuất file excel mẫu và Import file excel trên Bảng PR:
- **Nhu cầu**: Cho phép người dùng xuất file Excel chuẩn kèm danh mục catalog để nhập liệu offline và import vào bảng PR 56 cột.
- **Thực hiện (trong `ui/table_advance-3`)**:
  - Tích hợp thư viện `ExcelJS` tải động từ CDN jsdelivr khi người dùng thao tác.
  - Thêm 2 nút bấm trên thanh toolbar: `Xuất file excel mẫu` (`#pr-export-template`) và `Import file excel` (`#pr-import-excel`).
  - **Xuất Excel mẫu (`exportTemplate`)**: Sinh file `.xlsx` gồm sheet chính `YCMH_PR` (56 cột chuẩn, format màu header, 2 dòng mẫu, ẩn cột kỹ thuật 7, 8, 9) và sheet ẩn `Lists` nạp toàn bộ danh mục Catalog để tạo dropdown list (Data Validation) trên các cột.
  - **Import Excel (`handleImportFile` & `importFromWorkbook`)**:
    + Thanh xác nhận inline an toàn: Cảnh báo ghi đè khi bảng đang có dữ liệu và giữ user gesture để mở file dialog.
    + Tự động map tên cột theo tiếng Việt chuẩn hóa NFC; fallback theo vị trí cột nếu header không khớp.
    + Parse đa định dạng ô (Date, formula result, hyperlink, number, string).
  - Tự động ẩn các nút Excel trên các form duyệt và form Đã duyệt (`readonly: true`).

### 2.23. Mở quyền chỉnh sửa (Editable) cột STT và Tự động đánh lại STT từ 1 đến hết khi Paste:
- **Vấn đề**: Cột STT (`Số thứ tự dòng PR` - index 0) trước đây bị cố định dạng `<span>` read-only khiến người dùng không click vào ô (0, 0) để paste từ Excel được. Đồng thời khi paste dữ liệu (từ dòng bất kỳ hoặc paste không kèm STT), STT chỉ tự nhảy từ dòng mới thêm mà không tự động đánh lại chuẩn từ dòng 1 đến hết bảng.
- **Giải pháp**:
  - **Chuyển sang thẻ `<input>`**: Khi form không ở chế độ readonly, cột STT hiển thị dạng input text căn giữa (`text-align: center`, màu chữ `#333`). Người dùng có thể click chọn ô (0, 0) để dán toàn bộ bảng từ Excel hoặc sửa số theo ý muốn.
  - **Tự động đánh lại STT chuẩn từ 1 đến dòng cuối cùng khi Paste (`applyPaste`)**: Ngay sau khi hoàn tất dán dữ liệu, hàm paste tự động quét lại toàn bộ bảng và gán `data[r][STT_COL] = String(r + 1)` cho mọi hàng từ dòng đầu tiên đến dòng cuối cùng.
  - **Tự động đánh lại khi Thêm / Xóa dòng / Import Excel**: Các thao tác `addRow()`, `deleteRow()`, `importFromWorkbook()` đều tự động chạy vòng lặp đánh lại STT tuần tự `1, 2, 3...` sạch sẽ, không bị đứt đoạn hoặc nhảy số.
  - **Mở paste cho cột STT**: Bỏ điều kiện `|| tc === STT_COL` trong hàm paste, cho phép dán dữ liệu vào cột STT khi chọn ô (0, 0).
  - **Điều hướng bàn phím**: Cập nhật `nextEditableCol` không còn bỏ qua cột STT, cho phép dùng phím mũi tên trái/phải di chuyển vào/ra cột STT.
  - **Đồng bộ**: Đã cập nhật cho cả `table_advance-3` và `table_advance-1` trên toàn bộ 23 form PR của cả 4 luồng trên `bmw@sandbox` và re-release thành công (`statusForm: 2`).


### 2.24. Rẽ nhánh chữ ký theo Kênh dự án (Areus / BM Living) trên Luồng SP.02.02:
- **Nghiệp vụ**: Luồng SP.02.02 rẽ 2 nhánh: Areus đi qua Trưởng BP Kỹ thuật kế hoạch (`TBPKTVH`), BM Living đi qua Trưởng BP Vận hành (`TBPVH`).
- **Thực hiện**:
  - Bổ sung luật điều kiện `jsonFormCondition` trên các form cấp sau (`NVCU` và `Đã duyệt`):
    + `dropdown-5` = "Dự Án Areus" $\rightarrow$ Ẩn `signature-2` (Trưởng BP Vận hành).
    + `dropdown-5` = "Dự Án BM Living" $\rightarrow$ Ẩn `signature-3` (Trưởng BP Kỹ thuật kế hoạch).
  - Xóa component chữ ký Trưởng BP Vận hành khỏi form `ver2_eF_7_PR_SP_02_02_TBPKTVH` để tránh thừa chữ ký.
  - Bật `validate.required = true` cho toàn bộ chữ ký trên các form duyệt của Luồng SP.02.02.

### 2.25. Chuẩn hóa đồng nhất font chữ toàn bộ 4 tài liệu eWriter (Times New Roman):
- **Hiện trạng trước khi xử lý**:
  - `docDefaults` và các styles cơ bản (`P9 Body Text`, `P10 List Paragraph`, `P11 Table Paragraph`) trong `word/styles.xml` của cả 4 tài liệu DOCX đều khai báo font mặc định là `Arial`.
  - Trong `word/document.xml`, các runs chữ chỉ khai báo `ascii="Times New Roman"` và `hAnsi="Times New Roman"`, hoàn toàn thiếu `cs="Times New Roman"` (Complex Script). Khi eWriter/Word render các ký tự tiếng Việt có dấu (như "Số thứ tự dòng PR", "Địa điểm", "Người nhận"...), engine bị font substitution sang font hệ thống khác.
  - Cột STT (cột 0): Ở Header row `pPr/rPr` có `sz="4"` (2 pt) xen lẫn `sz="13"` (6.5 pt) gây lệch font; ở Data row cột STT căn lề trái không đều với các cột số.
  - Vùng chữ ký (Table 2): Toàn bộ `DOCVARIABLE` chữ ký thiếu thẻ `rFonts` và `sz`, dẫn tới khi render bị fallback sang font `Arial` 11pt, lệch hoàn toàn so với tiêu đề chữ ký bên trên dùng `Times New Roman` 12pt và 10pt.
  - Các trường MERGEFIELD thông tin đơn hàng ở phần trên văn bản (`Công trình`, `Ngày tạo phiếu`, `Hạng mục`, `Số PR`, `Nội dung`, `Địa điểm`, `Người nhận`, `Ghi chú`...) thiếu khai báo cỡ chữ (`sz=None`), bị fallback cỡ chữ 11pt khác với nhãn 12pt.
- **Thực hiện chuẩn hóa (script `scratch/standardize_all_fonts.py`)**:
  - Đổi `docDefaults` và toàn bộ các style mặc định trong `styles.xml` sang font **`Times New Roman`** (đầy đủ `ascii`, `hAnsi`, `cs`) và cỡ chuẩn 12pt (`sz="24"`).
  - Bổ sung `word/fontTable.xml` khai báo font `Times New Roman` (charset `A3` Vietnamese).
  - Chuẩn hóa 100% các thẻ `<w:rFonts>` trong `word/document.xml` về `Times New Roman` cho cả 3 dải ký tự (`w:ascii`, `w:hAnsi`, `w:cs`).
  - **Bảng in 18 cột (Table 1)**:
    + Cột 0 (STT): Header và Data row đều căn giữa (`center`), cỡ chữ 6.5pt (`sz="13"`, `szCs="13"`), font `Times New Roman`.
    + 17 cột còn lại: Cỡ chữ 6.5pt (`sz="13"`), Header bold, Data regular, font `Times New Roman`. Loại bỏ hoàn toàn `sz="4"` ở `pPr/rPr`.
  - **Bảng chữ ký (Table 2)**: Tiêu đề chức danh 12pt (`sz="24"`, bold), dòng ghi chú 10pt (`sz="20"`), vùng `DOCVARIABLE` 12pt (`sz="24"`), căn giữa toàn bộ, font `Times New Roman`.
  - **Thông tin đơn hàng (Table 0 và các đoạn văn)**: Toàn bộ nhãn và MERGEFIELD đồng bộ cỡ chữ 12pt (`sz="24"`), font `Times New Roman`. Tiêu đề "ĐỀ NGHỊ ĐẶT HÀNG" 16pt (`sz="32"`, bold, center).
  - **Danh sách số thứ tự tự động (STT đầu các dòng: Thương hiệu, Màu sắc, Yêu cầu, Dán tem... trong `word/numbering.xml`)**:
    + **Vấn đề**: File `word/numbering.xml` định nghĩa các cấp `lvl 0` trong `abstractNum 0` và `1` có font `<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>` và cỡ chữ `<w:sz w:val="18"/>` (9 pt). Khi Word/eWriter render số tự động `1.`, `2.`, `3.`, `4.` trước các dòng "Thương hiệu:", "Màu sắc:", "Yêu cầu:", "Dán tem...", các số này bị hiển thị bằng font Arial 9pt bé tí và lệch font hoàn toàn so với nội dung văn bản 12pt Times New Roman bên cạnh.
    + **Xử lý**: Chuẩn hóa toàn bộ các level trong `word/numbering.xml` sang font **`Times New Roman`** (đầy đủ `ascii`, `hAnsi`, `cs`, `eastAsia`) và cỡ chữ **12 pt** (`sz="24"`, `szCs="24"`), đảm bảo các số thứ tự tự động `1.`, `2.`, `3.`, `4.`... hiển thị cùng font và kích thước chuẩn 12pt đồng nhất với toàn bộ tài liệu.
- **Kết quả nghiệm thu**:
  - Đã upload thành công 4 file DOCX lên server eWriter sandbox qua `scratch/upload_filtered_ewriter.js`.
  - Chạy kiểm tra Preview E2E (`scratch/test_all_prprint_preview.js` & `scratch/fetch_previews.js`): Cả 4 tài liệu render đủ 18/18 cột dữ liệu.
  - Phân tích XML từ file preview server trả về: Xác nhận 100% các run trong văn bản và 100% các level số tự động trong `numbering.xml` đều đạt chuẩn **`Times New Roman`** cỡ **12 pt**, STT trước các dòng Thương hiệu, Màu sắc, Yêu cầu, Dán tem... đã đồng nhất font chữ hoàn toàn.

### 2.26. Khắc phục lỗi Dữ liệu hợp lệ không submit được & Table không fill dữ liệu vào eWriter:
- **Hiện tượng**:
  1. Dữ liệu bảng PR đã nhập đầy đủ, hợp lệ (badge xanh "Dữ liệu hợp lệ") nhưng bấm Gửi/Submit vẫn bị chặn không gửi được.
  2. Khi xem / in bản eWriter, bảng vật tư 18 cột bị rỗng hoàn toàn, không có dòng dữ liệu nào.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Form có trường ẩn bắt buộc: `00007163IlBSv858DO8MhVdJx_textField-12` (`Trạng thái bảng hạng mục (hệ thống)`), cấu hình `"validate": { "required": true }`. Trường này CHỈ mở cho submit khi được gán giá trị `"OK"`.
  - eWriter đọc dữ liệu bảng 18 cột từ trường ẩn `00007163IlBSv858DO8MhVdJx_table_advance-4`.
  - Trước đây, trong nỗ lực để custom widget `table_advance-3` tự quản lý guard, hàm `validateGuard()` và `onChange()` trong `code/main.js` của 13 form (gồm toàn bộ các form Start, Update và View) đã bị sửa thành `/* no-op */` và bị gỡ bỏ `bindFieldChangeEvent(TABLE_3, onChange)`.
  - Tuy nhiên, trong runtime Kyta Form Runner, custom widget chạy trong ngữ cảnh cô lập, không thể gọi trực tiếp API `changeFieldValue` nội bộ của Kyta Form Runner.
  - Hậu quả: `textField-12` không bao giờ được gán `"OK"` $\rightarrow$ Kyta chặn submit vì thiếu trường required; đồng thời `syncPrintTable()` không bao giờ được gọi $\rightarrow$ `table_advance-4` luôn rỗng $\rightarrow$ eWriter không có dòng nào!
- **Giải pháp Kiến trúc 2 Lớp (Dual-Layer Architecture)**:
  1. **Lớp 1: Khôi phục và nâng cấp `code/main.js` trên toàn bộ 23 Form PR**:
     - `onChange()` được khôi phục đầy đủ: gọi `overviewMau()`, `validateGuard()`, `syncPrintTable()`.
     - `dataRows()` ưu tiên lấy dữ liệu tức thời từ `window.__PR_TABLE_DATA` do widget phơi ra, fallback về `getFieldValue(TABLE_3)` và `TABLE_1`.
     - `validateGuard()`: Đọc cờ `window.__PR_TABLE_OK` do widget tính (hoặc fallback đếm ô required), kết hợp với `!isRevisionReasonMissing()` trên các form duyệt có revision. Khi hợp lệ $\rightarrow$ gán `changeFieldValue(GUARD, "OK")`.
     - `syncPrintTable()`: Trích xuất các dòng, ánh xạ chuẩn 18 cột `PRINT_COLS`, gán `changeFieldValue(PRINT_TABLE, printRows)`.
     - Đăng ký lắng nghe sự kiện: `bindFieldChangeEvent(TABLE_3, onChange)`, `bindFieldChangeEvent(TABLE_1, onChange)` (và `REVISION_TABLE`, `REVISION_ACTION` trên form duyệt).
     - Phơi callback toàn cục: `window.__prTableChanged = function(tableOk) { ... onChange(); }` trên cả `window`, `window.parent`, `window.top`.
  2. **Lớp 2: Tăng cường Custom Widget `table_advance-3` (`scratch/subF_table_js.js`)**:
     - Trong `pushValue()`: Phơi cờ `window.__PR_TABLE_OK = tableOk` và `window.__PR_TABLE_DATA = data` lên toàn bộ ngữ cảnh `[window, window.parent, window.top]`.
     - Gọi callback `__prTableChanged(tableOk)` để form cha kích hoạt `onChange()` ngay lập tức.
     - Bổ sung fallback DOM injection: Tự động tìm các thẻ `input[id*="textField-12"]` trong DOM và gán `value = tableOk ? "OK" : ""` kèm dispatch event `input`/`change`.
     - Gọi `safeCfv` hỗ trợ cả 2 định dạng token `{fieldId}` và `{{fieldId}}` cho `hiddenId`, `printId`, `mauId`, `guardId`.
- **Triển khai & Nghiệm thu**:
  - Script thực thi tự động: `scratch/execute_dual_layer_fix.js`.
  - Đã nạp `code/main.js` và cập nhật widget `table_advance-3` trên toàn bộ 23 form (1 subform + 22 form cha).
  - Toàn bộ 23 form đã được Re-release thành công (`statusForm: 2`).
  - Kiểm thử Preview eWriter E2E (`node scratch/test_all_prprint_preview.js`): Cả 4 tài liệu render đủ 18/18 cột chuẩn xác 100%.

### 2.27. Khắc phục lỗi Bảng "Chi tiết đặt hàng" ĐHTP (`table_advance-1`) chỉ lưu 3 cột đầu tiên khi submit:
- **Hiện tượng**: Ở form `eF_5_KYTA_Đơn hàng thành phẩm_Start`, người dùng nhập đầy đủ dữ liệu cho cả 19 cột nhưng khi submit form chỉ lưu 3 cột đầu tiên (`Mã material`, `Tên cửa`, `ĐVT`), các cột từ index 3 đến 18 (`RequestedDeliveryDate`, `Z_KY_HIEU`, ...) bị lưu thành chuỗi rỗng `""`. Khi chuyển sang các form duyệt kế thừa (`CHT`, `GDDA`, ...), bảng cũng chỉ hiển thị 3 cột này.
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. Trong cấu hình `fields.json` của `subF_5__KYTA_SD_04` và cả 9 form cha ĐHTP, `tableAdvanceConfig.column_value` của trường `k8o3zblp3` (`table_advance-1`) chỉ khai báo đúng 3 cột dummy: `[{"type": "text", "title": " "}, {"type": "text", "title": " "}, {"type": "text", "title": " "}]`. Backend Kyta khi serialize dữ liệu form lưu xuống database đã căn cứ vào schema này và truncate toàn bộ dữ liệu từ cột thứ 4 trở đi.
  2. Trong `ui/table_advance-1/script.js`, `syncManifest()` trước đó được gọi ở cuối quá trình khởi động sau `render()`, và sự kiện `blur`/submit chưa kích hoạt `pushValue()` đồng bộ ngay lập tức trước khi form gửi request submit.
- **Giải pháp**:
  1. **Cập nhật `fields.json` đủ 19 cột**: Khai báo toàn bộ 19 cột chuẩn theo đúng định dạng `COLUMN_TITLES` vào `column_value` của `tableAdvanceConfig`, đặt `dataCell_value: []` trên cả 10 form (1 subform + 9 form cha).
  2. **Tối ưu vòng đời `script.js`**:
     - Đặt `syncManifest()` ngay đầu quá trình `mount()` trước khi đọc và khởi tạo dữ liệu.
     - Thêm `pushValue()` vào `onBlur()`.
     - Bổ sung `hookSubmitClick()` bắt sự kiện click/submit của form ở parent/top window để đảm bảo `pushValue()` luôn được gọi trước khi dữ liệu form được submit.
     - Phơi dữ liệu bảng `window.__DHTP_TABLE_DATA` an toàn xuyên ngữ cảnh window/iframe.
  3. **Đồng bộ và đẩy server**: Đẩy thành công cả 10 form lên BMW Sandbox qua `kyta eform push --force` và kiểm tra `diff` đạt 0 khác biệt.

### 2.28. Đồng bộ `subF_10_HĐmua` mới và gỡ luật điều kiện ẩn trường ở `subF_10_HĐmua ký kết`:
- **Nhu cầu 1 (`subF_10_HĐmua`)**:
  - Người dùng cập nhật `subF_10_HĐmua` trên server (thêm khối "Tra cứu giao dịch liên quan Yêu cầu mua hàng" và các trường thông tin HĐ mới: `textField-26..31`, `dropdown-12..14`, `datepicker-5`, `table_advance-4`, `buttonElement-1,2`).
  - Cần kéo subform về local và đồng bộ (`childform refresh`) vào toàn bộ 24 form cha của 2 luồng: `SP.04 HĐ mua (BCH + Khối sản xuất)` (12 form) và `SP.05 HĐ mua (Phòng ban)` (12 form).
  - Tái tạo mảng biến workflow (`tools/regen_variable_arr.js`) cho cả 24 form cha để luồng quy trình nhận diện toàn bộ các trường mới.
  - Cập nhật danh sách khóa trường `LOCKED_SUBFORM_FIELDS` và ẩn nút tìm kiếm PR trên 18 form duyệt của SP.04 và SP.05 trong `code/main.js`.
- **Nhu cầu 2 (`subF_10_HĐmua ký kết` - Chọn người duyệt)**:
  - Form này là form pick người thực hiện (24 trường: 7 vai trò duyệt x text/tên/email + splitter + projectId).
  - Khi mở form, các dropdown từ vai trò 4 đến 7 (Kế toán và Pháp chế) bị ẩn hoàn toàn, chỉ hiển thị "Họ tên CHT thực hiện" và BP Kế hoạch.
  - **Nguyên nhân**: Tồn tại 2 luật điều kiện rác (`ZYBa8utc`, `eP9rybCg`) từ form HĐ cũ cấu hình trên `dropdown-1` so sánh "Theo mẫu" / "Không theo mẫu" để `hide_multiple` các dropdown `dropdown-4..7` và email `textField-4..7`.
  - **Giải pháp**: Xóa bỏ hoàn toàn 2 luật điều kiện rác qua `kyta eform condition remove`. Kéo lại `subF_10_HĐmua ký kết` về local, đảm bảo tất cả 7 vai trò hiển thị đầy đủ 100%.

---

## 3. Hướng dẫn tài liệu & Quy trình liên quan

1. **`docs/playbooks.md`** (file này): Bản đồ và toàn bộ lịch sử kỹ thuật 26 mục hoàn chỉnh.
2. **`docs/ewriter-eform-integration-playbook.md`**: Quy trình làm việc với eWriter template, đồng bộ biến form sang bản in.
3. **`docs/bmw-business.md`**: Tổng quan nghiệp vụ các luồng eForm BMW.
4. **`docs/eform-subform-sync-playbook.md`**: Quy trình đồng bộ Subform sang các form cha.
5. **Script cập nhật & kiểm thử**:
   - `node scratch/execute_dual_layer_fix.js`: Đồng bộ Dual-Layer Guard & eWriter cho 23 form.
   - `node scratch/test_all_prprint_preview.js`: Kiểm thử render preview 4 tài liệu eWriter.

---

## 4. Hướng dẫn cách mở Session mới hiệu quả nhất

Khi bắt đầu session mới, bạn chỉ cần gõ prompt ngắn gọn:

> **"Đọc file `docs/playbooks.md` để nắm toàn bộ context của các form PR BMW và tiếp tục công việc nhé."**

