# BMW — bản đồ eCatalog cho datasource dropdown (sandbox)

Dùng wire `dropdown` kiểu `source: {kind: catalog, catalogId, value, display}` (typeGetData=4).
`value`/`display` là **key cột trong catalog** (không phải nhãn). Cào 2026-10-06 từ `kyta ecatalog`.

| Catalog (define gọi) | catalogId | value (key) | display (key) | Ghi chú cột |
|---|---|---|---|---|
| Contract Type | `6a7d33fe2c83e233fe00772d` | `textField_input-1` (Contract Type) | `textField_contracttype-2` (Contract Description) | |
| Company code | `6aba505f8fbafd46f642df6f` | `textField_id-1` (ID) | `textField_companyname-2` (Company Name) | |
| Supplier | `6aba47be8fbafd46f642df53` | `textField_input-1` (BusinessPartner) | `textField_input-2` (FullName) | 35 cột (địa chỉ, MST… input-3..35) |
| Purchasing Organization | `6a7d336b2c83e233fe00772a` | `textField_input-1` | `textField_input-2` (description) | |
| Purchasing Group | `6a7d339e2c83e233fe00772b` | `textField_input-1` | `textField_input-2` (Description) | |
| Payment Term | `6a7d35812c83e233fe007734` | `textField_input-1` | `textField_paymentterm-2` (Name) | |
| Material | `6a8025852c83e233fe0079db` | `textField_input-1` (Product) | `textField_productshort-10` (ProductShortText) | +Plant/MaterialGroup/BaseUnit… |
| Plant | `6a7d32e12c83e233fe007728` | `textField_input-1` | `textField_input-2` (Plant Description) | +địa chỉ -3 |
| PlanStorage location | `6a7d33282c83e233fe007729` | `textField_input-3` (Storage Location) | `textField_input-2` (Description) | lọc theo `textField_input-1` (Plant) |
| Material Group | `6a7d34902c83e233fe007730` | `textField_input-1` | `textField_materialgroup-2` (Description) | |
| ĐVT | `6a7d345e2c83e233fe00772f` | `textField_input-1` | `textField_nvtnh-2` (Description) | |
| Item Category | `6aba500c8fbafd46f642df54` | `textField_itemcategory-1` | `textField_description-2` (Description) | |
| Account Assignment Category | `6aba50328fbafd46f642df59` | `textField_acctassgntca-1` | `textField_acctassgntca-2` (Desc) | |
| GL Account | `6a7d34bd2c83e233fe007731` | `textField_input-1` (GLAccount) | `textField_glaccount-2` (LongText) | |
| Cost Center | `6a7d35232c83e233fe007732` | `textField_input-1` | `textField_costcenter-2` (Name) | +ProfitCenter -8 |
| Project | `6a8024df2c83e233fe0079da` | `textField_input-1` | `textField_input-1` | 13 cột |
| WBS Element | `6ac3315fd609616b0bce637c` | — | — | 26 cột (Project ID + BCH…); soi khi wire |
| Approval Matrix project | `6a8e8b19d3fe8b565e5d5c90` | `textField_projectid-2` | `textField_projectid-2` | lọc user theo dự án |
| ClaimType | `6ac3110fd609616b0bce61a0` | `textField_input-2` | `textField_input-2` | chỉ lấy Claim hàng kỳ / Quyết toán |

**Chưa có catalog:** "Currency / Loại tiền tệ" (define subF_10 cần) — không thấy danh mục Currency trên server. → tạm manual hoặc hỏi KH.

## Widget bảng tái dùng
- **subF_7_PR** `table_advance-3` (hashid `jvpvs9zbt`): bộ cột ~56 chiều PR item (Mã vật tư, Loại hạch toán, Nhà máy, KT Phương X/Y/Z, Màu, Diện tích sơn, MOQ, KL dự toán/dự trù…) ≈ **bảng hạng mục subF_10**. ui ở `ui/table_advance-3/` (index.html+script.js+style.css). Copy + chỉnh cột theo define subF_10.

## Form HĐ tham chiếu (đã wire datasource mẫu)
- `BMW-SP_Start_04 Hợp đồng mua hàng` (formId `000071gbIqdSgyKbQxwaHo3RP`, 94 field): bản CŨ, code chưa chuẩn SAP — chỉ dùng tham chiếu pattern.
