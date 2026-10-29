# eForm — schema cấu hình field (jsonForm)

Ghi chú từ form thật (saigoncoop/sandbox, bmw/sandbox — cào 2026-09-27). Mỗi field là 1 node trong
`form.jsonForm`; công cụ kéo về `fields.json` (`kyta eform pull`) và đẩy lại qua `PUT /owner/form`.

> Kèm theo: [eform-node-templates/](eform-node-templates/) — **node mẫu đầy đủ từng loại field** (khuôn để thêm
> field/dựng form, gồm biến thể formula & dropdown datasource) · [eform-code-api.md](eform-code-api.md) — **hàm
> code động** dựng sẵn để bù logic mà cấu hình không làm được.

- Danh tính field: `hashid` (bền, khoá định vị khi push) và `id = "<formId>_<key>"` (vd `..._textField-1`).
- `fields.json` giữ **nguyên vẹn** mọi property cấu hình, **trừ** `id`/`hashid`/`type` (danh tính) và
  `components`/`customRenderCode` (custom UI quản lý riêng ở `ui/<field>/`).
- Sửa: `kyta eform field set <form> <key> ...` hoặc sửa tay `fields.json`, rồi `kyta eform push <form> --fields-only`.

## Property chung (hầu hết field nhập liệu)

| Property | Ý nghĩa | Ví dụ giá trị thật |
|---|---|---|
| `label` | Nhãn hiển thị | `"Tên gói thầu"` |
| `value` | Giá trị mặc định | `""`, `null`, hoặc chuỗi |
| `display` | Hiện (`true`) / ẩn (`false`) | `true` |
| `readonly` | Chỉ đọc | `false` |
| `code` | Mã field (nghiệp vụ) | `""` |
| `tooltip` / `description` / `placeholder` | Chú thích phụ | `""` |
| `labelPosition` | Vị trí nhãn | `"above"` |
| `textTransform` | Biến đổi chữ | `"none"` |
| `validate` | Ràng buộc (xem theo type) | `{ "required": true }` |
| `formula.expression_value` | Công thức tự tính | `[]` |
| `extractCLMInfo` / `metaSearchOnRequest` | Cờ tích hợp CLM / tìm khi mở request | `false` |

**required** nằm ở `validate.required` (boolean), **không** ở gốc node.

## `validate` theo từng type (khoá đã quan sát)

| Type | Khoá `validate` |
|---|---|
| `textField`, `textField_ticketName` | `required, regex, unique, maxLength, minLength, messErrorForRegex, listSelectedRegex_value, inputMask` |
| `number` | `required, decimalPlace, requireDecimal, inputMask` (+ gốc: `currency`, `inputType`) |
| `textArea` | `required, maxLength, minLength` (+ `textAreaConfig`) |
| `datepicker` | `required, locale, formatDate, minDate, maxDate` |
| `dropdown` | `required, mutilChoose` |
| `upload_file` | `required, maxSizeFile, minSizeFile, validFileType_value` (+ `uploadFileConfig`) |
| `rich_text_advance` | `required` (+ `richTextConfig`) |

## Field nhập liệu văn bản: `textField` / `number` / `phone_number`

- `inputType` phân loại ô nhập. Trên `textField` quan sát `"text"`. Các biến thể email/số điện thoại
  thể hiện qua `phone_number` (type riêng) và `inputType`; danh mục giá trị đầy đủ **[Unverified]** —
  khi cần một loại cụ thể (email/số...), pull field mẫu rồi soi `inputType` + `validate.regex`.
- `number` có thêm `currency` (định dạng tiền) và `validate.decimalPlace` / `requireDecimal`.
- Ràng buộc regex: đặt `validate.regex` + `validate.messErrorForRegex` (thông báo lỗi).

## `dropdown` — nguồn dữ liệu

`dropdownConfig.typeGetData_value.value` quyết định nguồn:

**1 = Nhập dữ liệu tay** (`data` là mảng option):
```json
"dropdownConfig": {
  "data": [ { "id": 1, "label": "Item 1", "value": "1" } ],
  "allowAddTag": true,
  "typeGetData_value": { "label": "Nhập dữ liệu", "value": 1 }
}
```

**4 = Lấy từ nguồn dữ liệu / catalog** (gọi tới data source, có lọc + feed):
```json
"dropdownConfig": {
  "data": {
    "url": "6a8024df2c83e233fe0079da",          // id nguồn dữ liệu (catalog), KHÔNG phải URL http
    "field_value": { "label": "WBS Element", "value": "textField_input-1" },   // cột lấy giá trị
    "fieldDisplay_value": [ { "label": "Project ID", "value": "textField_input-1" } ], // cột hiển thị
    "conditionFilter": [],       // điều kiện lọc
    "feedData": [],              // feed dữ liệu sang field khác khi chọn
    "charSeparator": "-",
    "isGetAllCatalogData": false,
    "isDefaultSelectFirstItem": ""
  },
  "allowAddTag": false,
  "typeGetData_value": { "label": "formElement.setting.dropdown.source_data_list.text_3", "value": 4 }
}
```

**3 = API** (gọi HTTP ngoài; `data` có thêm `method/header/payload/responseTemplate/timeCache`):
```json
"dropdownConfig": {
  "data": {
    "url": "$KytaSystem services/uaa/api/account-eaccount",  // "$KytaSystem " = service nội bộ
    "path": "", "method": "get",
    "header": [ { "key": "Content-Type", "value": "application/json" } ],
    "payload": "", "timeCache": 0,
    "field_value": { "label": "orgIn", "value": "orgIn" },
    "fieldDisplay_value": [ { "label": "orgName", "value": "orgName" } ],
    "responseTemplate": "{ id: number; orgName: string; orgIn: string; }",
    "conditionFilter": [], "feedData": []
  },
  "typeGetData_value": { "label": "API", "value": 3 }
}
```

`conditionFilter[]` (lọc nguồn theo field trong form) và `feedData[]` (đổ dữ liệu sang field khác khi chọn) —
dùng chung cho kiểu 3 & 4:
```json
// conditionFilter
{ "type": "variable", "field": {"label":"Phân loại","value":"<cột nguồn>"},
  "operator": {"label":"=","value":"in"}, "conditionInput": {"label":"..","value":"<formId>_textField-20"} }
// feedData
{ "field": {"label":"GCN số","value":"<cột nguồn>"}, "elementId": {"label":"Giấy CN","value":"<formId>_textField-7"} }
```
Đầy đủ 4 kiểu + template: [eform-node-templates/README.md](eform-node-templates/README.md), file `dropdown.datasource.json` / `dropdown.api.json`.

## `table_advance` — bảng động

`tableAdvanceConfig` (khoá đã quan sát): `column_value, cellType_value, dataCell_value, bindingCell_value,
readonlyCell_value, hideCols_value, hideRows_value, mergeCell_value, classCustomCell_value, fixedRowsTop,
fixedColumnsStart, allowAddRow, allowResizeHeight, allowOverideStyle, defaultHeight, inheritValueOnAddRow,
advanceMethodConfig, sourceDropdownType_value, dynamicSourceConfig_value`.
Chi tiết từng khoá **[Unverified]** — pull bảng mẫu rồi soi khi cần sửa.

## Cấu hình điều kiện (ẩn/hiện field theo điều kiện) — `form.jsonFormCondition`

"Cấu hình điều kiện" trong editor lưu ở khoá **cấp cao của form object** `jsonFormCondition` (KHÔNG nằm trong
`jsonForm`), dạng **chuỗi JSON double-encoded** (như `jsonForm`/`variableArr`). Mỗi phần tử = 1 luật:

```json
{ "conditionId": "J0dN9zbL",           // id ngẫu nhiên của luật
  "enable": true,
  "fieldId": "<formId>_dropdown-1",     // FIELD NGUỒN để so điều kiện
  "operator": "equal",                  // equal | un_equal | empty | un_empty | include
  "value": "2",                         // giá trị so sánh
  "typeValue": "1",                     // luôn "1" (đã quan sát)
  "action": [                           // hành động khi điều kiện đúng
    { "type": "show",          "fieldIds": ["<formId>_textArea-1"] },
    { "type": "hide",          "fieldIds": ["<formId>_signature-1"] }
  ] }
```
`action.type`: `show` · `hide` · `show_multiple` · `hide_multiple` (đều có `fieldIds[]`).

**Ghi (đã kiểm chứng):**
- PUT `/owner/form` nhận `jsonFormCondition` **dạng chuỗi** (gửi mảng → 400). 
- **BỎ QUA** `jsonFormCondition` khi PUT → server **giữ nguyên** giá trị cũ (partial update). Vì vậy các lệnh
  `field`/`childform` (payload 9 field, không kèm) **KHÔNG xoá** cấu hình điều kiện — đã test thực tế.
- Muốn sửa điều kiện: gửi kèm `jsonFormCondition: JSON.stringify(rules)`.

## Danh mục type đã gặp

`textField, number, textArea, datepicker, dropdown, radio_button, upload_file, upload_img, signature,
table_advance, rich_text_advance, phone_number, view_ewriter, textField_ticketName` (nhập liệu);
`h1, h2, h3, text` (tiêu đề/nội dung — sửa `value`);
`page, columns, row, splitter` (bố cục — **page/columns/row bị `collectAllFields` bỏ qua**);
`variable, func, static` (không có hashid — không quản lý qua fields.json).
