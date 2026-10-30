<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Giảm lãng phí (BẮT BUỘC)

1. **KHÔNG tự sinh file .md/.docx bàn giao** (handover, plan, audit, summary, handoff-prompt). Cần lưu lại → ghi 1 dòng vào memory. Chỉ tạo file tài liệu khi người dùng yêu cầu rõ.
2. **Script tạm/một-lần dùng** (apply_*, step*, rework_*, push_all_*, build_*, generate_*) viết vào scratchpad của phiên, KHÔNG để trong `scratch/` của repo. `scratch/` đã được gitignore — không commit gì vào đó. Script tái dùng lâu dài: dùng chung → `tools/` hoặc `bin/`; riêng 1 khách → `workspace/<customer>/tools/`; nói rõ với người dùng.
3. **KHÔNG lặp lại** nội dung đã có trong `docs/`, README khách hay memory — chỉ trỏ tới (ví dụ "xem docs/README.tool.md mục X").

## Tổ chức

- `docs/` = tài liệu nền tảng dùng chung. Mọi thứ riêng 1 khách nằm ở `workspace/<customer>/`: `README.md` (trang chủ),
  `specs/` (forms/flows/selectors theo mã, `_raw/` = file gốc BA), `docs/`, `tools/`, rồi `<env>/<module>/`.
- Người dùng nhắc tên/mã form, flow, selector → `kyta where <mã>` (tra cả spec) trước khi hỏi lại hay đòi upload file.
- 2 git: `.git` = workspace (nhánh `vinhtx7`, có push lên remote team); `.tool.git` = code tool, **chỉ local, không push**
  (`git --git-dir=.tool.git --work-tree=. ...`). Không commit/push khi chưa được yêu cầu.

## Dự án khách hàng

- SaigonCoop: đọc `workspace/saigoncoop/README.md` trước khi làm (trạng thái luồng, kiến trúc form con, việc tồn, script `workspace/saigoncoop/tools/`).
- BMW: đọc `workspace/bmw/README.md`; cấu trúc thư mục ở mục 0 README; tài liệu tích hợp `workspace/bmw/docs/integrations/`.
