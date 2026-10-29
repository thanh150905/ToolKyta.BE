# eWorkspace — dashboard và người dùng

Phân hệ eworkspace đưa các thao tác trong ứng dụng ews-importer vào CLI kyta. Host và base path được cấu hình trong config/kyta.json; ánh xạ dev, sandbox, demo và prod lấy từ cấu hình của importer. Tenant riêng có thể đặt eworkspace dưới envs hoặc customers["<customer>@<env>"].

## API

Các endpoint giữ nguyên cách ghép URL của importer: API base URL đã chứa context path; CLI nối các path bên dưới.

| Method | Path | Hành vi | Xác thực |
|---|---|---|---|
| GET | /uaa/api/users/login?login=<email> | Tra user, lấy id | Cookie access_token |
| POST | /workspace/api/dashboards/create?dashboardId=<id>&t=<timestamp> | Thêm một user vào một dashboard; body là mảng [user] | Bearer |
| POST | /workspace/api/dashboards/delete?t=<timestamp> | Gỡ mọi dashboard của danh sách user; body là mảng users | Bearer |

Lookup email và cập nhật dashboard có hợp đồng xác thực khác nhau. Session eWorkspace gửi token dưới cả hai dạng, mỗi endpoint đọc loại mình cần. Lỗi 401 được retry một lần qua HTTP client dùng chung.

Tool không gộp nhiều user vào cùng request thêm: importer ghi nhận cách gọi từng cặp dashboard-user, trong khi chỉ endpoint xóa được xác nhận nhận mảng user. Thao tác thêm được giới hạn 6 request đồng thời.

## Lệnh

- kyta eworkspace users <customer> <env> resolve <email...> tra một hoặc nhiều email; --emails-file nhận mỗi email trên một dòng.
- kyta eworkspace dashboard <customer> <env> add <dashboard-id...> thêm dashboard cho user. Nhận user đã biết bằng --user id,email hoặc CSV --users-file; cũng có thể tra email bằng --email/--emails-file. --preset chọn tất cả dashboard preset đã lưu cho env.
- kyta eworkspace dashboard <customer> <env> delete gỡ tất cả dashboard của các user đã chọn, giống nút xóa trong importer.
- kyta eworkspace preset <env> list|add|rename|rm|reset quản lý danh sách dashboard dùng lại theo môi trường. Dữ liệu nằm ở .kyta/eworkspace-dashboards.json, không được ghi lên server. Env prod khởi đầu với 12 preset từ importer; các env còn lại khởi đầu rỗng.

Lệnh ghi server cần --yes; trên prod cần cả --yes-prod. --dry-run hiển thị kế hoạch mà không ghi. Email không tra được sẽ hủy thao tác thêm/gỡ để tránh xử lý thiếu user. File CSV user có header id,email tùy chọn; user ID phải là số. Dashboard ID có thể truyền thành nhiều tham số hoặc danh sách phân tách bằng dấu phẩy.

## Quy tắc vận hành

- Xác thực token qua cấu hình đăng nhập dùng chung account của Kyta.
- Thêm một dashboard cho một user là một request; nếu có nhiều dashboard và user thì tổng số request là tích hai danh sách.
- Xóa là thao tác rộng: API bỏ toàn bộ dashboard của mọi user truyền vào, không giới hạn ở preset đang chọn.
- Preset chỉ là danh sách local tiện tái sử dụng; ID dashboard và quyền truy cập vẫn do eWorkspace quản lý.
