# API tra cứu danh sách yêu cầu mua hàng (PR)

Selector `kyta_bmw_search_pr`: trả **danh sách** PR theo bộ lọc, có phân trang — phục vụ các nhu cầu tra cứu 5, 6, 7, 8, 9.
Lấy chi tiết 1 PR (đầy đủ dòng, phân bổ, tên trường SAP): selector `kyta_bmw_get_pr` (`kyta_bmw_get_pr.md`).

## Endpoint

```
POST https://econtract.sandbox.kytaplatform.com/app/services/excall-internal/api/excall
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

```json
{ "selector": "kyta_bmw_search_pr", "body": { ... } }
```

## Khái niệm

| Khái niệm | Trường | Ý nghĩa |
|---|---|---|
| Mã ngân sách | `projectCode` | mã dự án; một mã ngân sách có nhiều PR |
| Phiên bản | `budgetSeq` | thứ tự PR trong cùng mã ngân sách: PR tạo đầu tiên = `1`, tiếp theo = `2`…; tính theo thời điểm tạo, **tính cả PR đã huỷ**, nên số của một PR không đổi về sau |
| Ngày lập phiếu | `requisitionDate` | ngày người lập chọn trên phiếu (`yyyy-MM-dd`) |
| Thời điểm tạo | `createdDate` | thời điểm hệ thống lưu PR (ISO-8601 UTC), hệ thống tự ghi |
| Trạng thái | `statusCode` | `DRAFT` nháp · `SUBMITTED` chờ duyệt · `APPROVED` đã duyệt · `REJECTED` bị từ chối · `CANCELLED` huỷ · `CLOSED` đã đóng |

## Nhu cầu → cách gọi

| # | Nhu cầu | Body |
|---|---|---|
| 5 | PR tạo trong khoảng thời gian | `{"requisitionDateFrom": "2026-10-01", "requisitionDateTo": "2026-10-31"}` (ngày lập phiếu) hoặc `{"createdFrom": "2026-10-01T00:00:00Z", "createdTo": "2026-11-01T00:00:00Z"}` (thời điểm tạo) |
| 6 | PR tạo theo 1 orgchat | `{"orgIn": "/84"}` |
| 6 | PR tạo bởi orgchat và các org con | `{"orgIn": "/84", "includeChildOrgs": "true"}` |
| 7 | PR thuộc 1 BCH | `{"subProjectCode": "BCH-01"}` |
| 8 | PR theo 1 BCH / 1 dự án / 1 orgchat / orgchat + phòng ban con | `{"subProjectCode": "BCH-01"}` / `{"projectCode": "WBS-001"}` / `{"orgIn": "/84"}` / `{"orgIn": "/84", "includeChildOrgs": "true"}` |
| 9 | PR thuộc 1 trung tâm chi phí | `{"costCenter": "KH0100"}` |
| — | Mọi phiên bản của 1 mã ngân sách | `{"projectCode": "WBS-001", "sort": "createdDate,asc"}` |
| — | Kết hợp | gửi nhiều trường cùng lúc, PR phải khớp tất cả |

## Input

Mọi trường tuỳ chọn, so khớp chính xác.

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `orgIn` | string | orgchat người tạo, vd `/84` |
| `includeChildOrgs` | `"true"` / `"false"` | gồm cả org con của `orgIn` |
| `requesterEmail` | string | email người tạo |
| `ticketId` | string | ID ticket |
| `docType` | string | loại chứng từ PR, vd `NB` |
| `projectCode` | string | mã dự án (mã ngân sách) |
| `subProjectCode` | string | mã BCH |
| `requisitionDateFrom`, `requisitionDateTo` | string `yyyy-MM-dd` | ngày lập phiếu, gồm cả hai đầu |
| `createdFrom`, `createdTo` | string ISO-8601 UTC | thời điểm tạo: `createdFrom` ≤ t < `createdTo` |
| `needByFrom`, `needByTo` | string `yyyy-MM-dd` | ngày cần hàng |
| `statusCode` | string | trạng thái |
| `externalRef` | string | số PR SAP |
| `itemCode` | string | mã vật tư ¹ |
| `itemGroup` | string | nhóm vật tư ¹ |
| `supplierCode` | string | nhà cung cấp ¹ |
| `siteCode` | string | nhà máy ¹ |
| `companyCode` | string | mã công ty ¹ |
| `purchasingOrg` | string | tổ chức mua ¹ |
| `purchasingGroup` | string | nhóm mua ¹ |
| `costCenter` | string | trung tâm chi phí |
| `page` | number | trang, mặc định `0` |
| `size` | number | số bản ghi/trang, mặc định `20`, tối đa `100` |
| `sort` | string | `<trường>,asc` / `<trường>,desc`, mặc định `createdDate,desc`; trường: `createdDate`, `requisitionDate`, `needByDate`, `statusCode`, `docType`, `requesterEmail`, `totalAmount` |

¹ Lọc theo dòng PR: gửi nhiều trường loại này thì **cùng một dòng** phải khớp tất cả.

```json
{
  "selector": "kyta_bmw_search_pr",
  "body": {
    "projectCode": "WBS-001",
    "subProjectCode": "BCH-01",
    "requisitionDateFrom": "2026-10-01",
    "requisitionDateTo": "2026-10-31",
    "orgIn": "/84",
    "includeChildOrgs": "true",
    "page": 0,
    "size": 20
  }
}
```

## Output

`result` (chuỗi JSON, parse thêm 1 lần):

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `total` | number | tổng số PR khớp |
| `page`, `size` | number | trang, cỡ trang |
| `items[]` | array | thông tin cơ bản từng PR (bảng dưới) |

Mỗi phần tử `items[]` luôn đủ khoá theo thứ tự dưới, không có giá trị thì `null`:

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `orgIn` | string | orgchat người tạo |
| `requesterEmail` | string | email người tạo |
| `id` | string | ID PR |
| `docType` | string | loại chứng từ PR |
| `projectCode` | string | mã dự án (mã ngân sách) |
| `subProjectCode` | string | mã BCH |
| `budgetSeq` | number | phiên bản; `null` khi PR không có mã dự án |
| `statusCode` | string | trạng thái |
| `requisitionDate` | string `yyyy-MM-dd` | ngày lập phiếu |
| `needByDate` | string `yyyy-MM-dd` | ngày cần hàng |
| `currency` | string | tiền tệ |
| `totalAmount` | number | tổng tiền |
| `ticketId` | string | ID ticket tạo PR |
| `externalRef` | string | số PR SAP |
| `createdDate` | string ISO-8601 UTC | thời điểm tạo |

```json
{
  "id": "e9a03559-0176-42b1-a081-d013b18ed726",
  "refId": null,
  "code": "0",
  "message": "Tra cuu thanh cong",
  "result": "{\"total\":1,\"page\":0,\"size\":20,\"items\":[...]}",
  "response": null
}
```

`result` sau khi parse:

```json
{
  "total": 1,
  "page": 0,
  "size": 20,
  "items": [
    {
      "orgIn": "/84",
      "requesterEmail": "nguoitao@bmwindow.vn",
      "id": "1m4hECQ2lq84bzH8g",
      "docType": "NB",
      "projectCode": "WBS-001",
      "subProjectCode": "BCH-01",
      "budgetSeq": 1,
      "statusCode": "SUBMITTED",
      "requisitionDate": "2026-10-01",
      "needByDate": "2026-11-01",
      "currency": "VND",
      "totalAmount": 2000.0,
      "ticketId": "00007XrIpEhvVJm8bv0",
      "externalRef": "1200000000",
      "createdDate": "2026-10-12T18:33:14Z"
    }
  ]
}
```

## Mã lỗi

Khi lỗi, `result` chứa lại nội dung lỗi (không phải JSON) — chỉ parse `result` khi `code = "0"`.

```json
{ "id": "…", "refId": null, "code": "14", "message": "page phai la so: x", "result": "page phai la so: x", "response": null }
```

| `code` | Ý nghĩa | `message` |
|---|---|---|
| `0` | thành công | `Tra cuu thanh cong` |
| `14` | thiếu body | `Thieu body` |
| `14` | body có `id`/`budgetSeq` (muốn lấy chi tiết) | `Lay chi tiet 1 PR dung selector kyta_bmw_get_pr` |
| `14` | `page`/`size` không phải số | `<trường> phai la so: <giá trị>` |
| `14` | tham số lọc/sắp xếp sai | nội dung lỗi |
| `13` | lỗi hệ thống — gọi lại sau | nội dung lỗi |

## Curl mẫu

```bash
# Nhu cau 7: PR thuoc 1 BCH
curl -s -X POST 'https://econtract.sandbox.kytaplatform.com/app/services/excall-internal/api/excall' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' -H 'Content-Type: application/json' \
  -d '{"selector":"kyta_bmw_search_pr","body":{"subProjectCode":"BCH-01"}}' | jq -r .result | jq .

# Moi phien ban cua 1 ma ngan sach
curl -s -X POST 'https://econtract.sandbox.kytaplatform.com/app/services/excall-internal/api/excall' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' -H 'Content-Type: application/json' \
  -d '{"selector":"kyta_bmw_search_pr","body":{"projectCode":"WBS-001","sort":"createdDate,asc"}}' | jq -r .result | jq .
```
