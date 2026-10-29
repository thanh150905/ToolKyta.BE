# eCatalog (eCategory) — schema & API

Nguồn: cào request thật trên `saigoncoop/sandbox` (Claude in Chrome, phiên login user), 2026-09-28.
Nguyên tắc: **chỉ ghi cái đã verify**. Mục chưa gọi thật đánh dấu `[Unverified]`.

## Host & service prefix

- **Host**: `ecatalog.sandbox.kytaplatform.com` — suy từ `eform.x → ecatalog.x` (giống eflow/ewriter/eaccount).
- **Service prefix**: `/services/ecategory/api` — ⚠️ tên service là **ecategory**, KHÁC tên host (ecatalog). Entity gọi là **category** (không phải "catalogue"/"catalog").
- Auth: cookie SSO same-origin (idaas), dùng chung token eaccount như các phân hệ khác.
- Service phụ dùng kèm: `/services/uaa/api/*` (menu, account, tra user/role).

## Mô hình dữ liệu

1 **category** (danh mục) = 1 object chứa TẤT CẢ cấu hình (giống eform gói mọi thứ trong form object):

| Nhóm | Field trong category | Ý nghĩa |
|---|---|---|
| Thông tin | `id`, `name`, `code`, `description` | Tên/mã/mô tả. `id` = Mongo ObjectId 24 hex |
| Trạng thái | `status`, `applicableStatus`, `applicableDate` | `status` hoạt động; `applicableStatus` áp dụng; ngày áp dụng ISO |
| **Field (màn config)** | `struct`, `structTree` | Định nghĩa field — xem dưới |
| **Cấu hình hiển thị** | `actionConfig`, `tableConfig`, `searchConfig`, `filterConfig` | Xem dưới |
| Audit/tenant | `createdBy/Date`, `lastModifiedBy/Date`, `custId`, `userId`, `orgIn`, `type`, `avatar`, `fullName` | `orgIn` dạng `/8822/17642` (SGC) |

### `struct` — field của danh mục (dùng lại schema eform)

- `struct` là **chuỗi JSON** (double-encoded như `jsonForm` của eform) = mảng field.
- `structTree` = cùng nội dung dạng cây/đã parse (layout). `struct` là danh sách field phẳng, coi là nguồn chuẩn.
- Mỗi field **đúng schema field của eForm** — ví dụ đã verify (textField):

```json
{
  "type": "textField", "label": "Họ và Tên", "code": "", "placeholder": "",
  "inputType": "text", "value": "", "labelPosition": "above", "tooltip": "",
  "textTransform": "none", "description": "", "display": true, "readonly": false,
  "spellCheck": false,
  "validate": { "minLength": "", "maxLength": "", "regex": "", "messErrorForRegex": "",
                "listSelectedRegex_value": [], "required": false, "unique": false },
  "formula": { "expression_value": [] }, "extractCLMInfo": false,
  "id": "textField_input-1", "renderMode": "builtin",
  "customRenderCode": { "html": "", "css": "", "js": "", "version": 1 },
  "allowRecord": "", "slug": ""
}
```

- `id` field (vd `textField_input-1`, `textField_email-7`) = **khoá bền** để các config trỏ tới (giống `key` trong eform).
- Theo mô tả nghiệp vụ: màn config chủ yếu dùng `textField` (chỉ đặt tên). Nhưng schema đủ chỗ cho mọi loại field eform → **tái dùng được `src/eform/fields.js`**.
- `validate.unique` = field làm khoá duy nhất của bản ghi dữ liệu (đặc thù catalog).

### Cấu hình hiển thị — 4 mảng

Mỗi entry: `{ data, key, name, active, type, code, description }`.

- **`actionConfig`** — nút thao tác, 7 key CỐ ĐỊNH: `search`, `added`, `view`, `edit`, `delete`, `duplicate`, `export`. `active` bật/tắt nút. `name` = nhãn.
- **`tableConfig`** — cột bảng danh sách. Mỗi entry `key` = `id` của 1 field trong `struct`, `active=true` → hiện cột. **Bắt buộc cấu hình để catalog hiện dữ liệu.**
- **`searchConfig`** — field cho ô tìm kiếm (mirror struct, `active` chọn field).
- **`filterConfig`** — field cho bộ lọc (mirror struct).

## Endpoints — ĐÃ VERIFY (read)

| Method | Path | Việc |
|---|---|---|
| GET | `/categories?page=&size=&search=&sort=status,desc&sort=created_date,desc` | Danh sách category → **trả mảng thẳng** (không bọc content/data) |
| GET | `/categories?page=0&size=10000&search=&sort=created_date,asc` | Biến thể lấy toàn bộ (sidebar) |
| GET | `/categories/{id}` | 1 category đầy đủ (full config) |
| GET | `/data/{categoryId}?page=&size=&search=&sort=created_date,desc` | Danh sách **bản ghi dữ liệu** → mảng thẳng |

### Bản ghi dữ liệu (`/data/{categoryId}`)

Object **phẳng**, khoá = `id` field trong struct, kèm meta:

```json
{
  "id": "6a8e9266d3fe8b565e5d5c98", "categoryId": "6a218240be1f055f619113d8",
  "textField_input-1": "TEST_FPT_01", "textField_email-7": "ladalep254@archifun.com",
  "textField_sinthoi-8": "0222222222", "textField_input-2": "TEST_Ban điều hành",
  "textField_input-3": "TEST",
  "org_in": "/8822/17642", "user_id": 175958,
  "created_by": "...", "created_date": "...", "last_modified_by": "...", "last_modified_date": "..."
}
```

## Endpoints — ĐÃ VERIFY (write)

Cào bằng round-trip thật trên saigoncoop/sandbox (tạo category nháp, thao tác, xoá sạch), 2026-09-28.
Route UI: list `/catalogue-config/manage`, config field `/catalogue-config/manage/properties/{id}`, data `/catalogue-config/detail/{id}`.

### Category

| Method | Path | Body | Kết quả |
|---|---|---|---|
| POST | `/categories` | `{name, code, description, status}` — tối thiểu; nhận thêm `struct/structTree/tableConfig/...` (full object) | **201** + object đầy đủ (id sinh) |
| PUT | `/categories/edit` | full object (struct đã sửa) | **200** — lưu **CHỈ `struct`/field** (fields). **Bỏ qua thay đổi info/config trong body.** |
| PUT | `/categories` | full object | **200** — lưu **CHỈ config nghiệp vụ**: `name/code/description/status/applicableStatus` + `active` của `tableConfig/searchConfig/filterConfig/actionConfig`. **Bỏ qua thay đổi `struct` trong body.** |
| DELETE | `/categories/{id}` | — | **204**, xoá cứng (GET sau → 404) |

**Hai endpoint tách bạch nhiệm vụ (đã verify round-trip):**
- `/edit` = **fields**. Sau `/edit`, server **re-derive** tableConfig/searchConfig/filterConfig từ struct: 1 entry/field, **`active` reset về false** (kể cả entry đang true trước đó → **`/edit` xoá sạch cấu hình hiển thị**). Field mới thêm cũng có mặt trong 3 mảng với active=false.
- `/categories` = **config**. Tôn trọng `active` gửi lên (bật/tắt cột bảng danh sách, field tìm kiếm, field lọc) và `applicableStatus` (áp dụng/ngừng). Bỏ qua struct.
- ⇒ **Quy trình đúng:** đổi field bằng `/edit` TRƯỚC, rồi set lại `active` bằng `/categories` SAU (vì `/edit` vừa reset). Tool tự làm bước khôi phục active này.
- UI: gear ▸ menu **Cấu hình thao tác / bảng danh sách / tìm kiếm**. Modal "bảng danh sách" = multiselect field (options lấy từ tableConfig sau khi field đã lưu) → Lưu = `PUT /categories`.

- **Clone category** = `POST /categories` với **full object nguồn** (đổi `code`); POST /categories lưu cả `struct/tableConfig` khi gửi kèm (đã verify). Không có endpoint clone riêng.
- ⚠️ **`struct` = chuỗi JSON, `structTree` = ARRAY thật (không stringify)** — gửi structTree dạng chuỗi → 400 "Cannot deserialize ArrayList ... out of VALUE_STRING".

### Bản ghi dữ liệu (data record)

| Method | Path | Body | Kết quả |
|---|---|---|---|
| GET | `/data/{categoryId}?page&size&search&sort` | — | mảng bản ghi (list đơn giản) |
| POST | `/data/{categoryId}` | object filter (vd `{fieldId:[values]}`) | mảng — **LIST/SEARCH có lọc**, KHÔNG phải create |
| POST | `/data/field-data` | phẳng `{categoryId, fieldId:value, ...}` (KHÔNG có id) | **200** + record đầy đủ (id, org_in, user_id, meta) — **tạo** |
| PUT | `/data/field-data` | full record (có `id`) | **200** + record mới — **sửa** |
| DELETE | `/data/field-data/{recordId}` | — | **204** — **xoá 1** |
| DELETE | `/data/field-data/list?ids=A&ids=B&...` | — (id lặp trên query) | **204** — **xoá nhiều/tất cả** (dùng cho "xoá đã chọn" & "xoá toàn bộ") |

- **Clone bản ghi** = `POST /data/field-data` với field values của record nguồn (bỏ `id`) → tạo bản ghi mới (suy từ create đã verify).
- ⚠️ **Thứ tự khởi tạo:** `POST /data/field-data` chỉ chạy sau khi category đã qua `PUT /categories/edit` với **struct KHÔNG rỗng** (tức đã có ≥1 field). `PUT /edit` với struct rỗng → **500**; thêm bản ghi khi category chưa có field cũng **500**. ⇒ Luồng đúng: `cat create` (rỗng) → `field add` (bước này tự /edit, khởi tạo) → `data add`.

### CHƯA VERIFY (còn lại cho pha write)
- **Import excel** (`Import dữ liệu`): multipart — path & body chưa cào (cần file).
- **Export excel** (`Xuất dữ liệu`): endpoint tải file — chưa cào (tránh tải file khi cào).
- Cách lưu `actionConfig.active` (menu "Cấu hình thao tác") — suy là `PUT /categories` như bảng/tìm kiếm nhưng chưa cào riêng.

**Nguyên tắc cào write:** app dùng `fetch` qua tham chiếu giữ sẵn → **recorder inject-sau-load KHÔNG bắt được request app**. Lấy verb+URL từ CDP network; lấy body bằng round-trip thật (probe → 2xx + đổi state), dọn sạch data test sau khi cào.
