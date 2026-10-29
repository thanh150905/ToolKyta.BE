# eFlow — Sơ đồ API & cấu trúc `jsonXml` (reverse-engineered)

> Tài liệu tích luỹ, cào từ modeler thật trên **saigoncoop/sandbox** (host `eflow.sandbox.kytaplatform.com`,
> microservice `idaas-eflow`). Mỗi mục được xác minh trực tiếp từ request/response + `jsonXml` đã lưu.
> Modeler dùng để phân tích: `00007mzImMIW2zVlrGe` — "Trên 500tr/Đấu thầu rộng rãi, hạn chế" (đã cấu hình hoàn chỉnh).

## 1. Endpoint (đã xác minh 2026-09-23)

| Việc | Method + path |
|---|---|
| List quy trình | `POST /services/idaas-eflow/api/modeler/search-elastic?page=&size=&sort=status,desc&sort=createdDate,desc` — body `{"textSearch":"","shared":"false"}` |
| Chi tiết (full, có `jsonXml`) | `GET /services/idaas-eflow/api/modelers/{id}` |
| Lưu (full object) | `PUT /services/idaas-eflow/api/modelers?status=active\|unpublic` |
| Bản BPMN cho editor | `GET /services/idaas-eflow/api/processes/{id}` → `{status,message,data}` (không cần cho pull/push) |
| Nhóm modeler | `POST /services/idaas-eflow/api/modeler-groups/search-elastic` — body `{"textSearch":"","status":"active"}` |
| Biến cấu hình | `GET /services/idaas-eflow/api/variables-configs/get-by-modeler/{id}` |

- Auth: token/cookie login eaccount **chạy cross-host** sang eflow.* (SSO idaas) — đã xác minh từ CLI.
- `version` trong object modeler **KHÔNG tự tăng** qua mỗi lần save (giữ nguyên qua round-trip) — push chỉ cần GET-fresh rồi gửi lại version hiện tại.
- Khi lưu, editor tự tính `attributeStr = JSON.stringify(attribute)`. `attribute` = `{cloneConfig, templateMail, attachmentConfig}`.

## 2. Cấu trúc `jsonXml` (BPMN 2.0 JSON — Signavio/Oryx)

```
{ modelId, bounds, stencil, stencilset, properties, childShapes[] }
```

- `stencilset.namespace = http://b3mn.org/stencilset/bpmn2.0#`
- Root `properties`: `process_id`, `name`, `documentation`, `dataproperties`, `executionlisteners`, `eventlisteners`
- `childShapes[]`: mỗi shape = `{ resourceId, stencil:{id}, properties:{...}, childShapes, outgoing[], bounds, dockers }`

### Kiểm kê stencil (modeler mẫu — 197 shape)

| stencil.id | SL | Vai trò |
|---|---|---|
| `CallActivity` | 38 | Node người thực hiện (gán người + biểu mẫu + kế thừa) |
| `SequenceFlow` | 104 | Dây nối (điều kiện) |
| `eNotify` | 24 | Node gửi thông báo (mẫu mail, tiêu đề) |
| `ExclusiveGateway` | 11 | Cổng rẽ nhánh |
| `eAPI` | 6 | Gọi API |
| `eContract` | 5 | Ký hợp đồng điện tử |
| `Aggregate` | 5 | Tổng hợp |
| `ParallelGateway` | 2 | Cổng song song |
| `StartNoneEvent` / `EndNoneEvent` | 1 / 1 | Bắt đầu / Kết thúc |

Cấu hình của từng node **nằm trong `shape.properties`**. Các mục dưới đây giải nghĩa từng property theo từng loại cấu hình.

---

## 3. Cấu hình theo topic

> _Điền dần khi phân tích từng panel. Mỗi mục: node loại nào → property key → ý nghĩa → giá trị mẫu → API tham chiếu (nếu có)._

### Panel "Cấu hình công việc" (task config) — CallActivity

Mở bằng nút **"Cấu hình task"** trên node. App là **Angular**, panel **huỷ khỏi DOM khi đóng** → muốn đọc option tĩnh
phải đọc DOM lúc đang mở. Panel có **7 tab**:

1. **Người thực hiện** (implementer — mục 3.1)
2. **Biểu mẫu** (gán form — mục 3.2)
3. **Chứng từ/ Hợp đồng đính kèm**
4. **Thời gian thực hiện** (SLA)
5. **Công việc thực hiện**
6. **Phân quyền**
7. **Cấu hình nâng cao** (mục 3.4 — gồm cấu hình thông báo/mail)

Tab "Người thực hiện" = **bảng nhiều dòng** (nút "Thêm người thực hiện"), cột: `Thứ tự thực hiện` (kéo thả sắp xếp) ·
`Người thực hiện` · `Phòng ban thực hiện` · `level` · `Điều kiện` · `Thông báo` · `Hành động`.

### 3.1 Gán người thực hiện — entity `implementer` (xác minh 2026-09-23)

**QUAN TRỌNG:** cấu hình người thực hiện **KHÔNG lưu trong `jsonXml`**. Node `CallActivity` trong jsonXml
chỉ có plumbing chung (`callactivitycalledelement:"recipient"`, in/out parameters map ticket fields, hai
executionlistener `${hhStartEvent}`/`${hhEndEvent}`). Node2 và node3 có properties **giống hệt** trừ `name`.
Người thực hiện là entity riêng, lưu server-side, khoá theo `(userTaskId, processId)`.

- `userTaskId` = `resourceId` của shape (vd `sid-2F4F3C02-...`).
- `processId` = **`model.modelId`** trong jsonXml (vd `00007lKI6wh0lOWJG1y`) — **KHÁC** id modeler (`00007mzImMIW2zVlrGe`).

**Endpoint:**
| Việc | Method + path |
|---|---|
| Đọc (có phân trang) | `GET /implementer/user-task/{userTaskId}/{processId}?page=0&size=8` |
| Đọc (full) | `GET /implementer/user-task/{userTaskId}/{processId}` |
| Ghi | `PUT /implementer` (body ~ mảng implementer object; "từ form" ~100KB do liệt kê option, "theo role" ~1KB) |
| Ref: form của modeler | `GET /forms/list/e-form?modelerId={id}&userTaskId=` |
| Ref: form external | `GET /forms/external/modeler/{id}?page=0&size=1000` |

Response đọc = Spring Page: `{status, message, data:{content:[implementer...], pageable, totalElements,...}}`.

**8 kiểu người thực hiện (`executorType`)** — list tĩnh FE (mở dropdown không call API, đọc từ DOM):

| # | Nhãn UI | Mã `executorType` | Field đặc trưng khi ghi |
|---|---|---|---|
| 1 | Tài khoản | `account` | `executorId`(userId), `email`, `phoneNumber`; `attributeStr.executor` = object user đầy đủ `{userId,email,fullName,phone,position,custId,orgIn,...}` |
| 2 | Chức vụ | `role` | `role`(tên), `roleId`, `position`=JSON `{id,name,code,custId}`, `roleScope` |
| 3 | Người tạo giao dịch | `creator` | (không cần field nào — suy từ người tạo ticket, tất cả null) |
| 4 | Phòng ban | `department` | `implementationDepartment` = JSON `{name,orgIn,custId}` — **ghi qua endpoint mảng** (xem dưới) |
| 5 | Biễu mẫu | `form` | `fieldForm`/`fieldFormStr` (form+trường) + `formUserTask` (nhúng form def) |
| 6 | Người quản lý trực tiếp | `directManager` | `managerType` (vd `"creator"` = quản lý của người tạo) |
| 7 | Theo chuỗi quản lý | `management` | `managerType` (vd `"creator"`) |
| 8 | Người thực hiện theo bước | `step` | `stepExecute` = mảng `userTaskId` của (các) bước trước để lấy lại người thực hiện |

Xác minh toàn bộ 2026-09-23 trên "Quy trình test".

**CRUD implementer (đầy đủ, xác minh 2026-09-23):**
- **Đọc:** `GET /services/idaas-eflow/api/implementer/user-task/{userTaskId}/{processId}[?page=&size=]` → Spring Page.
- **Tạo:** `POST /services/idaas-eflow/api/implementer` (1 object, `id=null`).
- **Tạo mảng:** `POST /services/idaas-eflow/api/implementer/list-implement` (body **mảng** — đã thấy dùng cho `department`;
  nhiều khả năng dùng khi 1 task có nhiều dòng).
- **Sửa:** `PUT /services/idaas-eflow/api/implementer` (1 object, có `id`).
- **Xoá:** `DELETE /services/idaas-eflow/api/implementer/{implementerId}` — theo **`id` của bản ghi implementer**
  (KHÔNG phải userTaskId), **không body**, **thực thi ngay khi bấm nút xoá — KHÔNG cần Save**. Trả 200. Mỗi lần xoá
  kéo theo 1 GET refetch danh sách.

→ Kết luận: thêm/sửa/xoá người thực hiện đều đã có endpoint. Muốn tự động hoá an toàn: đọc set hiện tại (GET) để lấy
`id` từng dòng, rồi POST (thêm) / PUT theo id (sửa) / DELETE theo id (xoá) tương ứng.

**Đã CHẠY THẬT qua session tool (không qua UI), round-trip tự dọn — 2026-09-23, "Quy trình test":**
POST tạo (trả về object kèm `id` mới) → PUT sửa (`delegationOfAuthority` true→false, GET xác nhận) → DELETE theo id →
GET về đúng số dòng ban đầu. Cả 4 call đều 200. ⇒ CRUD implementer hoạt động end-to-end từ CLI.

**ĐÃ ĐÓNG GÓI THÀNH TOOL (2026-09-23)** — `src/eflow/commands/{impl,notify}.js` + `src/eflow/api.js`.
**modeler và node nhận TÊN hoặc id/sid** (tự resolve; mơ hồ → liệt kê ứng viên, không đoán). Không cần cung cấp id thô.
```
kyta eflow nodes <customer> <env> <modeler(tên|id)> [--grep "x"] [--all]        # liệt kê node: sid + tên + loại
kyta eflow impl list  <customer> <env> <modeler(tên|id)> <node(tên|sid)>        # người thực hiện của node
kyta eflow roles <customer> <env> [--grep "x"]                                  # tra id role (uaa roles/search)
kyta eflow impl add   <customer> <env> <modeler(tên|id)> <node(tên|sid)> --type <role|creator|directManager|management|step> [opts]
        role: --role "tên|mã" (tự resolve id+position) | --role-id N [--role-name .. --role-code ..] [--role-scope ..]
        directManager/management: [--manager-type creator]   |   step: --step "sid-..,sid-.."
        chung: [--no-delegation] [--dry-run]
kyta eflow impl rm    <customer> <env> <implementerId> [--dry-run]              # xoá 1 dòng theo id
kyta eflow impl clear <customer> <env> <modeler(tên|id)> <node(tên|sid)> [--dry-run]   # xoá hết người thực hiện của node
```
Resolve: modeler theo id|keyValue|tên (khớp chính xác trước, rồi chứa); node theo sid|tên (ưu tiên node tác vụ, loại
dây/cổng/start/end). `processId` tự suy từ jsonXml. Đã test thật trên "Quy trình test" + đọc/dry-run trên modeler thật:
nodes/list/roles/add(role,creator)/rm/clear + resolve theo tên + báo mơ hồ — đều OK.

**Để Claude thao tác từ mô tả, user chỉ cần nói:** (1) customer/env [mặc định saigoncoop/sandbox], (2) tên quy trình,
(3) tên/số node, (4) muốn gì. Claude tự tra modelerId/sid/processId/roleId.

Kiểu `account`/`department`/`form` CHƯA đưa vào `add` v1 (payload đã biết ở trên, bổ sung sau khi cần).

`managerType`: kiểu directManager/management có sub-option (đã thấy `"creator"` = quản lý của người tạo GD; giá trị khác chưa khảo sát).

**Object `implementer` — field chính:**
- `executorType` — **cách gán** (8 giá trị ở bảng trên; đã xác minh `"form"`, `"role"`).
- `executorType="form"` → lấy người từ 1 field dropdown trong biểu mẫu:
  - `fieldForm`: `[{ name, type:"dropdown", formId, hashid, fieldId, modelerId, versionId, userTaskId }]`
  - (vd: dropdown `..._dropdown-5` của form `Trên 500tr_Tờ trình kế hoạch mua sắm_Start`, formId `0000710eIm3i2QNgRxJgF44n4`)
  - `role/roleId/position` = null.
- `executorType="role"` → gán theo chức danh:
  - `role` (tên), `roleId` (số, vd 2924), `position` = chuỗi JSON `{"id","name","code","custId"}`, `roleScope` (vd `"organizationWide"`), `level: []`.
  - `fieldForm` = null.
- Field chung: `id`, `notificationMethod` (`["email"]`), `delegationOfAuthority` (bool — uỷ quyền), `authorizationType` (`["internal"]`), `type` (`"internal"`), `condition`/`conditionText` (điều kiện áp dụng người này), `custId`, `orgIn`, `attribute` (`{executor, taskRole, eventMail, fieldFormDepartment}`).

**Tuần tự vs đồng thời (xác nhận từ user):** mọi user-task **mặc định đồng thời**. Implementer không có cờ tuần tự
(`stepExecute`, `priorityOrder`, `level` rỗng/null). Muốn tuần tự → validate trong form (như form "tờ trình duyệt"),
không cấu hình ở eflow.

**Nguồn dữ liệu cho các ô chọn (nằm ở service `uaa`, KHÔNG phải idaas-eflow):**

| Kiểu | API lấy danh sách | Field kết quả trong implementer |
|---|---|---|
| Chức vụ (`role`) | `POST /services/uaa/api/search/roleInfoModel?page=&size=100&sort=createdDate,desc&isDetails=false` · `POST /services/uaa/api/roles/search?page=&size=` | `role`(tên), `roleId`(id), `position`=JSON `{id,name,code,custId}`, `roleScope` |
| Tài khoản (user) | `POST /services/uaa/api/search/userInfoModel?page=&size=&role=true` | (chưa map field — dự kiến executorId/email/firstName/lastName) |
| Phòng ban | `GET /services/uaa/api/organizations/child/find-organization-like-orgin?orgIn={orgIn}` | (chưa map — dự kiến implementationDepartment) |
| Người trong 1 role | `POST /services/uaa/api/users-role/search?page=&size=&id={roleId}` | (danh sách user thuộc role) |

Cấu trúc 1 **role** (`roleInfoModel`): `{id, name, description, positionNumber, code, level, isReviewer, isSigner, custId, active, createdDate,...}`.
→ implementer chỉ giữ subset trong `position`: `{id, name, code, custId}`.

**Payload GHI `PUT /services/idaas-eflow/api/implementer`** (xác minh 2026-09-23 trên "Quy trình test"):
body = **1 object implementer đơn** (KHÔNG bọc mảng). Có `id` → **update** bản ghi sẵn có (task đã có người thực hiện).
Ba khoá `processId` + `modelerId` + `userTaskId` đều bắt buộc trong body:
- `processId` = `model.modelId` trong jsonXml (vd test: `000078DIVRH16eEe58A`)
- `modelerId` = id modeler (vd `00007gbIA0QfgmNkN3yV`), `modelerName` = tên modeler
- `userTaskId` = `resourceId` của shape (vd `sid-CD310EF2-...`)

Ví dụ body đổi sang role (rút gọn):
```json
{
  "id": "00007eMIXD6CWBBpV5GN",
  "executorType": "role",
  "role": "Chủ tịch hội đồng quản trị",
  "roleId": 2918,
  "position": "{\"id\":2918,\"name\":\"Chủ tịch hội đồng quản trị\",\"code\":\"TEST_CTHDQT\",\"custId\":8822}",
  "roleScope": "organizationWide",
  "fieldForm": null, "executorId": null, "implementationDepartment": null,
  "notificationMethod": "[\"email\"]",
  "authorizationType": "[\"internal\"]",
  "delegationOfAuthority": true,
  "condition": false, "conditionText": "null",
  "eventMail": [ {"key":"start","value":null}, {"key":"reminder","value":null}, {"key":"completed ","value":null} ],
  "attributeStr": "{\"eventMail\":null,\"taskRole\":null,\"executor\":null}",
  "processId": "000078DIVRH16eEe58A",
  "modelerId": "00007gbIA0QfgmNkN3yV",
  "modelerName": "Quy trình test",
  "userTaskId": "sid-CD310EF2-880C-4F8E-A0A4-6B256BF12FEC",
  "custId": 8822, "type": "internal"
}
```
Lưu ý chuỗi hoá: `notificationMethod`, `authorizationType`, `attributeStr` là **JSON string**; `conditionText` là string
`"null"`; `eventMail` mảng `{key,value}` với key `start`/`reminder`/`completed ` (**`completed ` có dấu cách cuối**).

**Role metadata "Chủ tịch HĐQT"** (saigoncoop/sandbox): `roleId=2918`, `code=TEST_CTHDQT`, `name="Chủ tịch hội đồng quản trị"`, `custId=8822`.

**GHI kiểu `executorType="form"`** (xác minh 2026-09-23 trên "Quy trình test"):
- **Method: `POST`** (không phải PUT) vì `id=null` → đổi kiểu người thực hiện = **tạo bản ghi implementer mới**.
  → Quy tắc chung: **POST = tạo mới (id null), PUT = cập nhật (có id).**
- Body ~103KB do field **`formUserTask`** (arr, ~102KB) **nhúng nguyên định nghĩa form** (`{name, formName, formId,
  versionId, value, jsonForm:[toàn bộ page/field]}`). Đây là dữ liệu denormalized FE gửi kèm — **server có bắt buộc
  hay không thì CHƯA xác minh** (nếu tự động hoá, an toàn nhất là fetch form def rồi nhúng giống FE).
- **Config thực sự** (nhỏ): 
  - `fieldForm`: `[{ name, formId, versionId, fieldId, hashid, type, modelerId, userTaskId }]` — trỏ **form nào +
    trường nào** cấp người thực hiện (vd `fieldId=..._textField-24` type `textField`, hoặc `..._dropdown-5` type `dropdown`).
  - `fieldFormStr` = `JSON.stringify(fieldForm)`.
  - `role/roleId/position/roleScope` = null.
- Endpoint nguồn: `GET /services/idaas-eflow/api/forms/list/e-form?modelerId={id}&userTaskId=` (list form) +
  `GET /services/idaas-eflow/api/forms/external/modeler/{id}` (form external). Danh sách trường lấy từ `jsonForm` của form.

**CÒN THIẾU (topic người thực hiện):**
- Có cần `formUserTask` (full form def) khi ghi form-type không, hay chỉ `fieldForm`/`fieldFormStr` là đủ.
- Các giá trị `managerType` khác ngoài `"creator"`.
- Cấu trúc ô "Điều kiện" per-dòng (giống điều kiện SequenceFlow — mục 3.5).
- Payload `list-implement` khi có NHIỀU dòng người thực hiện trên 1 task (mới thấy 1 phần tử).

**Endpoint các tab khác của panel (lộ ra khi thao tác, CHƯA mổ — để dành cho mục 3.2/3.3):**
- `GET /forms/external/{modelerId}/{userTaskId}` · `GET /forms/attached-user-task?attachedUserTaskId=&modelerId=` — gán biểu mẫu (tab Biểu mẫu, mục 3.2)
- `GET /documents/user-task/{modelerId}/{userTaskId}` — tab Chứng từ/Hợp đồng đính kèm
- `GET /notions/attached-user-task?modelerId=&attachedUserTaskId=` — "notions" gắn vào user-task (cần làm rõ nghĩa)

### 3.2 Gán biểu mẫu cho node (đọc xác minh live 2026-10-23; ghi rút từ bundle editor — [Unverified] chưa chạy thật)

Tool: `kyta eflow form list|set` (src/eflow/commands/form.js).
- Đọc theo node: `GET /forms/external/{modelerId}/{userTaskId}` → `{status,message,data:[{id,userTaskId,formId,versionId,formName,formCode,...}]}`
  (`jsonForm` ở đây KHÔNG đầy đủ). jsonForm đầy đủ + `userTaskId` của mọi node: `GET /forms/list/e-form?modelerId=&userTaskId=`
  (form Start có `userTaskId` rỗng).
- Danh sách form chọn được (bản phát hành mới nhất + jsonForm): `POST /services/eform/api/share/form-eflow?page&size`
  body `{createdDate:null,textSearch}` (gọi được qua host eflow).
- Trình tự ghi của editor (`confirm()` / `updateForm()` chunk 411.*.js):
  1. Đổi sang form khác: UI **xoá kế thừa của node** (`DELETE /variables-configs/{id}`).
     Lên version mới của cùng form: UI xoá bản cũ `DELETE /forms/user-task/{modelerId}/{userTaskId}` +
     `DELETE /services/eform/api/common/procedure?userTaskId=&processId=`, **giữ** kế thừa.
  2. `POST /forms` body `{userTaskId, formId, modelerId, jsonFormStr: <jsonForm>, formName, formCode, versionId: String}` (+`formType`/`notionType` cho node đặc biệt).
  3. `POST /services/eform/api/common/procedure` body `{userTaskId, formId, processId: <modelerId>, procedureName: <tên quy trình>, stepName: <tên node>, formType: null}`.
  - [Unverified] khi node đã có form, `POST /forms` có tự ghi đè hay không. Tool xoá bản cũ trước (theo nhánh updateForm của UI).

### 3.3 Gán biểu mẫu + Kế thừa dữ liệu (xác minh 2026-09-23)

**Gán biểu mẫu vào user-task = entity `forms/external`:**
- Đọc: `GET /services/idaas-eflow/api/forms/external/{modelerId}/{userTaskId}` → mảng form gắn vào node.
  Mỗi form: `{id, userTaskId, formId, versionId, formName, formCode, modelerId, jsonForm, attribute, ...}`.
- (Ghi chưa cào — dự kiến POST/PUT forms/external; tab Biểu mẫu còn dùng `forms/list/e-form`, `forms/attached-user-task`.)

**Kế thừa dữ liệu = entity `variables-configs`** (map field form node này ← field form node trước; KHÔNG nằm trong forms/external/jsonForm):
- Đọc: `GET /services/idaas-eflow/api/variables-configs/get-by-userTaskId/{modelerId}/{userTaskId}`
  (và `.../get-by-modeler/{modelerId}` cho cả modeler).
- Ghi: **`PUT /services/idaas-eflow/api/variables-configs`** (JSON body).
- Body:
  ```
  { id, modelerId, userTaskId, formId (form ĐÍCH), versionId (form đích),
    sources: [ <mỗi field kế thừa 1 phần tử> ] }
  ```
- Mỗi phần tử `sources[]` (map 1 field đích ← 1 field nguồn):
  ```
  {
    elementTarget: "<hashId field ĐÍCH>",
    fieldId: "<formIdĐích>_<type-N>-Target-null-null",
    formula: { context: "getValueForm('<modelerId>.<hashid NGUỒN>')",
               expressionValue: [{type:"variable", value:"<label>", item:"<modelerId>.null.<hashid nguồn>"}], type:null },
    listElementSource: [{ hashId, hashid: "<hashid NGUỒN>", fieldId: "<formIdNguồn>_<type-N>-Root-null-<modelerId>",
                          modelerId, userTaskId:null, label, type, infor:{userTaskName:"Form quy trình", formName:"<tên form nguồn>"} }]
  }
  ```
- Bản chất: field đích (form Duyệt) lấy giá trị field nguồn (form Start) qua `getValueForm(modelerId.hashidNguồn)`. Ở modeler
  mẫu, field đích `..._dropdown-4` ← nguồn `..._dropdown-4` (cùng type-số vì form Duyệt clone từ Start), khớp theo hashid.
- Vd node 2 (Duyệt) kế thừa 29 field từ form Start (formId nguồn `0000710eIm3i2QNgRxJgF44n4`).

**Bổ sung (xác minh 2026-10-23, BMW KHSXTC + SGC 00007mzImMIW2zVlrGe):**
- `fieldId` đích/nguồn = `id` field trong jsonForm (field trong subform nhúng giữ tiền tố id subform): `<id>-Target-null-null`, `<id>-Root-<sid|null>-<modelerId>`.
- `item` công thức: định dạng editor hiện tại = `<modelerId>.<hashid>` (nguồn là form Start) | `<modelerId>.<sid>.<hashid>` (nguồn là form user-task).
  Bản ghi cũ còn dạng `<hashid>` hoặc `<modelerId>.null.<hashid>` (tương đương). Một `sources[]` có thể gộp nhiều nguồn với công thức `conditions(...)`.
- Ghi: chưa có config thì `POST /variables-configs` (tạo), có `id` thì `PUT`. Body editor: `{id?, sources, userTaskId, versionId, modelerId, formId}` (+`type:"aggregate"`).
- Tool: `kyta eflow inherit list|auto|copy` (src/eflow/inherit.js). Dữ liệu tool sinh ra khớp từng byte 392 dòng định dạng mới trên server.

**Đóng gói tool — LƯU Ý (cũ):** phức tạp hơn các phần trước (phải sinh mapping từng field: khớp field đích↔nguồn + dựng formula/
hashid/fieldId đúng format). Hướng khả thi: (a) auto-match theo label/type giữa 2 form, (b) copy variables-config từ node
tương tự. CHƯA đóng tool — cần chốt chiến lược match.

### 3.4 Cấu hình nâng cao — gồm "Cấu hình thông báo" (mẫu mail, tiêu đề)

Tab **"Cấu hình nâng cao"** (tab 7 panel task) gồm nhiều sub-section, mỗi cái có nút **Lưu riêng**:
- **Cấu hình thuộc tính** — hiển thị read-only props BPMN của node (Node id, trình nghe thực thi, yếu tố được gọi,
  tham số vào/ra, kế thừa khoá nghiệp vụ...) — đọc từ `jsonXml`.
- **Cấu hình trả lại** (Cho phép trả lại) · **Cấu hình thu hồi bước** (Cho phép thu hồi).
- **Cấu hình thông báo** ← _phần chính topic này_:
  - Toggle **"Gửi thông báo email tự động"**.
  - **Mẫu thông báo** (dropdown) = chọn 1 **mail template** (vd đang chọn `Trên 500tr_Nhắc người soạn node kế tiếp`).
  - **Chủ đề** (subject) + nút **"Chèn biến"** (vd `[THÔNG BÁO KYTA]: NHIỆM VỤ CẦN XỬ LÝ`).
- **Cấu hình biểu mẫu** (popup xác nhận khi duyệt, lưu trường ẩn, trường thông tin chính...).
- **người thực hiện bypass** · **khi không có người thực hiện** · **người điều phối** · **ẩn/hiện nút** (Từ chối/Xác nhận/Thêm) · **tài liệu đính kèm**.

**NƠI LƯU (xác minh từ curl thật 2026-09-23):** toàn bộ tab "Cấu hình nâng cao" của 1 node lưu qua **1 endpoint riêng**:

### `PUT /services/idaas-eflow/api/advanced-config`
Khoá theo **`(modelerId, userTaskId)`**, có `id` bản ghi → update. Body dùng cặp **object + string** (giống pattern
attribute/attributeStr ở nơi khác): mỗi cụm có bản object và bản `...Str` = JSON.stringify.

Body top-level:
- `id` (id advanced-config), `modelerId`, `userTaskId`, `custId`, `orgIn`, timestamps.
- `infoConfig`/`infoConfigStr` — "Thiết lập trường thông tin chính" (mảng).
- `formConfig`/`formStr` — Cấu hình biểu mẫu, vd `{"saveHiddenField":true}`.
- `attribute`/`attributeStr` — gộp các mục con của tab:
  - `displayPopup` (popup xác nhận khi duyệt), `eID`
  - `bypassConfig` (người thực hiện bypass: executorType/executor/position/fieldForm/executorId/...)
  - `startSubprocessConfig` (`type` sequential/…, numberType, numberSubprocesses, fieldForm/formUserTask)
  - `rollbackConfig` (Cấu hình trả lại: `allowRollback`, `rollbackMethod`, `rollbackStep`, `notifyType`, `emailTemplate`)
  - `revokeConfig` (Thu hồi: `allowRevoke`, `notifyType`, `emailTemplate`)
  - `buttonVisibilityConfig` (ẩn/hiện nút: `[{value:"reject"/"confirm", name, isDefault, visible}]`)
  - `linkAccessConfig` (`type` relative, `duration`, `durationUnit`)
  - `attachmentConfig` (`type:["upload_file","upload_img"]`, `customFields`)
- **`notify`/`notifyStr` — CẤU HÌNH THÔNG BÁO (mục chính topic này):**
  - `autoNotify` (bool) — toggle "Gửi thông báo email tự động".
  - `subject` (string) — Chủ đề (vd `[THÔNG BÁO KYTA]: NHẮC NHỞ NHIỆM VỤ CẦN XỬ LÝ`).
  - `templateMail` — **object mail template ĐẦY ĐỦ nhúng nguyên** (`id`, `name`, `content` HTML, `status`, `typeSend`,
    `typeCreate`, `variables`, timestamps...). Khoá thực sự = `templateMail.id` (vd `000079yIgcOn580l4V` =
    "Trên 500tr_Nhắc người soạn node kế tiếp"). **Đây chính là mail-template ở service `email-template`** (tool mail quản lý).

→ **Đổi mẫu mail/tiêu đề thông báo của 1 node bằng tool:** GET advanced-config theo (modelerId,userTaskId) → sửa
`notify.templateMail` (nguyên object, lấy từ email-template API) + `notify.subject` + `autoNotify`, đồng bộ luôn
`notifyStr` = JSON.stringify(notify) → `PUT /advanced-config`. (Đây là mắt xích để tự động đổi mail giống việc đã làm
với workspace/<customer>/<env>/email: mail template ở đây tham chiếu qua id sang service email-template.)

**Phân biệt 2 tầng thông báo:**
- **Per-node** (advanced-config `notify`) — thông báo cho 1 user-task cụ thể (đang mổ ở trên).
- **Cấp modeler** (`modeler.attribute.templateMail`, mảng **16 sự kiện hệ thống**) — thông báo toàn quy trình. Đủ 16 `type`:
  `erequest_recipient_start`, `erequest_flow_start`, `erequest_flow_finish`, `erequest_recipient_finish`,
  `erequest_ticket_remind_workflow`, `erequest_ticket_remind_workflow_overdue_onetime`, `erequest_ticket_remind_usertask`,
  `erequest_ticket_remind_usertask_overdue_period`, `erequest_ticket_assign_user`, `erequest_ticket_cancel`,
  `erequest_ticket_update`, `erequest_ticket_tag_comment`, `erequest_ticket_reject`,
  `erequest_ticket_remind_usertask_overdue_onetime`, `erequest_acl_process`, `erequest_recipient_start_external`
  — mỗi phần tử `{name, type, status, subject, templateId}`.

**Ghi chú tách bạch save (cho tool):** editor còn có `PUT /processes/update/{modelId}` (lưu jsonXml lên S3, trả URL) và
`POST /modelers/validation` (validate trước lưu). Nhưng cấu hình nâng cao per-node đi RIÊNG qua `/advanced-config`,
KHÔNG nằm trong jsonXml/modeler — nên tool đọc/sửa notify phải gọi `/advanced-config`, không đụng jsonXml.

### Đọc advanced-config + list mẫu mail (xác minh 2026-09-23)
- **GET đọc:** `GET /services/idaas-eflow/api/advanced-config/userTask/{modelerId}/{userTaskId}` → trả object đầy đủ:
  `{ id, modelerId, userTaskId, infoConfig, formConfig, attribute, notify, custId, orgIn, timestamps }`.
  **Trên GET các field `...Str` (`infoConfigStr/formStr/attributeStr/notifyStr`) = `null`** (server trả bản object).
  Khi **PUT** thì FE điền `...Str` = `JSON.stringify(<object tương ứng>)` và gửi kèm cả 2. `id` dùng để update.
  (Nếu node chưa có config, GET có thể trả rỗng/null → PUT với `id=null` để tạo.)
- **List mẫu mail cho dropdown:** `POST /services/email-template/api/search-template?page=0&size=10000` (service
  `email-template` — CÙNG service tool mail dùng; tool mail hiện dùng `GET .../templates`, đây là biến thể search).
- Panel mở còn gọi `GET uaa/api/account`, `GET uaa/api/organizations/child/find-organization-like-orgin?orgIn=`,
  `POST uaa/api/search/userInfoModel?...&role=true` (dữ liệu cho các mục bypass/điều phối).

**⇒ Quy trình đổi mẫu mail + tiêu đề thông báo của 1 node (đủ để code lệnh tool):**
1. `GET /advanced-config/userTask/{modelerId}/{userTaskId}` → lấy object hiện tại (kèm `id`).
2. Lấy template đích từ `POST /services/email-template/api/search-template` (hoặc `GET email-template/api/templates`).
3. Sửa `notify.autoNotify`, `notify.subject`, `notify.templateMail = <object template đầy đủ>`.
4. Set `notifyStr = JSON.stringify(notify)` (và giữ nguyên các `...Str` khác nếu sửa cụm khác).
5. `PUT /services/idaas-eflow/api/advanced-config` với nguyên object (kèm `id`).

### 3.5 Điều kiện trên dây (SequenceFlow) (xác minh 2026-10-23: 169 điều kiện thật trong 21 quy trình, round-trip khớp từng byte)

Tool: `kyta eflow cond list|fields|set` (src/eflow/condition.js). `set` chỉ sửa `flow.json` local, sau đó đẩy bằng `eflow push`.
- `shape.properties.conditionsequenceflow` = `""` (không điều kiện) | `{ expression: { type:"static", staticValue:"${JUEL}", xml:"<xml…Blockly…>" } }`.
  Editor sinh **cả 2** từ cây block nên khi sửa phải ghi đồng bộ cả hai.
- Biến field = `execution.getVariable("<scope>.<id field>")`, với `scope` = **id modeler** (field form Start) hoặc **sid node** (field form user-task).
- Block Blockly (gốc luôn là `test_block id="rootBlockId" deletable/movable/editable="false" x="30" y="0"`, bản cũ x="0"):
  | block | JUEL |
  |---|---|
  | `compare_block` (`OP`: `==` `>` `<` `>=` `<=`, không có `!=`) | `(L OP R)` |
  | `and_or_block` (`<mutation ops="n">`, `OPR1..n` AND/OR, `OPD0..n`) | `(a && b \|\| c)` |
  | `not_block` (`INPUT`) | `(! X)` |
  | `field_<scope>.<id>` | `execution.getVariable("…")` |
  | `string_input_block` / `number_input_block` / `boolean_input_block` (`INPUT`) | `"chuỗi"` (KHÔNG escape) / số (rỗng → 0) / bool |
- Id block: 20 ký tự ngẫu nhiên (Blockly genUid). Giá trị text trong xml escape `& < >`.
- Editor còn có block `includes_block`, `math_block`, `concat_block`, `index_of_block`, biến hệ thống `execution.getVariable("attrs")["system_…"]`.
  Chưa gặp trong dữ liệu thật nên tool chưa hỗ trợ.

### 3.6 Notify task (`eNotify`) — cấu hình gửi thông báo (entity `template-config-mails`)

Node `eNotify` ("notify task", dùng RẤT nhiều ở saigoncoop — modeler mẫu có 24 cái). Config KHÔNG nằm trong jsonXml
(node chỉ có plumbing chung); lưu ở entity **`template-config-mails`**, khoá `(modelerId, userTaskId)`. 1 eNotify có
thể có **NHIỀU dòng** config (mỗi dòng = 1 thông báo gửi đi).

- **Đọc:** `GET /services/idaas-eflow/api/template-config-mails/user-task/{modelerId}/{userTaskId}` → Spring Page
  `{content:[cfg...], ...}`.
- Panel mở còn gọi: `POST /services/email-template/api/search-template` (list mẫu mail), `GET uaa/.../find-organization-like-orgin`
  (phòng ban), `GET forms/list/e-form` + `forms/external/modeler` (trường form cấp người nhận).
- **Ghi (xác minh 2026-09-23 từ curl thật + verify CLI):** dùng **`multipart/form-data`**, 1 part tên **`templateConfigMail`**
  = **chuỗi JSON** của object config. KHÔNG phải JSON body trực tiếp (gửi JSON body → 400 "Required String parameter
  'templateConfigMail' is not present"; gửi form-urlencoded → 500 NPE). Node: `const fd=new FormData(); fd.append('templateConfigMail', JSON.stringify(obj)); fetch(url,{method,body:fd})`.
  - **Tạo:** `POST /template-config-mails` (JSON có `id:null`).
  - **Sửa:** `PUT /template-config-mails` (JSON có `id`) — đã verify 200, reversible.
  - **Xoá:** `DELETE /template-config-mails/{id}` (suy pattern; chưa verify).
  - JSON gửi là **subset "sạch"** (KHÔNG kèm orgIn/custId/createdDate/lastModified — server tự điền). Các field gửi:
    `id, modelerId, userTaskId, templateId, templateName, type, subject, mailType, brandName, accountZalo, zaloId,
    phoneNumber, infoReceiver, subsystem, conditionText, inheritField, configTime, document`.

**Cấu trúc 1 dòng config (xác minh 2026-09-23, node eNotify `sid-AD07029D...`):**
- `id`, `modelerId`, `userTaskId`, `orgIn`, `custId`, timestamps.
- `templateId` + `templateName` — **mail template** (service email-template; vd `000070eI6iAay5NleR`).
- `mailType`: vd `system_email`. `type`: kênh gửi — `email` (còn `zalo`/sms: các field `subsystem, accountZalo, brandName, zaloId, phoneNumber`).
- `subject` — tiêu đề.
- **`infoReceiver`** — NGƯỜI NHẬN, object `{type, department, infoPerson, email, roles, fields, userTaskIds}`; `type`
  quyết định field nào dùng (xác minh từ dữ liệu thật saigoncoop 2026-09-23):
  - `type:"form"` → `fields:[{name,type,formId,hashid,fieldId,modelerId,versionId,userTaskId}]` (email lấy từ 1 trường form; vd `textField-24`).
  - `type:"account"` → `infoPerson:[{userId,email,fullName,phone,orgIn,custId,avatar,haveAvatar}]` (người cụ thể) VÀ/HOẶC
    `department:[{name,orgIn,custId}]` (cả phòng ban). (Modeler mẫu chỉ dùng 2 type form + account.)
  - `type:"role"` → `roles:[{id,code,name,custId}]` (shape từ uaa roles/search) — xác minh 2026-09-23.
  - `type:"implementStep"` (theo bước) → `userTaskIds:["<node sid>",...]` (người thực hiện của (các) bước) — xác minh 2026-09-23.
  - `type:"account"` cũng có thể kèm `department:[{name,orgIn,custId}]`. Còn `email` (nhập tay) chưa gặp riêng.
- `infoCc` — CC (cùng shape infoReceiver). `attachFile` / `document` — đính kèm.
- **`configTime`** — THỜI ĐIỂM gửi (biến thể đã thấy):
  - `{type:"createdDateTicket", typeSendTime:"after", ...}` — tính từ lúc tạo ticket.
  - `{type:"endStep", typeSendTime:"after", userTaskId:"sid-...", ...}` — sau khi kết thúc 1 bước (userTaskId = bước đó).
  - Field: `type`, `typeSendTime`(after/before), `startTime`, `field`, `userTaskId`, `cycleTime`+`cycleTimeISO`(vd "R0"),
    `durationTime`+`durationTimeISO`(vd "PT1S" = 1 giây, "" = ngay). Các `type` khác (theo field ngày, chu kỳ lặp) chưa map hết.
- `conditionText` — điều kiện gửi. `inheritField` — kế thừa.

→ Đây là mắt xích tự động hoá đổi mẫu mail eNotify hàng loạt (giống task mail đầu tiên): `templateId` trỏ sang service
email-template.

**ĐÃ ĐÓNG GÓI THÀNH TOOL (2026-09-23)** — modeler/node nhận TÊN hoặc id/sid (tự resolve):
```
kyta eflow notify list-all  <customer> <env> <modeler(tên|id)> [--grep "template/subject"]   # MỌI eNotify (kể cả "(chưa cấu hình)")
kyta eflow notify list      <customer> <env> <modeler> <node(tên|sid)> | --after "<node>"     # config của 1 node
kyta eflow notify templates <customer> <env> [--grep "x"]                                      # tra id mẫu mail
kyta eflow notify add       <customer> <env> <modeler> <node>|--after "<node>" --template "..." (--recv-user "email,.."|--recv-copy-from <config-id>) [--subject] [--time-from-ticket|--time-after-step "<node>"] [--dry-run]
kyta eflow notify set       <customer> <env> <modeler> <node>|--after "<node>" [--config-id ID] [--template][--subject][--recv-user][--recv-copy-from][--time-from-ticket|--time-after-step][--dry-run]
kyta eflow notify rm        <customer> <env> <config-id> [--dry-run]
```
- **Định vị node**: positional (tên|sid) HOẶC **`--after "<node>"`** — lần theo dây (BFS ≤5 hop) tới eNotify đứng sau node đó
  (giải quyết việc eNotify tên rỗng, khỏi mò sid). `list-all` hiện cả node **chưa cấu hình** để thấy node mới.
- **`add`** tạo dòng config mới (POST) trên node chưa/đã cấu hình; **`rm`** xoá 1 dòng (DELETE — đã verify).
- Người nhận `add`/`set` — 5 kiểu (helper chung `buildReceiver`):
  - `--recv-user "email,.."` → account (resolve email→infoPerson qua uaa).
  - `--recv-role "tên|mã,.."` → role (resolve qua uaa roles/search → `roles:[{id,code,name,custId}]`).
  - `--recv-step "<node tên|sid>,.."` → implementStep (`userTaskIds`).
  - `--recv-form "form" --recv-field "trường"` → form: đọc `forms/list/e-form?modelerId=`, tìm form theo id|formCode|formName,
    parse `jsonForm` tìm field theo id|label → dựng field-object. Xem trường: `kyta eflow notify fields <customer> <env> <modeler> --form "..."`.
  - `--recv-copy-from <config-id>` → sao chép infoReceiver từ dòng khác (mọi kiểu).
- Đã test thật trên "Quy trình test": list-all/--after/fields/add(POST)+list+rm(DELETE)/set(recipient account+form+role+step+timing) + revert — tất cả OK.
- CHƯA: recipient `email` nhập tay; nhiều field cùng lúc (recv-form hiện 1 field); configTime kiểu theo field ngày/chu kỳ lặp.
`set` sửa 1 dòng config (node nhiều dòng → `--config-id`), ghi qua `PUT` multipart. Các thay đổi hỗ trợ (đã test thật
trên "Quy trình test", có revert):
- Nội dung: `--template "tên|id"`, `--subject "..."`
- Người nhận: `--recv-user "email[,email]"` (kiểu account → infoPerson) · `--recv-copy-from <config-id>` (sao chép
  infoReceiver từ dòng khác — hợp MỌI kiểu, kể cả form)
- Thời điểm: `--time-from-ticket` (createdDateTicket) · `--time-after-step "<node tên|sid>"` (endStep + userTaskId)
- `--dry-run` cho mọi thay đổi.

CHƯA làm: recipient kiểu `role`/`email` nhập tay/`userTaskIds` (chưa verify shape — dùng `--recv-copy-from` nếu đã có mẫu);
`--recv-form-field` tạo mới từ số 0 (cần form def — tạm dùng copy-from); tạo/xoá dòng config; configTime kiểu theo field ngày/chu kỳ lặp.
