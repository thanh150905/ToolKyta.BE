# API lấy chi tiết 1 yêu cầu mua hàng (PR) theo trường SAP

Selector `kyta_bmw_get_pr`: lấy **toàn bộ dữ liệu 1 PR** (header + dòng + phân bổ) và trả theo **tên trường SAP / code form BMW**,
để đổ vào eForm hoặc dựng body gửi SAP — phục vụ nhu cầu 4 (chi tiết PR theo ID PR KYTA và phiên bản).
Tra cứu danh sách: selector `kyta_bmw_search_pr` (`kyta_bmw_search_pr.md`).

## Endpoint

```
POST https://econtract.sandbox.kytaplatform.com/app/services/excall-internal/api/excall
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

```json
{ "selector": "kyta_bmw_get_pr", "body": { ... } }
```

## Input

| Trường | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `id` | string | ✔ (hoặc cặp dưới) | ID PR KYTA (trường `id` của danh sách) |
| `projectCode` + `budgetSeq` | string + number | ✔ khi không có `id` | PR phiên bản `budgetSeq` của mã ngân sách (mã dự án) `projectCode` |
| `budgetSeq` | number | | đi cùng `id`: phiên bản mong đợi; PR không đúng phiên bản ⇒ lỗi |

Phiên bản = thứ tự PR trong cùng mã ngân sách (PR tạo đầu tiên = `1`), tính cả PR đã huỷ.

```json
{ "selector": "kyta_bmw_get_pr", "body": { "id": "120h1sP1xBLeNahaO" } }
```

```json
{ "selector": "kyta_bmw_get_pr", "body": { "projectCode": "WBS-001", "budgetSeq": 2 } }
```

## Output

`result` (chuỗi JSON, parse thêm 1 lần) = header + trường riêng BMW của header + `_PurchaseRequisitionItem[]`.

### Header

Luôn đủ các khoá dưới, không có giá trị thì `null`.

| Trường SAP / form BMW | Kiểu | Ý nghĩa | Trường KYTA |
|---|---|---|---|
| `id` | string | ID PR KYTA | `id` |
| `ticketId` | string | ID ticket tạo PR | `ticketId` |
| `orgIn` | string | orgchat người tạo | `orgIn` |
| `statusCode` | string | trạng thái: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED`, `CLOSED` | `statusCode` |
| `budgetSeq` | number | phiên bản (thứ tự PR trong mã ngân sách) | tính khi tra |
| `PurchaseRequisition` | string | số PR SAP | `externalRef` |
| `PurchaseRequisitionType` | string | loại chứng từ PR | `docType` |
| `PurReqnDescription` | string | nội dung yêu cầu mua hàng | `description` |
| `Creator` | string | email người tạo | `requesterEmail` |
| `RequisitionerName` | string | tên người yêu cầu | `requesterName` |
| `DateCreate` | string `yyyy-MM-dd` | ngày lập phiếu | `requisitionDate` |
| `WBSElement` | string | mã dự án (mã ngân sách) | `projectCode` |
| `WBSElement_LV2` | string | mã BCH | `subProjectCode` |
| `needByDate` | string `yyyy-MM-dd` | ngày cần hàng | `needByDate` |
| `currency` | string | tiền tệ | `currency` |
| `totalAmount` | number | tổng tiền | `totalAmount` |
| `createdDate` | string ISO-8601 UTC | thời điểm tạo trên KYTA | `createdDate` |
| *trường riêng BMW* | | `PurReqnHeaderNote`, `Fieldplus1..10`, `PurchaseRequisitionItemPR`… — nguyên tên đã lưu | `ext` |

### `_PurchaseRequisitionItem[]` (dòng)

Trường trống không trả về.

| Trường SAP | Kiểu | Ý nghĩa | Trường KYTA |
|---|---|---|---|
| `PurchaseRequisitionItem` | string 5 chữ số | số thứ tự dòng, vd `00010` | `lineNo` |
| `PurchasingDocumentItemCategory` | string | loại dòng chứng từ | `itemType` |
| `Material` | string | mã vật tư | `itemCode` |
| `PurchaseRequisitionItemText` | string | tên vật tư | `itemName` |
| `PlainLongText` | string | Material PO Text | `itemDesc` |
| `MaterialGroup` | string | nhóm vật tư | `itemGroup` |
| `RequestedQuantity` | number | số lượng yêu cầu | `quantity` |
| `BaseUnit` | string | đơn vị tính | `uom` |
| `PurchaseRequisitionPrice` | number | đơn giá dự kiến | `unitPrice` |
| `PurReqnPriceQuantity` | number | số lượng ứng với đơn giá | `priceUnit` |
| `PurReqnItemCurrency` | string | tiền tệ dòng | `currency` |
| `DeliveryDate` | string `yyyy-MM-dd` | ngày giao mong muốn | `needByDate` |
| `Supplier` | string | nhà cung cấp đề xuất | `supplierCode` |
| `Plant` | string | nhà máy | `siteCode` |
| `StorageLocation` | string | kho | `storageLocation` |
| `CompanyCode` | string | mã công ty | `companyCode` |
| `PurchasingOrganization` | string | tổ chức mua | `purchasingOrg` |
| `PurchasingGroup` | string | nhóm mua | `purchasingGroup` |
| `IsDeleted` | boolean | dòng đã huỷ | `statusCode = CANCELLED` |
| `lineAmount` | number | thành tiền dòng | `lineAmount` |
| `externalLineRef` | string | số dòng phía SAP | `externalLineRef` |
| *trường riêng BMW* | | `AccountAssignmentCategory`, `SupplierMaterialNumber`, `Batch`, mọi `YY1_*`… — nguyên tên và kiểu đã lưu | `ext` |
| `_PurchaseReqnAcctAssgmt[]` | array | phân bổ hạch toán | `allocations` |

### `_PurchaseReqnAcctAssgmt[]` (phân bổ)

Trường trống không trả về.

| Trường SAP | Kiểu | Ý nghĩa | Trường KYTA |
|---|---|---|---|
| `PurchaseReqnAcctAssgmtNumber` | string 2 chữ số | số thứ tự phân bổ, vd `01` | `allocNo` |
| `CostCenter` | string | trung tâm chi phí | `costCenter` |
| `WBSElementExternalID` | string | mã dự án của phân bổ | `projectCode` |
| `WBSElement_LV2` | string | mã BCH của phân bổ | `subProjectCode` |
| `GLAccount` | string | tài khoản GL | `glAccount` |
| `ProfitCenter` | string | trung tâm lợi nhuận | `profitCenter` |
| `Quantity` | number | số lượng | `quantity` |
| `MultipleAcctAssgmtDistrPercent` | number | tỉ lệ % | `percent` |
| `PurReqnNetAmount` | number | số tiền | `amount` |
| *trường riêng BMW* | | `BaseUnit`, `IsDeleted`, `NetworkActivity`, `MasterFixedAsset`… | `ext` |

### Mẫu

```json
{
  "id": "27ae0173-a29d-4921-bc81-294af644d450",
  "refId": null,
  "code": "0",
  "message": "Lay PR thanh cong",
  "result": "{\"id\":\"120h1sP1xBLeNahaO\", ... }",
  "response": null
}
```

`result` sau khi parse:

```json
{
  "id": "120h1sP1xBLeNahaO",
  "ticketId": "00007XrIpEhvVJm8bv0",
  "orgIn": "/84",
  "statusCode": "SUBMITTED",
  "PurchaseRequisition": "1200000000",
  "PurchaseRequisitionType": "NB",
  "PurReqnDescription": "Mua thep",
  "Creator": "nguoitao@bmwindow.vn",
  "RequisitionerName": null,
  "DateCreate": "2026-10-03",
  "WBSElement": "WBS-001",
  "WBSElement_LV2": "BCH-01",
  "needByDate": "2026-11-03",
  "currency": "VND",
  "totalAmount": 2000.0,
  "createdDate": "2026-10-12T18:33:15Z",
  "budgetSeq": 2,
  "PurReqnHeaderNote": "ghi chu",
  "Fieldplus1": "x1",
  "_PurchaseRequisitionItem": [
    {
      "PurchaseRequisitionItem": "00010",
      "Material": "M1",
      "PurchaseRequisitionItemText": "Thep",
      "MaterialGroup": "5014",
      "RequestedQuantity": 2.0,
      "BaseUnit": "KG",
      "PurchaseRequisitionPrice": 1000.0,
      "PurReqnItemCurrency": "VND",
      "Supplier": "1000013",
      "Plant": "V001",
      "CompanyCode": "V000",
      "PurchasingOrganization": "V000",
      "lineAmount": 2000.0,
      "IsDeleted": false,
      "YY1_SlngMOQ_PRI": 3,
      "AccountAssignmentCategory": "K",
      "_PurchaseReqnAcctAssgmt": [
        {
          "PurchaseReqnAcctAssgmtNumber": "01",
          "CostCenter": "KH0100",
          "WBSElementExternalID": "WBS-001",
          "GLAccount": "51100000",
          "BaseUnit": "KG",
          "IsDeleted": false
        }
      ]
    }
  ]
}
```

## Mã lỗi

Khi lỗi, `result` chứa lại nội dung lỗi (không phải JSON) — chỉ parse `result` khi `code = "0"`.

```json
{ "id": "…", "refId": null, "code": "14", "message": "Khong tim thay PR", "result": "Khong tim thay PR", "response": null }
```

| `code` | Ý nghĩa | `message` |
|---|---|---|
| `0` | thành công | `Lay PR thanh cong` |
| `14` | thiếu body | `Thieu body` |
| `14` | thiếu `id` và thiếu cặp `projectCode` + `budgetSeq` | `Can id, hoac projectCode + budgetSeq` |
| `14` | `id` sai định dạng | `id khong hop le: <giá trị>` |
| `14` | không có PR (theo `id`, hoặc mã ngân sách chưa có phiên bản đó) | `Khong tim thay PR` |
| `14` | `id` không đúng phiên bản `budgetSeq` | `Phien ban khong khop: yeu cau <a>, PR nay la <b>` |
| `14` | `budgetSeq` < 1 / không phải số | `budgetSeq phai >= 1` / `budgetSeq phai la so: <giá trị>` |
| `13` | lỗi hệ thống — gọi lại sau | nội dung lỗi |

## Curl mẫu

```bash
# Theo ID PR
curl -s -X POST 'https://econtract.sandbox.kytaplatform.com/app/services/excall-internal/api/excall' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' -H 'Content-Type: application/json' \
  -d '{"selector":"kyta_bmw_get_pr","body":{"id":"120h1sP1xBLeNahaO"}}' | jq -r .result | jq .

# Theo ma ngan sach + phien ban
curl -s -X POST 'https://econtract.sandbox.kytaplatform.com/app/services/excall-internal/api/excall' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' -H 'Content-Type: application/json' \
  -d '{"selector":"kyta_bmw_get_pr","body":{"projectCode":"WBS-001","budgetSeq":2}}' | jq -r .result | jq .
```
