# eForm — thư viện node mẫu (field templates)

Mỗi file `.json` là **một node field thật** lấy từ form trên server (saigoncoop/bmw sandbox, cào 2026-09-27),
đã bỏ `components`/`customRenderCode` (đánh dấu `_hasCustomUI: true` nếu field vốn có custom UI).
Dùng làm **khuôn để thêm field mới / dựng form mới**: copy node, đổi phần *danh tính* + *cấu hình*, chèn vào `jsonForm`.

## Phần danh tính (đổi cho mỗi field mới) vs cấu hình

- `id` = `"<formId>_<type>-<n>"` — phải khớp form đích và **duy nhất** trong form.
- `hashid` — chuỗi ngẫu nhiên, **duy nhất** trong form.
- `type` — không đổi (quyết định loại field).
- Còn lại (`label`, `value`, `validate`, `display`, `readonly`, `*Config`, `formula`...) = cấu hình, sửa tự do.

## Danh mục mẫu

| File | Loại field |
|---|---|
| `textField.json` | Ô nhập text (giàu key nhất — 23) |
| `textField_ticketName.json` | Text gắn tên ticket |
| `number.json` | Số (có `currency`, `validate.decimalPlace`) |
| `phone_number.json` | Số điện thoại |
| `textArea.json` | Vùng văn bản nhiều dòng |
| `datepicker.json` | Chọn ngày (`validate.formatDate/minDate/maxDate`) |
| `dropdown.json` / `dropdown.manual.json` | Dropdown nhập tay (`value = 1`) |
| `dropdown.datasource.json` | Dropdown eCatalog (`value = 4`) — xem "4 kiểu nguồn" |
| `dropdown.api.json` | Dropdown gọi API HTTP (`value = 3`) — xem "4 kiểu nguồn" |
| `radio_button.json` | Radio |
| `upload_file.json` / `upload_img.json` | Tải tệp / ảnh |
| `signature.json` | Chữ ký |
| `table_advance.json` | Bảng động (`tableAdvanceConfig`) |
| `rich_text_advance.json` | Soạn thảo rich text |
| `view_ewriter.json` | Nhúng bản in eWriter |
| `check_box.json` | Checkbox (`checkBoxConfig`) |
| `email.json` | Email (`textField` với type=email, `validate.regex`) |
| `buttonElement.json` | Nút bấm (`buttonElementConfig`, `textPosition`) |
| `child_form.json` | Nhúng form con (`childFormConfig`) |
| `numbered_list.json` | Danh sách đánh số / bullet |
| `divider.json` | Đường phân cách |
| `record_audio.json` | Ghi âm |
| `columns.json` / `row.json` / `splitter.json` | Container bố cục (xem trên) |
| `h1/h2/h3.json`, `text.json` | Tiêu đề / nội dung (sửa `value`) |
| `*.with-formula.json` | Biến thể có công thức tự tính |

> Nguồn mẫu: saigoncoop/bmw/yusen/thads sandbox (cào 2026-09-27).

## Container & bố cục (layout)

Bố cục là **`components` lồng nhau**. Field cạnh nhau = anh em trong `components` của một `columns`.

```
row (width:100%)            khối full-width, xếp dọc các con
columns                     các con NẰM NGANG (mỗi con 1 cột, tự chia đều)
splitter (display:false)    nhóm ẩN — end-user không thấy các field bên trong
page                        gốc mỗi trang
```

Lệnh thao tác bố cục (đều PUT `/owner/form`, có `--dry-run`):

| Lệnh | Case |
|---|---|
| `field group k1,k2,k3 --as columns` | 3 input rời → 3 cột nằm ngang |
| `field group k1,k2 --as splitter --hidden` | gom trường hệ thống vào nhóm ẩn |
| `field move <key> --into <container>` | chuyển field vào columns/row/splitter/page |
| `field add columns\|row\|splitter [--hidden]` | tạo container rỗng |
| `field set <splitter-key> --display false` | ẩn nguyên một nhóm sẵn có |

`columns`/`row` là container bố cục thuần → **không** nằm trong `fields.json` (nhưng `splitter` có, vì cần bật/tắt `display`). Sau `group`/`move`, `fields.json` được dựng lại từ server.

## Palette designer (nhãn UI → loại) — nguồn: editor 2026-09-27

- **Layout**: Row, Column, Step, Tab, Splitter, Divider
- **Basic**: Text (`text`), Heading 1/2/3 (`h1/h2/h3`), Bulleted list (`numbered_list`), Button (`buttonElement`), Multiline text (`textArea`)
- **Basic input**: Input text (`textField`), Multiline text (`textArea`), Number (`number`), Password, Email (`email`),
  Phone number (`phone_number`), Radio button (`radio_button`), Checkbox (`check_box`), Checkbox Advance, Dropdown (`dropdown`), Date Picker (`datepicker`)
- **Advances**: Table view / Table input (`table_advance`), Upload file (`upload_file`), Upload image (`upload_img`),
  Hyperlink, Form (`child_form`), Signature (`signature`), Divider (`divider`)
- **Erequest**: Ticket name (`textField_ticketName`)
- **Premium**: OCR Document, Rich Editor / Editor Advance (`rich_text_advance`), THADS number, Currency complex,
  Cycle time complex, QR code, Preview Document (`view_ewriter`), Record Audio (`record_audio`), Calendar

> **Còn thiếu node mẫu** (chưa gặp trong form của các khách đã cào): Step, Tab, Password, Checkbox Advance,
> Hyperlink, OCR Document, THADS number, Currency complex, Cycle time complex, QR code, Calendar. Cần kéo mỗi loại
> vào một form trên designer rồi pull về để bổ sung trước khi dựng từ đầu. Password/OCR... nhiều khả năng là
> biến thể `inputType`/config của type sẵn có — **[Unverified]**.

## `formula` — công thức tự tính

`formula.expression_value` là **mảng token** đọc tuần tự, mỗi token `{ type, value }`:

| `type` | `value` là gì |
|---|---|
| `func` | Tên hàm: `concatenate`, `days`, ... |
| `variable` | Field nguồn, dạng `"<formId>_<key>"` |
| `text` | Chuỗi hằng |
| `number` | Số **hoặc** dấu cú pháp `(` `)` `,` (dùng làm phân tách/ngoặc) |

Ví dụ `concatenate( textField-26 , " " , textField-27 )` → xem `textField.with-formula.json`.
> `[Unverified]` danh mục đầy đủ hàm formula (ngoài `concatenate`, `days`) — bổ sung khi gặp mẫu mới.

## Dropdown — 4 kiểu nguồn dữ liệu (`dropdownConfig.typeGetData_value.value`)

| value | Kiểu | `data` | Template |
|---|---|---|---|
| `1` | **Nhập tay** | mảng `[{ id?, label, value }]` | `dropdown.manual.json` |
| `4` | **eCatalog** (nguồn dữ liệu nội bộ) | object (dưới) | `dropdown.datasource.json` |
| `3` | **API** (gọi HTTP ngoài) | object (dưới) | `dropdown.api.json` |

### Kiểu 4 — eCatalog (`dropdownConfig.data`)

| Khoá | Việc |
|---|---|
| `url` | **ID catalog** (không phải URL http), vd `"68d2573630dcb2365ae4325d"` |
| `field_value` | Cột lấy giá trị: `{ label, value: "<key cột nguồn>" }` |
| `fieldDisplay_value` | Mảng cột hiển thị `[{ label, value }]` |
| `conditionFilter` | Lọc catalog theo field trong form (dưới) |
| `feedData` | Khi chọn option → đổ dữ liệu sang field khác (dưới) |
| `charSeparator`, `isGetAllCatalogData`, `isDefaultSelectFirstItem` | Tuỳ chọn |

### Kiểu 3 — API (`dropdownConfig.data`), gọi HTTP rồi map kết quả

| Khoá | Việc |
|---|---|
| `url` | Endpoint. Tiền tố `$KytaSystem ` = gọi service nội bộ, vd `"$KytaSystem services/uaa/api/account-eaccount"` |
| `path` / `method` / `header` `[{key,value}]` / `payload` | Tham số request (method `get`/`post`...) |
| `responseTemplate` | Khai schema kết quả (chuỗi kiểu TS) để map trường |
| `field_value` / `fieldDisplay_value` | Trường lấy giá trị / hiển thị (từ response) |
| `timeCache` | Cache (giây) |
| `conditionFilter` / `feedData` | Như eCatalog |

### `conditionFilter[]` (lọc) — mỗi phần tử

```json
{ "type": "variable",
  "field":          { "label": "Phân loại", "value": "<key cột nguồn>" },
  "operator":       { "label": "=", "value": "in" },
  "conditionInput": { "label": "phân loại", "value": "<formId>_textField-20" } }
```
→ lọc nguồn theo: `cột nguồn <operator> giá trị field trong form`.

### `feedData[]` (đổ ngược sang field khác khi chọn) — mỗi phần tử

```json
{ "field":     { "label": "GCN số", "value": "<key cột nguồn>" },
  "elementId": { "label": "Giấy CN", "value": "<formId>_textField-7" } }
```
→ lấy giá trị `cột nguồn` đổ vào field `elementId` trong form.

Xem thêm: [../eform-fields-schema.md](../eform-fields-schema.md) (schema tổng quát) ·
[../eform-code-api.md](../eform-code-api.md) (hàm code động để bù logic).
