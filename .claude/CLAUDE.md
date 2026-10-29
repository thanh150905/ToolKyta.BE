<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Giảm lãng phí (BẮT BUỘC)

1. **KHÔNG tự sinh file .md/.docx bàn giao** (handover, plan, audit, summary, handoff-prompt). Cần lưu lại → ghi 1 dòng vào memory. Chỉ tạo file tài liệu khi người dùng yêu cầu rõ.
2. **Script tạm/một-lần dùng** (apply_*, step*, rework_*, push_all_*, build_*, generate_*) viết vào scratchpad của phiên, KHÔNG để trong `scratch/` của repo. `scratch/` đã được gitignore — không commit gì vào đó. Script có giá trị tái dùng lâu dài mới đặt vào `tools/` hoặc `bin/` và nói rõ với người dùng.
3. **KHÔNG lặp lại** nội dung đã có trong `docs/` hay memory — chỉ trỏ tới (ví dụ "xem docs/playbooks.md mục X").

## Dự án khách hàng

- SaigonCoop: đọc `docs/saigoncoop.md` trước khi làm (trạng thái luồng, kiến trúc form con, việc tồn, script `tools/saigoncoop/`).
