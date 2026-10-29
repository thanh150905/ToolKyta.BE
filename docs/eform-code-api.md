# eForm — kho hàm dựng sẵn của code động (runtime API)

Các hàm này do **runtime code editor của eForm** cung cấp sẵn (không cần import) khi viết `code/*.js`.

**Chữ ký dưới đây lấy trực tiếp từ panel "Functional" trong code editor** (eform sandbox, 2026-09-27) — là
nguồn chính thức, không phải suy đoán. Cột "gọi" là tần suất trong 732 file `code/` đã pull (mức độ dùng thực tế).

`fieldId` truyền dạng token `"{{<formId>_<key>}}"` (hoặc biến giữ token).

## Get Data Field

| Hàm | Chữ ký | Việc | Gọi |
|---|---|---|---|
| `getFieldValue` | `(fieldId: string) => any` | Đọc giá trị field. Bảng → mảng dòng (mảng 2 chiều). | 7057× |
| `getFieldInfo` | `(fieldId: string) => any` | Lấy metadata field (cấu trúc/cột bảng...). | 97× |

## Set Data Field

| Hàm | Chữ ký | Việc | Gọi |
|---|---|---|---|
| `changeFieldValue` | `(fieldId: string, newValue: any) => void` | Ghi giá trị field. | 6293× |
| `changeFieldValueRadio` | `(fieldId: string, newValue: any) => void` | Ghi giá trị radio. | 40× |
| `setDisplayField` | `(fieldId: any, value: boolean) => void` | Hiện/ẩn field. | 88× |
| `setReadonlyField` | `(fieldId: any, value: boolean) => void` | Bật/tắt chỉ đọc. | 39× |
| `changeFieldProp` | `(fieldId: any, pathKey: string, value: any) => void` | Đổi 1 property field lúc chạy (theo `pathKey`). | 30× |

## Event Trigger

| Hàm | Chữ ký | Gọi |
|---|---|---|
| `bindFieldChangeEvent` | `(fieldId: any, callback: (value: any) => void) => void` | 3440× |
| `bindFieldAction` | `(type, fieldId: string, callback: (data: any) => void) => void` | 342× |
| `setLoadingPage` | `(isLoading: boolean) => void` | 57× |
| `addRowTable` | `(fieldId: string, numberOfRows: number) => void` | 46× |
| `deleteRowTable` | `(fieldId: string, rowIndexes: number[]) => void` | 537× |
| `addTableAdvanceColumns` | `(fieldId: string, insertColumnIndex: number, numberOfColumns: number) => void` | — |
| `removeTableAdvanceColumns` | `(fieldId: string, startColumnIndex: number, numberOfColumns?: number) => void` | — |
| `openModal` | `(data: DataModal) => void` | 18× |

`bindFieldAction` — `type` (chuỗi) là một trong:
`"onInitData" | "onclick" | "onblur" | "onfocus" | "ondbclick" | "mouseover" | "mouseout" | "addRowTable" |
"deleteRowTable" | "addTableAdvanceColumns" | "removeTableAdvanceColumns" | "uploadSpreadsheetFile" |
"deleteFileUpload" | "fileUploaded" | "uploadOCR"`.

## Style HTML

| Hàm | Chữ ký | Việc |
|---|---|---|
| `setStyle` | `(fieldId: string, value: StyleConfig) => void` | Áp style cho field. |

## Ngoài panel Functional

- `showToast(message, type)` — **dùng nhiều (209×) nhưng KHÔNG có trong panel Functional** → có sẵn ở runtime nhưng không tài liệu hoá chính thức; dùng được nhưng coi là ngoài luồng chuẩn.
- Có sẵn từ môi trường (không phải API eForm): `fetch` (260×, gọi HTTP từ code động), `moment` (27×), `setTimeout/setInterval/clearTimeout/clearInterval`, `CustomEvent`, `alert`, `btoa`, `console`, chuẩn JS.

## Kiểu tham chiếu (chưa có định nghĩa chi tiết)

`DataModal` (tham số `openModal`) và `StyleConfig` (tham số `setStyle`): **[Unverified]** cấu trúc — cần mở
mẫu dùng thật hoặc đọc thêm trong editor để tài liệu hoá.

> Nguồn: panel "Functional" của code editor (tab bên phải màn hình soạn code), URL dạng
> `.../template/<formId>`. Có thêm tab "Variables" (biến của form) chưa trích ở đây.

Khi viết code động, đọc file này trước để dùng đúng tên/chữ ký thay vì đoán.
