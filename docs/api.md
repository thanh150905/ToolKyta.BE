# API Kyta Platform — ghi chú đã xác minh

Tổng hợp từ request thật của modeler (chủ yếu saigoncoop/sandbox). Code gọi API nằm ở `src/<phân hệ>/api.js`.
Cấu trúc `jsonXml` của eFlow xem [eflow-schema.md](eflow-schema.md). Postman: [postman/](postman/).

## Host & đăng nhập

| Service | Host (sandbox) | Ghi chú |
|---|---|---|
| account (login, email-template) | `eaccount.sandbox.kytaplatform.com` | suy từ host eform: `eform` → `eaccount` |
| eform | `eform.sandbox.kytaplatform.com` | khai trong `config/kyta.json` |
| eflow (idaas-eflow, uaa qua gateway) | `eflow.sandbox.kytaplatform.com` | suy từ host eform: `eform` → `eflow` |
| portal (link trong mail) | `erequest.sandbox.kytaplatform.com` | khai `portal` trong `config/kyta.json` |
| eworkspace | `econtract.sandbox.kytaplatform.com/workspace/services` | host/context riêng theo môi trường, khai trong `config/kyta.json` |

- `POST {account}/auth/login` — body theo `auth.bodyTemplate`. Có `Set-Cookie` → dùng cookie, không thì lấy token trong body (Bearer).
- Token/cookie của eaccount dùng được cross-host sang eform/eflow (SSO idaas).
- `401` → tool tự đăng nhập lại 1 lần. `403` ở eform thường do form đang mở ở tab modeler (bị khoá).

## eForm — `/services/eform/api`

| Method | Path | Việc |
|---|---|---|
| GET | `/common/check-edit?formId=ID` | kiểm tra/khoá quyền sửa |
| GET | `/forms/{id}/code` | code động `{ key: { code, order } }` |
| PUT | `/forms/{id}/code` | lưu code động — body JSON nhưng `Content-Type: text/plain` |
| GET | `/owner/form?formId=ID` | full form, `jsonForm` chứa custom UI (`customRenderCode.{html,css,js}`); `jsonFormCondition` = cấu hình điều kiện (chuỗi) |
| PUT | `/owner/form` | lưu full form (9 field; kèm `jsonFormCondition` chuỗi để lưu điều kiện — bỏ qua thì server giữ nguyên) |
| POST | `/owner/form` | **tạo form mới** — body như PUT nhưng KHÔNG có `formId` (server sinh), `jsonForm:"[]"`; trả form mới |
| GET | `/common/checkId?formId=CODE` | kiểm tra mã form: 404 = chưa dùng, 200 = đã tồn tại |
| DELETE | `/forms/{id}` | xoá hẳn form |
| POST | `/owner/find-form?page=0&size=N` | form sở hữu |

Bẫy đã gặp:
- `PUT /forms/{id}/code` là **FULL-REPLACE**: key không gửi kèm bị xoá trên server (xác minh 2026-09-06).
- `PUT /owner/form` phải gửi **đúng 9 field** như modeler (`beginTime, describeForm, endTime, formCode, formName, formId, tag, jsonForm, variableArr`), `tag` là string, `variableArr` là array, ngày `yyyy/MM/dd`. Gửi nguyên object GET → `400 Unable to convert http message`. Payload này không chứa code động → push UI không đụng code.
- `find-form` phải gửi đủ khung filter (gửi `{}` thì bản demo trả rỗng); vài gateway chỉ nhận GET (405).
- `jsonForm` có thể là chuỗi JSON double-encoded → parse rồi serialize lại đúng dạng gốc.
- Cấu hình field (label, `validate.required`, `readonly`, `display`, `dropdownConfig`...) nằm trong node của `jsonForm`; tool kéo về `fields.json` và push cùng đường `PUT /owner/form`. Định vị field theo `hashid` (bền) → `key`. Schema từng loại field: [eform-fields-schema.md](eform-fields-schema.md).

## Email — `/services/email-template/api` (host account)

| Method | Path | Việc |
|---|---|---|
| GET | `/templates?page=&size=` | danh sách |
| GET | `/templates/{id}` | 1 mẫu (full) |
| POST | `/templates` | tạo |
| PUT | `/templates` | sửa — body FULL object, id trong body |

Engine mail không cho bơm base-url động → tool đổi domain `erequest*` / IP `10.14.121.10` theo env đích lúc push.

## eFlow — `/services/idaas-eflow/api`

| Method | Path | Việc |
|---|---|---|
| POST | `/modeler/search-elastic?page=&size=&sort=` body `{textSearch, shared:"false"}` | danh sách (jsonXml = null) |
| GET | `/modelers/{id}` | full modeler (jsonXml + version) |
| PUT | `/modelers?status=active\|unpublic` | lưu FULL object; `active` = publish |
| GET | `/forms/list/e-form?modelerId=&userTaskId=` | eForm của quy trình |
| GET / POST / DELETE | `/implementer/user-task/{userTaskId}/{processId}` · `/implementer` · `/implementer/{id}` | người thực hiện |
| GET / POST / PUT / DELETE | `/template-config-mails/user-task/{modelerId}/{userTaskId}` · `/template-config-mails` · `/{id}` | thông báo eNotify — ghi bằng **multipart**, field `templateConfigMail` = chuỗi JSON |
| POST | `/services/uaa/api/roles/search`, `/services/uaa/api/search/userInfoModel` | tra role / user |
| POST | `/services/email-template/api/search-template` | tra mẫu mail |

Bẫy đã gặp:
- `processId` của implementer = `modelId` trong jsonXml, **khác** id modeler.
- Khi lưu modeler, editor gửi `attributeStr = JSON.stringify(attribute)` — thiếu thì mất cấu hình.


## eWorkspace — dashboard và người dùng

Các API tra user theo email, thêm một dashboard cho một user và gỡ mọi dashboard của danh sách user được ghi tại [eworkspace-schema.md](eworkspace-schema.md). Lookup dùng Cookie access_token; create/delete dùng Bearer.
