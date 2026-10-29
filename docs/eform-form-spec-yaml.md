# eForm — chuẩn đặc tả form (`spec.yaml`)

Nguồn **canonical** để generate 1 form eForm. Quy ước cho BMW (và mọi khách): **1 file `spec.yaml` / form**, commit
ngay trong thư mục form: `workspace/<customer>/<env>/eform/<form>/spec.yaml`.

**Vòng đời**: BA điền phiếu [eform-form-spec-template.xlsx](eform-form-spec-template.xlsx) (dễ điền tay) → tôi convert
sang `spec.yaml` này (diff/review được trong PR) → **bạn tạo form vỏ rỗng trên designer, dán `formId` vào `meta.formId`**
→ tôi dựng field + bố cục + điều kiện + code động từ `spec.yaml`, push lên vỏ đó.

> Vì sao YAML là source of truth (không phải xlsx): text → git diff từng dòng, review trong PR, tôi parse tất định
> không phải giải nén binary. xlsx chỉ là **phiếu thu thập** đầu vào.

Schema dưới đây map **1:1** với primitive của tool: field ↔ `field add` + [node-templates](eform-node-templates/),
bố cục ↔ `field group/move`, `conditions` ↔ `jsonFormCondition` (lệnh `condition`), `logic` ↔ `code/*.js`
([hàm runtime](eform-code-api.md)). Type/config chi tiết: [eform-fields-schema.md](eform-fields-schema.md).

---

## 1. Khối `meta` — thông tin form

```yaml
meta:
  formName: "eF_4 BOQ nội bộ — Khởi tạo"   # tên hiển thị
  formCode: "eF4_BOQ_NB_start"             # mã form, duy nhất trong customer
  describe: "Bảng khối lượng BOQ nội bộ, bước khởi tạo bởi CVKH"
  customer: bmw
  env: sandbox
  formId: ""            # ĐỂ TRỐNG → điền sau khi tạo vỏ tay trên designer
  tag: ""               # chuỗi, phân tách bằng dấu phẩy nếu nhiều tag
```

`formId` trống = tôi **chưa** push được (không có vỏ). Điền xong mới generate.

---

## 2. Khối `layout` — field + bố cục, theo thứ tự hiển thị

Danh sách **có thứ tự**. Mỗi phần tử là **block** (nhóm). Trong block: field đứng riêng 1 dòng, hoặc gói trong
`row:` để **nằm ngang** (thành 1 `columns`).

```yaml
layout:
  - block: "THÔNG TIN CHUNG"     # tên nhóm logic
    hidden: false                # true → splitter ẩn (end-user không thấy cả nhóm)
    fields:
      - { key: tieuDeChung, type: h2, label: "THÔNG TIN CHUNG" }   # heading: nội dung ở label

      - row:                     # 3 field CÙNG row → nằm ngang 1 hàng
          - { key: maSoThue,     type: textField, label: "Mã số thuế", required: true, validate: { maxLength: 14 } }
          - { key: nguoiDaiDien, type: textField, label: "Người đại diện", required: true }
          - { key: chucVu,       type: textField, label: "Chức vụ" }

      - { key: ngayLap, type: datepicker, label: "Ngày lập", required: true, validate: { formatDate: "DD/MM/YYYY" } }

  - block: "HỆ THỐNG"
    hidden: true                 # cả nhóm ẩn (splitter display=false) — trường phục vụ code
    fields:
      - { key: emailUser,   type: textField, label: "Email user hiện tại" }
      - { key: ngayHienTai, type: textField, label: "Ngày hiện tại" }
```

### `key` — định danh logic (do người viết đặt)

- Đặt tên **nghiệp vụ, camelCase** (`maSoThue`, `ngayLap`) — KHÔNG phải key runtime `textField-1`.
- `conditions`/`logic`/`formula` tham chiếu **theo `key` logic này**.
- Khi generate, tôi tự sinh key runtime (`textField-3`) + `hashid` + `id`, và lưu bảng ánh xạ
  `key logic → key runtime` trong `.meta.json`. Bạn **không** cần biết key runtime.

### Thuộc tính field dùng chung

| Khoá | Ý nghĩa | Mặc định |
|---|---|---|
| `key` | định danh logic (bắt buộc, duy nhất trong form) | — |
| `type` | loại field (xem bảng §5) | — |
| `label` | nhãn (với `h1/h2/h3/text` = nội dung) | "" |
| `required` | bắt buộc → `validate.required` | false |
| `readonly` | chỉ đọc | false |
| `hidden` | ẩn field lẻ (`display=false`) | false |
| `value` | giá trị mặc định | "" |
| `placeholder`, `tooltip`, `description` | chú thích phụ | "" |
| `validate` | object ràng buộc theo type (§5) | {} |
| `formula` | công thức tự tính (§4) | — |
| `source` | nguồn dữ liệu dropdown (§3) | — |

---

## 3. `source` — nguồn dữ liệu cho `dropdown`

3 kiểu, khớp `dropdownConfig.typeGetData_value.value` (1 / 4 / 3):

```yaml
# a) Nhập tay (value=1)
- key: mucDo
  type: dropdown
  label: "Mức độ"
  source:
    kind: manual
    options: ["Cao", "Trung bình", "Thấp"]

# b) eCatalog — nguồn dữ liệu nội bộ (value=4)
- key: donVi
  type: dropdown
  label: "Đơn vị"
  required: true
  source:
    kind: catalog
    catalogId: "68d2573630dcb2365ae4325d"   # ID catalog (KHÔNG phải URL http)
    value: WBS                                # cột lấy giá trị
    display: [ProjectID, WBS]                 # (các) cột hiển thị
    filter:                                   # lọc nguồn theo field trong form
      - { col: PhanLoai, op: in, byField: phanLoai }
    feed:                                     # khi chọn → đổ dữ liệu sang field khác
      - { col: GCN, toField: gcnSo }

# c) API HTTP (value=3)
- key: nhanSu
  type: dropdown
  label: "Nhân sự"
  source:
    kind: api
    method: get
    url: "$KytaSystem services/uaa/api/account-eaccount"   # "$KytaSystem " = service nội bộ
    value: orgIn
    display: [orgName]
    responseTemplate: "{ id: number; orgName: string; orgIn: string; }"
    # filter / feed dùng chung cú pháp như catalog
```

---

## 4. `formula` — công thức tự tính

Viết như biểu thức hàm, tham chiếu field khác **theo `key` logic**:

```yaml
- key: hoTen
  type: textField
  label: "Họ và tên"
  readonly: true
  formula: 'concatenate(ho, " ", ten)'

- key: soNgay
  type: number
  label: "Số ngày"
  formula: 'days(ngayKetThuc, ngayBatDau)'
```

Hàm đã xác minh: `concatenate`, `days`. Hàm khác — báo tôi, tôi kiểm trên editor trước (danh mục đầy đủ chưa
xác minh — xem [node-templates/README](eform-node-templates/README.md#formula)).

---

## 5. `type` hỗ trợ + `validate` theo type

| `type` | Nhãn designer | Khoá `validate` chính |
|---|---|---|
| `textField` | Input text | `required, regex, maxLength, minLength, unique, messErrorForRegex` |
| `textArea` | Multiline text | `required, maxLength, minLength` |
| `number` | Number | `required, decimalPlace, requireDecimal` (+ `currency` ở gốc) |
| `email` | Email | `required, regex` |
| `phone_number` | Phone number | `required` |
| `datepicker` | Date Picker | `required, formatDate, minDate, maxDate, locale` |
| `dropdown` | Dropdown | `required, mutilChoose` (+ `source` §3) |
| `radio_button` / `check_box` | Radio / Checkbox | `required` (+ `options`) |
| `upload_file` / `upload_img` | Upload | `required, maxSizeFile, validFileType_value` |
| `signature` | Signature | `required` |
| `table_advance` | Table input | mô tả cột ở `logic`/ghi chú (config phức tạp) |
| `rich_text_advance` | Rich Editor | `required` |
| `view_ewriter` | Preview Document | nhúng bản in eWriter |
| `textField_ticketName` | Ticket name | tên ticket eRequest |
| `child_form` | Form | nhúng form con (`childFormConfig`) |
| `buttonElement` | Button | gắn `logic` onClick |
| `h1`/`h2`/`h3` / `text` | Heading / Text | nội dung ở `label` |
| `divider`, `numbered_list`, `record_audio` | — | — |

> Bố cục `columns/row/splitter` **không** khai `type` — dựng qua `block` + `row` + `hidden` ở §2.

---

## 6. `conditions` — ẩn/hiện theo điều kiện (`jsonFormCondition`)

Cấu hình sẵn của eForm (không cần code). KHI field nguồn thoả điều kiện → show/hide field khác:

```yaml
conditions:
  - when: { field: loaiHopDong, op: equal, value: "2" }
    show: [ghiChuDacBiet]
    hide: [chuKy]
  - when: { field: soPhuLuc, op: un_empty }     # op empty/un_empty không cần value
    show: [nhomPhuLuc]
```

`op`: `equal | un_equal | empty | un_empty | include`. `show`/`hide` = danh sách `key` logic.

---

## 7. `logic` — điều gì eForm KHÔNG cấu hình được → tôi viết code động

Mô tả **nghiệp vụ**; tôi hiện thực bằng `code/*.js` (hàm runtime: `getFieldValue`, `changeFieldValue`,
`bindFieldChangeEvent`, `setDisplayField`, `fetch`… — [eform-code-api.md](eform-code-api.md)):

```yaml
logic:
  - trigger: donVi
    event: onChange           # onInit | onChange | onClick | onBlur | ...
    desc: "Khi chọn đơn vị → gọi catalog lấy MST tương ứng, đổ vào maSoThue"

  - trigger: [ngayBatDau, ngayKetThuc]
    event: onChange
    desc: "Đổi ngày → tính days() đổ vào soNgay; nếu <0 thì showToast báo lỗi"

  - trigger: btnKiemTra
    event: onClick
    desc: "Bấm → fetch API tồn kho, hiện kết quả vào ketQuaKiemTra"
```

Ưu tiên: cái gì `formula`/`conditions`/`source` làm được thì khai ở §3–6; chỉ đẩy vào `logic` phần thật sự cần code.

---

## 8. Quy trình generate (tôi chạy)

1. BA điền xlsx → tôi convert → `spec.yaml` (review trong PR).
2. Bạn tạo form vỏ trên designer → dán `formId` vào `meta.formId`.
3. Tôi generate: `field add` từng field theo `layout` → `field group/move` dựng bố cục → `condition` cho `conditions`
   → viết `code/*.js` cho `logic` → `push`. Mỗi bước `--dry-run` trước ở form thật.
4. `pull` lại + `diff` để đối chiếu spec ↔ server.

> Khâu tạo vỏ hiện làm tay. Lệnh `eform create` (POST /owner/form tự sinh formId) đã có code nhưng **[Unverified]**
> — khi cần chạy pipeline từ 0, báo tôi verify + nối lệnh.
