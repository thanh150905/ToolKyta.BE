# Excall reference — mẫu selector tham chiếu

Bản sao chọn lọc (40/114 file) từ `excall/src/main/java/com/fis/excall/service/test/` (repo excall).

- Đây là **nháp Java** (`@Service`, `@Autowired`, chỉ có method nghiệp vụ) — **không** dán thẳng lên server được.
  Script thật trên server là class Groovy kế thừa `ScriptObject` với `init(ScriptContext)` → `process(InParamDTO...)` →
  `destroy()` (xem `excall/src/main/resources/groovy/email_common.groovy`).
- Secret hardcode (password, clientSecret, apiKey, HMAC key, username tài khoản dịch vụ...) đã thay bằng `"<REDACTED>"`;
  dòng 3 mỗi file ghi số chỗ đã che.
- Chọn theo đọc tĩnh, **chưa xác minh** file nào từng chạy ổn trên server. Mỗi họ file copy gần giống nhau chỉ giữ 1 đại diện.
- Code selector mới đặt ở `workspace/<customer>/<env>/excall/<excall|excall-internal>/<selector_id>/`, không đặt ở đây.

## Mục lục

### Kyta platform (eRequest / eForm / eFlow)

| File | Pattern |
|---|---|
| `kyta/kyta_finish_kyta_task` | Hoàn thành service task qua `ErequestClient.finishTask` |
| `kyta/Kyta_task_update_global_form` | Đọc/ghi ticket form data, sub-form data |
| `kyta/Kyta_task_create_longtime_agreement` | Chứng thư FPT CA cloud dài hạn, ghi kết quả về form |
| `kyta/ERequest_flow_start_kyta_create_econtract_auto_determine` | Tạo HĐ từ eRequest: draft → upload tài liệu → processing |
| `kyta/ERequest_after_flow_start_kyta_create_env_no` | Sinh số HĐ theo doc-type + formula |
| `kyta/ERequest_flow_finish_kyta_econtract_temp_n_determine` | Kết thúc luồng → cập nhật trạng thái/form eRequest |
| `kyta/ERequest_flow_processing_kyta_erequest_view_contract` | Lấy link webview HĐ |
| `sabeco/sabeco_flow_start_kyta_sabeco_create_econtract` | Tạo HĐ đầy đủ: renewal, signDraft, xoá HĐ |
| `sabeco/kyta_sabeco_flow_start_kyta_sabeco_create_econtract` | Selector gọi selector khác qua `POST /services/excall/api/excall` |
| `sabeco/kyta_sabeco_sabeco_get_template` | Lấy template + structure (`external/v1/template/tempAndStructure`) |
| `sabeco/kyta_sabeco_sabeco_get_template_by_owner` | Tra template theo owner |
| `sabeco/kyta_sabeco_sabeco_get_empAndStructure_by_templateid` | Tra structure theo templateId |
| `payoo/Payoo_send_out_paybill_create_kyta_erequest` | Tạo ticket eRequest qua eForm/eFlow client; đọc số tiền thành chữ |
| `astra/Astra_kyta_task_astra_create_account` | Đọc sub-form data, đăng ký user UAA, ghi lại form |
| `sacombank/sacombank_kyta_fda_check_valid_invoice` | Tạo lot + S3 + cập nhật form data |
| `bridgestone/Bridgestone_flow_start_bridgestone_create_lot` | Tạo lot từ template + Excel (S3) |
| `bridgestone/Bridgestone_flow_start_bridgestone_create_econtract` | Export file theo structure tài liệu, tạo HĐ |

### eContract (envelope)

| File | Pattern |
|---|---|
| `cpbank/CPBank` | Đại diện họ draft → update → processing (party/recipient builder) |
| `mas/MasTest` | Tạo HĐ qua `external/v1/sign` (luồng template) |
| `gsm/GSM_flow_start_gsm_create_auto_determine_integrate` | `TemplateMappingVariable` (`findByDocTypeCode`), check token customer-authen |
| `gsm/GSM_flow_start_gsm_create_batch` | Tạo batch/lot, lưu lịch sử |
| `gsm/GSM_flow_processing_gsm_voided_batch` | Huỷ hàng loạt (gọi excall từng HĐ) |
| `gsm/GSM_flow_processing_gsm_voided_contract` | Huỷ HĐ + watermark |
| `gsm/GSM_flow_processing_gsm_share_depot` | Phân quyền ACL kho HĐ theo group |
| `global/Global_send_out_azure_access_token_from_uaa` | Lưu token customer-authen |

### Đẩy trạng thái sang đối tác

| File | Pattern |
|---|---|
| `ssi/SSI_recipient_finished_ssi_send_status_recipient` | Kiểm tra chữ ký phủ toàn văn bản, push trạng thái recipient |
| `ssi/SSI_after_flow_finish_ssi_get_econtract_from_integrate` | Webview HĐ sau khi hoàn tất |
| `shinhan/ShinhanConfrimReview` | Xử lý act, cập nhật giá trị field/recipient |
| `shinhan/ShinhanCancelFlow` | Huỷ luồng theo refId |
| `tenx/TenxRecipient` | Push khi recipient ký xong, ký HMAC-SHA256 |
| `sunlifevn/SunlifeVN_after_recipient_start_slvn_create_agreement` | Kho eKYC + FPT CA cloud |
| `sunlifevn/SunlifeVN_recipient_finish_slvn_push_info` | Push thông tin recipient + eKYC |

### OTP / SMS / Notify / Mail

| File | Pattern |
|---|---|
| `vnpay/VNPAY_notify_fpt_ca_to_vnpay_otp_sms` | Gửi OTP qua SMS gateway |
| `gsm/GSM_recipient_start_notify_gsm_econtract_sms` | SMS + short link ký |
| `_common/ExpoTest` | Push notification Expo (`NotificationClient`) |
| `_common/TestMail_send_out_test_mail_server` | Gửi mail SMTP |

### Thanh toán, OCR/eKYC, truyền file

| File | Pattern |
|---|---|
| `payoo/Payoo_send_out_payoo_create_payment_link` | Tạo link thanh toán: checksum, XML |
| `_common/OcrFci` | Map kết quả OCR FPT.AI (CCCD) |
| `shlv/SHLV_send_out_id_check_shlv` | ID check (front/back/MRZ) |
| `prudential/PrudentialTest` | Gửi file qua SFTP (sshj) |
