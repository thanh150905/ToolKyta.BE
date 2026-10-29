# Kyta Swarm

Một **Overseer** đứng trước cả đội: bạn gõ yêu cầu bằng lời, Overseer tự hiểu loại việc, lập kế hoạch (các bước + phụ thuộc), gọi đúng agent cần thiết, lập lại kế hoạch khi có bước hỏng, rồi viết tổng kết. Không cần dán đường dẫn.

```
Prompt → Overseer ──(duyệt kế hoạch)──▶ các bước chạy song song / nối tiếp theo phụ thuộc
             ▲                                   │
             └──── bước FAILED → lập lại kế hoạch (tối đa 3 lần) ◀──┘
```

## Đội và luồng Overseer chọn

| Agent | Việc | Được ghi |
|---|---|---|
| overseer | hiểu yêu cầu, lập/lập lại kế hoạch, tổng kết (hoặc trả lời thẳng câu hỏi) | — |
| ba | làm rõ yêu cầu, tiêu chí nghiệm thu, hỏi người khi mơ hồ | — |
| recon | cào API nền tảng: Chrome thật (bạn đăng nhập 1 lần) + đọc network + GET dò → `docs/*-schema.md` | `docs/` |
| dev | viết/sửa mã kyta theo khuôn `src/<phân hệ>/` + test | `src/ test/ docs/` |
| config | cấu hình form/flow/mail/bản in/danh mục bằng kyta + file workspace | `workspace/` |
| qa | kiểm độc lập: test, diff, guard, đối chiếu tiêu chí | — |

Ví dụ: *"Thêm lệnh import excel cho eCatalog"* → recon → dev → qa. *"Form X: bắt buộc cột số tiền"* → (ba) → config → qa. *"Có những phân hệ nào?"* → Overseer trả lời luôn.

## Yêu cầu môi trường (Runtime)

- **Node.js >= 22.5.0**: Bắt buộc để sử dụng module tích hợp sẵn `node:sqlite`.
- Hệ thống tự động kiểm tra phiên bản lúc khởi động (`checkNodeVersion`). Nếu chạy trên Node cũ hơn, hệ thống sẽ từ chối chạy và đưa ra hướng dẫn cụ thể:
  ```bash
  # Nâng cấp bằng nvm:
  nvm install 22 && nvm use 22
  # Hoặc bằng fnm:
  fnm use 22
  ```

## Rào chắn an toàn đa tầng (Safety & Guardrails)

### 1. Kill Switch: `ALLOW_REAL_PUSH`
- Mặc định: `ALLOW_REAL_PUSH=0` (hoặc không khai báo). Mọi thao tác ghi thực tế lên server Kyta đều bị **chặn cứng ở tầng backend**.
- Chỉ khi đặt `ALLOW_REAL_PUSH=1` trong môi trường/cấu hình, hệ thống mới cho phép thực thi lệnh ghi thật sau khi vượt qua quy trình duyệt.

### 2. Quy trình 3 bước cho lệnh ghi Server (3-Step Write Workflow)
Không có agent nào được ghi trực tiếp lên server Kyta nếu chưa trải qua đầy đủ 3 bước:
1. **Kiểm tra quyền & Kill Switch**: Agent phải có quyền ghi (`kyta: write`), tham số đích hợp lệ (không phải lệnh lạ), và `ALLOW_REAL_PUSH=1`.
2. **Chạy Dry-Run & Cấp biên nhận**: Bắt buộc chạy với cờ `--dry-run`. Khi dry-run thành công (exit 0), backend cấp 1 `DryRunReceipt` dùng 1 lần, có hiệu lực trong 5 phút và gắn chặt với chữ ký lệnh + tham số tài nguyên.
3. **Phê duyệt tường minh (Human-in-the-Loop)**: Khi agent gọi lại lệnh ghi thật (bỏ `--dry-run`), backend kiểm tra receipt hợp lệ và tạo yêu cầu duyệt trong Inbox (`ctx.approve`). Người dùng phải bấm duyệt trên giao diện thì lệnh mới được thực thi và tự động gán cờ an toàn (`--yes-prod` nếu là PROD). Sau khi dùng, receipt bị vô hiệu hóa ngay lập tức.

### 3. Danh mục tác động tường minh (Explicit Command Catalog)
- Toàn bộ lệnh và subcommand Kyta được phân loại tập trung tại `src/core/commands-meta.js` (Single Source of Truth), phân định rõ:
  - `server_read`: Đọc dữ liệu từ server (vd: `eform list`, `eform pull`).
  - `server_write`: Ghi dữ liệu lên server (vd: `eform push`, `eform field add/delete`, `eform condition remove/toggle`).
  - `local_read`: Đọc file local (vd: `eform field list`, `eform inspect`).
  - `local_write`: Ghi file local (vd: `eform pull`, `eform field set`).
  - `high_risk`: Thao tác phá huỷ, xoá trường/form/danh mục (vd: `delete`, `drop`).
- **Từ chối mặc định**: Lệnh hoặc subcommand chưa được khai báo trong catalog bị từ chối ngay lập tức, không tự suy đoán là lệnh đọc.
- **Nhận diện PROD chính xác**: Dựa trên cấu hình môi trường và cờ `--env`/subcommand, không tìm kiếm chuỗi "prod" tuỳ tiện.

### 4. Khoá đường dẫn đồng thời & Giới hạn ghi Local
- **Khoá đồng thời (Path Lock)**: `orchestrator/src/tools/lock.ts` ngăn chặn các task song song cùng ghi/sửa một file tương đối trong repo. Khi một task ghi vào file, lock được giữ và tự động giải phóng khi task hoàn thành hoặc bị dừng.
- **Giới hạn phạm vi & Chống thoát Symlink**:
  - Mọi đường dẫn được kiểm tra qua `resolvePath` với `fs.realpathSync`.
  - Chặn triệt để symlink trỏ ra ngoài repo hoặc trỏ vào thư mục nhạy cảm (`.git`, `.kyta`, `.env`, credentials, `orchestrator`).
  - Lệnh Kyta ghi local (như `--into`) cũng chịu kiểm tra phạm vi ghi (`assertWritable`) như `write_file` và `edit_file`.

### 5. Kiểm chứng độc lập bắt buộc (Independent QA)
- **Overseer DAG Enforcement**: Overseer bắt buộc mọi task sửa code (`dev`) hoặc cấu hình/server (`config`) phải có một task kiểm thử độc lập (`qa`) phụ thuộc vào nó trước khi hoàn tất kế hoạch.
- **Done Criteria có bằng chứng**: Task ghi code/server chỉ được đánh dấu hoàn thành khi có bằng chứng kiểm chứng độc lập (kết quả `run_tests` exit 0, `git_diff`, hoặc thao tác đọc lại sau khi ghi `read-after-write`).

### 6. Che giấu dữ liệu nhạy cảm (Sanitization)
- Tiện ích `orchestrator/src/sanitize.ts` tự động che giấu:
  - Token, Bearer, JWT, API Keys, mật khẩu, thông tin đăng nhập trong URL.
  - Header nhạy cảm: `Authorization`, `Cookie`, `Set-Cookie`, `x-api-key`.
  - Thông tin cá nhân (PII): Email, số điện thoại, CCCD/CMND.
- Dữ liệu được làm sạch đa lớp: trước khi lưu SQLite, trước khi gửi vào context LLM, và trong kết quả bắt gói mạng `browser_network`.

## Xử lý sự cố & Phục hồi Run bị gián đoạn

- Khi orchestrator khởi động lại sau crash/tắt đột ngột, toàn bộ run và task đang dở dang (`queued`, `working`, `blocked`) được đánh dấu là `interrupted` trong SQLite.
- Để tiếp tục run:
  ```bash
  curl -X POST http://localhost:5178/api/runs/<run_id>/resume
  ```
  - **Bảo toàn kết quả an toàn**: Các bước đã `done` được giữ nguyên, không chạy lại.
  - **Khởi động lại bước an toàn**: Các bước bị `interrupted` được đưa về `pending` và tự động bổ sung chỉ dẫn:
    *"[PHỤC HỒI TỰ ĐỘNG]: Task này được tiếp tục sau khi gián đoạn. Trước khi thực hiện lệnh ghi, hãy kiểm tra (bằng lệnh đọc/diff/status) xem thao tác trước đó đã được áp dụng lên server hay chưa để đảm bảo tính idempotent, tránh ghi đè hoặc trùng lặp."*
  - Pipeline tiếp tục tự động điều phối khi các phụ thuộc sẵn sàng.

## Kiểm thử

```bash
cd orchestrator
npm test          # 23 bài test kiểm thử toàn diện độ an toàn và khả năng chịu lỗi
npm run typecheck # Kiểm tra kiểu TypeScript với 0 lỗi
```
Bao gồm:
- Ma trận phân loại lệnh Kyta, nhận diện PROD, rào chắn agent chỉ đọc.
- Symlink escape prevention, write scope checks, path concurrency locking.
- Backend kill switch (`ALLOW_REAL_PUSH`), DryRunReceipt single-use 5-minute lifecycle, approval binding.
- Overseer QA enforcement, verification evidence collection, read-after-write checks.
- Model mapping, startup price validation, concurrent call budget reservation.
- Che giấu dữ liệu nhạy cảm (tokens, credentials, cookies, PII) và phục hồi run bị gián đoạn (`resumeRun`).

## Chạy

```bash
cd orchestrator && npm install && cp .env.example .env    # điền key vào .env
cd dashboard && npm install && npm run build && cd ..
npm run dev                                               # http://localhost:5178
```

Phát triển giao diện: `cd dashboard && npm run dev` → http://localhost:5173 (proxy sang :5178).

## Cấu hình

- `config/agents.yaml` — đội, model, tool, phạm vi ghi; `requirePlanApproval`, `maxReplans`, `maxStepsPerTask`.
- `config/models.yaml` — giá ước tính, context, **rpm** (giãn cách gọi để khỏi 429). Đồng bộ với `litellm.config.yaml`.
- `prompts/*.md` — cách từng vai làm việc (đọc lại mỗi lượt gọi, sửa là có hiệu lực ngay).
- Dữ liệu (run, task, tin nhắn, usage, inbox): `data/swarm.db`; profile Chrome của Recon: `data/browser-profile/`.
