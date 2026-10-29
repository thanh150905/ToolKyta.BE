# eWriter — schema & API (reverse-engineered)

> Phân hệ **eWriter** = kho quản lý tài liệu **bản in** (.docx) trên Kyta Platform. Mỗi tài liệu
> là một mẫu docx (có thể gắn vùng chữ ký/biến trộn theo người nhận) và được **liên kết với một
> eForm** (`eformId`) hoặc **template eContract** (`templateEcontractId`). Chức năng "Xem bản in"
> trong form chính là render tài liệu eWriter đã cấu hình (đối chiếu `docs`/`docxImport.js`:
> field `rich_text_advance` nhận base64 docx → eWriter render giữ 100% định dạng).
>
> Nguồn: reverse-engineer trực tiếp trên `saigoncoop/sandbox` (2026-09-27), cào network + trích
> bundle Angular + gọi thử API bằng cookie same-origin. Mục nào **chưa gọi kiểm chứng được** thì
> ghi rõ `[Unverified]`.

## Host & xác thực

- **Host**: `https://ewriter.sandbox.kytaplatform.com` — suy từ host eform theo pattern
  `eform.<x>` → `ewriter.<x>` (giống `eflow`/`eaccount`). Chưa khai riêng trong `config/kyta.json`.
- **Xác thực**: cookie same-origin như các phân hệ khác (login qua `uaa`). Tài khoản hiện tại lấy ở
  `GET /services/uaa/api/account-eaccount` → `{ login, custId, orgId, orgIn, firstName, lastName }`.
  saigoncoop/sandbox: `custId=8822`, `orgIn="/8822/17642"`.
- **Service prefix**: `/services/ewriter/api`
- Backend là JHipster (lỗi trả `{type,title,status,detail,path,message}` hoặc
  `{code,message,status}` hoặc `error.ERROR`).

## Đối tượng Document (48 field — từ `details`)

| Field | Ý nghĩa |
|---|---|
| `id` | id Kyta (vd `000071pyILzluELK0nl6K`) |
| `name` | tên file `.docx` |
| `resourceId` | UUID file trên S3 (eCondrive), vd `4f778ca7-...` |
| `resourceIdPath` / `resourceNamePath` | đường dẫn theo id / theo tên trong cây thư mục |
| `resourceParentId` | UUID thư mục cha (folder) |
| `size` | bytes |
| `type` | 1 = tài liệu (2 = thư mục?) `[Unverified]` |
| `fileType` | 1 = docx |
| `status` | **0 = Bản nháp**, **1 = Bản sẵn sàng**, **2 = Bản cuối cùng** — chỉ `1` đã xác minh; `0`/`2` `[Inference]` từ 3 checkbox lọc |
| `custId`, `orgIn`, `userId`, `ownerType`, `temOrg` | chủ sở hữu / tổ chức |
| `jsonData` | **chuỗi JSON** — mảng field đặt trên docx (xem dưới) |
| `jsonXml`, `positionField`, `tableObject` | cấu trúc bố trí (thường null nếu chưa cấu hình) |
| `structure`, `structureTable`, `structureCheckBoxSingle` | cấu trúc field nâng cao |
| `eformId` | **liên kết eForm** (vd `000071bBIoqcQ5adneWlt88a8` trùng prefix field trong docxImport.js) |
| `templateEcontractId` | liên kết template eContract (vd `000072PVfvnFQgqnNLaGSDDPD`) |
| `formVersion` | object phiên bản form |
| `alias`, `aliasDTOS` | bí danh tài liệu |
| `assignee`, `contractViewers`, `perm` | phân quyền/người ký-xem |
| `isFavourite`, `isPriority`, `recycle`, `thumbnail`, `description` | cờ/hiển thị |
| `isIntegrate`, `isShortCut`, `isRecycleShortCut`, `shortCutId` | tích hợp/lối tắt |
| `createdBy/Date`, `lastModifiedBy/Date`, `lastAccessDate` | audit |
| `content`, `path`, `storageData`, `sequence` | nội dung/vị trí (null trừ ngữ cảnh cụ thể) |

### `jsonData` — mảng field đặt trên bản in
```json
[{
  "id": "#ds:427|r:p_001_r_001|h:100|#",
  "code": "427",
  "type": "ds",                       // ds = vùng chữ ký số; (các type khác chưa map)
  "config": { "move": false, "width": 164, "height": 90, "resize": false, "require": false },
  "recipientId": "p_001_r_001"        // gắn field cho 1 người nhận/ký
}]
```

## Endpoints (`/services/ewriter/api/...`)

Verb lấy từ bundle Angular (`828.*.js`, `384.*.js`); ✓live = đã gọi kiểm chứng bằng cookie.

| Lệnh CLI dự kiến | Method + path | Ghi chú |
|---|---|---|
| list | `GET /documents/listDocumentSuggest?page&size&sort=lastModifiedDate,DESC` ✓live | Trả `{pageOffset,pageSize,totalElement,data[]}`. **Dùng cái này cho `list`** — trả full object, phân trang server. saigoncoop có 33 tài liệu. |
| (list gốc) | `POST /documents/listDocuments?page&size&sort` | Body filter (status[]/khoảng ngày/người tạo). Body rỗng → 400 `error.ERROR`; chưa dò ra body đúng. App chỉ gọi 1 lần lúc bootstrap; lọc/phân trang trong UI là **client-side**. `[Unverified]` body. |
| detail / pull | `GET /documents/details?id={id}&resourceId={resourceId}` ✓live | **Bắt buộc cả `id` và `resourceId`** (thiếu → "Id and resourceId is empty"). Trả full 48-field. |
| clone | `POST /documents/duplicate` — body `{ id, name, resourceParentId }` | Nhân bản: id nguồn + tên mới + thư mục đích. Param lấy từ bundle; **chưa gọi kiểm chứng** (auto-mode chặn ghi). |
| clone folder | `GET /documents/duplicateFolder` | |
| push/create | `POST /documents/uploadFile` (**multipart FormData**: file docx + biến) | Import .docx → tạo document. Field FormData chưa map đủ (thấy `listVariableDelete`, `webkitRelativePath`). `[Unverified]` |
| upload folder | `POST /documents/uploadFolder` | |
| download | `POST /documents/exportFile` — body kèm `documentId`, `filePdf` | Xuất PDF (`getFilePdf`). `[Unverified]` chi tiết body/kiểu trả. |
| update data | `PUT /documents/updateJsonData` — body `{ id, jsonData }` | Cập nhật `jsonData` (vị trí field/biến trộn trên bản in). |
| replace file | `PUT /documents/updateResource` | Thay bytes docx của tài liệu. `[Unverified]` body. |
| get resource | `POST /documents/resource` | Lấy nội dung/resource. `[Unverified]`. |
| move | `POST /documents/move` | Đổi thư mục (`resourceParentId`). |
| favorite | `PUT /documents/favorite` | Đánh dấu sao. |
| delete | `POST /documents/delete` | Xoá (vào thùng rác — có `restore`). |
| restore | `POST /documents/restore` ; `POST /documents/restoreVersion` | Khôi phục tài liệu / phiên bản. |
| removeText | `POST /documents/removeText` | (chưa rõ ngữ cảnh) |

## Lớp biến (variables) — "gán biến từ eForm"

Biến trộn KHÔNG nằm trong `jsonData` (jsonData chỉ chứa vùng chữ ký, `type:"ds"`). Biến có API riêng:

| Endpoint | Ghi chú |
|---|---|
| `GET /variables?documentId={id}` ✓live | Danh sách biến đã đặt trong tài liệu. Mỗi biến ánh xạ **field eForm → placeholder**. |
| `GET /variable-data?documentId={id}` ✓curl | Đọc dữ liệu biến của tài liệu (gọi sau khi lưu). |
| `GET /variables/form-id/{formId}` | Trả rỗng khi thử — không dùng cho luồng gán biến. |

### Luồng "thêm biến từ form → áp dụng → lưu" (ĐÃ XÁC MINH qua cURL thật, 4 call)

1. **Liệt kê form nguồn để kéo biến**: `POST /services/eform/api/share/form-eflow?page=0&size=N`
   (service **eform** qua host ewriter) — body `{"createdDate":null,"textSearch":""}`. Trả danh sách eForm.
2. **Lưu biến (gán biến vào cấu hình)** — mấu chốt:
   `POST /services/ewriter/api/variable-data/save-all?documentId={docId}&delete=true`
   ```json
   {"addVariables":[
     {"code":"dqo2zxmqg","apply":true,"applyServer":true,
      "variableName":"Input (dqo2zxmqg)","variableType":"string",
      "fieldId":"{formId}_textField-1","resourceId":"{formId}",
      "viewerPermission":[],"id":null}
   ],"deleteVariables":[],"dataAdd":[]}
   ```
   - `code`: client tự sinh (9 ký tự [a-z0-9]); `variableName` = `"{nhãn field} ({code})"`;
     `fieldId` = `"{formId}_{fieldType}-{n}"`; `resourceId` = `{formId}`; `variableType` map theo
     kiểu field eForm (`textField/textArea`→`string`, `check_box`→`check_box`, bảng→`table`, ...).
   - `delete=true`: đồng bộ (xoá biến không còn trong `addVariables`); `deleteVariables[]` để xoá cụ thể.
3. **Lưu tài liệu**: `PUT /services/ewriter/api/documents/updateResource` — gửi **full object** document,
   đồng thời set `eformId` = id form nguồn (vd `000071pyI9KIE2wrdzzvFQQKQ`), `status` (0/1/2), `name`...
4. **Đọc lại**: `GET /variable-data?documentId={docId}`.

**Nguồn field để dựng biến**: `form-eflow` trả mỗi form gồm `formId, formCode, formName, jsonForm, variableArr, jsonFormCondition, versionId...` (SGC có 185 form). `variableArr` **rỗng ở list** ⇒ danh sách field lấy từ **`jsonForm`** (định nghĩa form — `src/eform` đã đọc được). Từ mỗi field dựng: `fieldId="{formId}_{fieldType}-{n}"`, `variableName="{nhãn} ({code})"`, `variableType` map theo kiểu field. `[Cần chốt]` bảng map fieldType eForm → variableType eWriter (mới thấy string/table/check_box) khi code — đọc jsonForm thật lúc dựng.

| Khác | `api/template`, `api/receipt-templates/all`, `api/contract-numbers`, `api/number-strips`, `api/internal/documents/exportFile` — template/đánh số/xuất. |
|---|---|

Đối tượng **Variable** (18 field): `id`, `variableName` (`"Nhãn field (code)"`), **`variableType`** (chỉ thấy `string` và `table`), **`code`** (mã placeholder ngắn, vd `XQB4WBWzV`), **`fieldId`** (id field eForm, vd `000071owIPz0UoG8LGGE8t44b4_textArea-1`), `resourceId` (id form nguồn), `recipientId`, `apply`/`applyServer`, `viewerPermission[]`, audit. saigoncoop: 680 biến / 34 tài liệu.

### Editor & cú pháp trong docx (ĐÃ XÁC NHẬN trên editor thật)
- **Route editor**: `/file-edit/update/{documentId}` — editor DOCX WYSIWYG (ribbon Home/Insert/Page Layout/References/Mail Merge/View/Design/Layout — dạng OnlyOffice/AllInOneDocs).
- Biến, điều kiện, bookmark đều là **field code Word chuẩn (OOXML)** nằm trong `word/document.xml` của file .docx:
  - **Biến** = `MERGEFIELD`: `{ MERGEFIELD "Nhãn hiển thị (code)" }` — vd `{ MERGEFIELD "Họ và tên Thủ trưởng CQ (Kéo kế thừa) (6W4nzJx1gI1O)" }`. Phần `(code)` cuối = `code` trong API `/variables` → truy ra `fieldId` eForm.
  - **Điều kiện IF** = field IF của Word (lồng field): `{ IF "{ MERGEFIELD "table2" }" = 2 "giá-trị-đúng" "giá-trị-sai" }`. So sánh MERGEFIELD với giá trị, có nhánh đúng/sai; lồng nhiều tầng được.
  - **Xuống dòng theo ý / kế thừa** = **Bookmark** Word (tab Insert → Bookmark).
- Panel trái editor: *Danh sách người ký* (recipient) · *Danh sách cấu hình* (chip field) · *Chèn trường cho* (Chữ ký số/ảnh, Cấp số, **Trường nhập**, **Trường nhập nhiều dòng**, **Dropdown**) · nút *Thêm biến / Chèn biến / Danh sách biến / Xóa cấu hình*.
- ⇒ **Hệ quả cho CLI**: điều kiện IF/biến/bookmark là OOXML chuẩn ⇒ **script được** bằng cách sửa `word/document.xml` trong .docx (không cần editor). CLI có thể: round-trip .docx, đọc/ghi MERGEFIELD (map biến), thêm/sửa field IF, bookmark. (Chân ký số/ảnh gắn từ cấu hình eContract — **bỏ qua** theo yêu cầu.)

## Liên kết bản in ↔ form & Cơ chế MailMerge (ĐÃ XÁC MINH 100%)

> Chi tiết các bước triển khai nhanh, script mẫu và xử lý lỗi không nhận dữ liệu xem tại:
> [ewriter-eform-integration-playbook.md](ewriter-eform-integration-playbook.md)

- **Cơ chế MailMerge khi xem trước**: Khi bấm nút `view_ewriter` ("Xem bản in"), eForm gọi:
  `POST /services/ewriter/api/documents/preview/{documentId}?filePdf=true|false`
  Body là mảng: `[ { formId, label, hashid, type, value }, ... ]`.
- **Nguyên tắc khớp biến**: Backend eWriter/Aspose duyệt qua các trường Word:
  - Trường đơn: Khớp theo `{ MERGEFIELD "${label} (${hashid})" }`.
  - Trường bảng (`table_advance`): Ô 1 chứa `{ DOCVARIABLE "${label} (${hashid})" }` + `{ MERGEFIELD "col_1" }`, các ô sau chứa `{ MERGEFIELD "col_2" }` ... `col_N`.
  - Nếu `hashid` của form bị lệch so với mã trong Word mẫu $\rightarrow$ backend bỏ qua và gán chuỗi rỗng.
- **Nút xem bản in trên eForm**: Component `view_ewriter`, `value` = `documentId` eWriter.
  Có cấu hình `previewDocumentConfig: { useLabelCustom: true, pushHiddenField: false }`.

## Các Endpoint eWriter bổ sung đã xác minh

1. **Tải file Word mẫu**: `GET /services/ewriter/api/documents/viewFile?Id={documentId}`
   Trả về chuỗi base64 của file .docx.
2. **Cập nhật file Word mẫu**: `POST /services/ewriter/api/documents/uploadFile`
   Gửi FormData gồm:
   - `file`: blob file .docx
   - `dto`: chuỗi JSON của full document detail
3. **Kích hoạt biến cho template**: `POST /services/ewriter/api/template-variables`
   Body: `{ documentId, variableId, apply: true }`.
4. **Xem trước (Preview / Render)**: `POST /services/ewriter/api/documents/preview/{documentId}?filePdf=false`
   Body: JSON array các field từ `handleDataSubmit` / `onPreviewDoc`.

