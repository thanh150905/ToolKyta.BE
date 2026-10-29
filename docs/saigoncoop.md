# SaigonCoop — trạng thái dự án và cách làm tiếp

Tài liệu cho phiên làm việc mới (người hoặc Claude) tiếp quản dự án SaigonCoop trên Kyta sandbox.
Tổng hợp ngày 2026-10-26 từ ghi chú làm việc; mục nào đánh **[Unverified]** là chưa kiểm chứng trên ticket thật.
Tool chung (pull/push/where/lint/propagate…): xem [README.tool.md](README.tool.md). Schema API: [eform-fields-schema.md](eform-fields-schema.md),
[eflow-schema.md](eflow-schema.md), [ewriter-schema.md](ewriter-schema.md).

## 1. Bắt đầu nhanh

```bash
git checkout vinhtx7                      # workspace form (đã push origin/vinhtx7)
# code tool nằm ở nhánh vinhtx7-tool (cùng workspace + src/bin/docs/tools)
npm install
cp config/credentials.example.json config/credentials.local.json   # khai "saigoncoop@sandbox"
node bin/kyta.js login saigoncoop sandbox
node bin/kyta.js eform status workspace/saigoncoop/sandbox        # phải "Sạch"
node bin/kyta.js where "Trên 500tr" --customer saigoncoop          # tra form / luồng
```

- Workspace: `workspace/saigoncoop/sandbox/{eform,eflow,ewriter,email,ecatalog}`. Form xếp theo `eform/<luồng>/<hồ sơ>/<form>`.
- Form dùng chung: `eform/_subforms (chung)/`.
- **Luôn pull bằng `--into <thư mục>`** khi kéo form mới vào nhóm (pull theo tên dễ tạo folder phẳng ở gốc `eform/`).
  Tool hiện định vị theo `.meta.json` và chặn ghi đè thư mục của form khác.
- Commit chỉ stage `workspace/` trên nhánh `vinhtx7` (nhánh này không chứa code tool).

## 2. Các luồng (eFlow, sandbox)

| # | Luồng | modelerId | Trạng thái |
|---|---|---|---|
| L1 | Trên 500tr – Đấu thầu rộng rãi, hạn chế | `00007mzImMIW2zVlrGe` | Xong cấu hình; 38 form; test plan có sẵn (mục 7) |
| L2 | Dưới 500tr – Chào giá cạnh tranh | `0000763IlxTv820RKK5` | Xong cấu hình eForm + eFlow theo kiến trúc L1; flow đã phát hành v6; chưa chạy ticket |
| L3 | 10-50tr – Khảo sát giá & Mua trực tiếp | `00007RmI8EU1VDa5n8q` | Xong cấu hình (user tự vẽ flow, gắn form, người thực hiện); chưa chạy ticket |
| L4 | Quy trình Chỉ định thầu | `00007KnIxQsND4RPgd0` | 28/10 clone 13 form `4_…` từ L1 (`eform/Chỉ định thầu/`, spec `tools/saigoncoop/bo4/`); chưa gắn form vào node, chưa cấu hình eFlow |
| – | Chỉ định thầu (cũ) | `00007XrIwXIvVXlP2V1` | Chỉ có Start (mượn DUOI_500TR_TTKHMS_START) — có thể đã thay bằng L4 |
| – | Đơn vị LCNCC | `00007KnIpVfNvEk9nPb` | Chỉ gắn Start — chưa làm |
| – | Đơn vị TTTĐ | `000074XIqdCdKAlln23` | Chỉ gắn Start — chưa làm |
| – | PBLH LCNCC | `00007arIpVu5wDRKrOb` | Chỉ gắn Start — chưa làm |
| – | PBLH TTTĐ | `00007LEI0mtGJvrzkJO` | Chỉ gắn Start — chưa làm |

Phạm vi/thứ tự 4 luồng cuối + Chỉ định thầu **chưa chốt với user** (user từng nói "5 luồng") — hỏi lại trước khi làm.

## 3. Kiến trúc chuẩn (áp cho mọi luồng)

Mỗi "bộ hồ sơ" gồm form **Start** (soạn) · **Duyệt** · **Update** (sửa khi bị yêu cầu chỉnh sửa / eContract từ chối).

**Form con dùng chung** (`eform/_subforms (chung)/`, sandbox):

| Mã | Tên | formId | Dùng ở |
|---|---|---|---|
| A | YCCS (yêu cầu chỉnh sửa) | `0000710eIRqU2vxQM2EVH44n4` | Update |
| B | Xác nhận phê duyệt | `000071w9IROCEaVw1d4ktzzpz` | Duyệt (luật ẩn khối lý do khi "Phê duyệt", chép cả lên form cha) |
| F | `subF_TaiLieuDinhKem` — bảng tài liệu đính kèm 4 cột | `000071dMIKAuzRaONEP3unnan` | ~13 form (13 biến thể bảng khác nhau, F không hợp hết) |
| GS | `subF_ThietLapNguoiKy_Start` — bảng ký + DS người thực hiện, họ tên/email người ký đầu, cờ chặn | `0000714XIkQtdLArKXAdcPPOP` | 6 Start bộ ký |
| GD | `subF_KyDuyet` — bảng ký + email đăng nhập, cờ chặn, DS email đã ký, Họ, Tên | `000071gbIlXigNQmyqJmHooxo` | 6 Duyệt bộ ký |
| E | Người thực hiện (catalog lọc theo email + Phòng ban/Chức vụ) | chưa dựng | 7 form upload + 2 CVGPĐ |
| TC | Từ chối eContract | (trong bộ eContract) | Update bộ eContract |
| Logo | Logo (user tự tạo) | — | đầu form; Update nhận qua Start lồng |

**Quy ước bố cục / đặt tên** (user chốt):
- 2 field/hàng (lẻ thì field cuối full hàng); 1 splitter ẩn phẳng ở cuối form.
- Label field ẩn có tiền tố `[HT]` (hệ thống) / `[MAIL]` (biến mail) / `[KÝ]` (ký).
- Label element child_form để **trống**; form Update **không** lặp Logo trong bản Start lồng.
- "Hồ sơ đính kèm" = "Tài liệu đính kèm" — dùng tên **TÀI LIỆU**: tiêu đề "TÀI LIỆU ĐÍNH KÈM", bảng "Bảng tài liệu đính kèm",
  cột "Loại tài liệu" / "Tài liệu tải lên". Upload chính sang eContract tên "Tài liệu ký kết".
- Giữ trong form (không tách form con): Ticket Name (công thức riêng), ngày/tháng/năm (công thức theo ngày), rich text 1/2
  (DOCVARIABLE eWriter — API save-all không ghi được).
- Widget bảng ký `pbk-` dùng token màu Handsontable của Kyta: th `#f9fafb`, chữ `rgba(0,32,77,.7)` 12px/600; td trắng 14px cao 29px;
  lưới `#ccc`; ô chỉ đọc `rgba(0,53,128,.04)`; nhấn `#EA632E`; ô nhập viền `rgba(0,53,128,.35)` bo 8px; font Inter.
- Code trỏ id form con → khai `targetFormId` trong `.meta.json` để guard không báo "sai đích push".

**Bộ ký eForm** (L1): TTKHMS, TTPDTT, CVDPNCC, BBHHĐT. **Bộ eContract** (L2/L3 + L1 BBNT/BBTL — 28/10 đã gỡ GS + gate/signers ở Start/Update; form Duyệt L1 của 2 bộ này không còn trong flow): TMCG, TBKQCG, HĐMB, ĐNTT, BBNT, BBTL —
Start: Logo · nội dung · TÀI LIỆU ĐÍNH KÈM (Tài liệu ký kết + F) · preview eWriter · splitter ẩn; Update: Logo · tiêu đề · TC · Start lồng.

## 4. eFlow — cách cấu hình theo mẫu L1

- Kế thừa: Duyệt ← node soạn (mọi field dữ liệu cùng key S↔D; GS bảng ký → GD bảng ký; GS DS người thực hiện → GD DS email đã ký).
  Update ← Duyệt (B họ tên/email/lý do YCCS → A) và ← node soạn (field S lồng + GS bảng ký).
- Người thực hiện node Duyệt: kiểu "theo trường form" trỏ GS `0000714XIk…_dropdown-1` với formId = form **Start** (mẫu như eNotify trỏ field form con).
- Dây sau node Duyệt đọc cờ của GD `textField-2` (OK / YCCS). **User tự kéo dây** trên UI; mình gắn điều kiện.
- eNotify/điều kiện/kế thừa trỏ được field nằm trong form con.
- Ghi eFlow bằng tool: theo nguyên tắc chỉ ghi khi đã đối chiếu HAR thao tác UI (lệnh `kyta eflow form set` đang khoá).
  User đã cho phép bỏ HAR theo từng bộ (BBTL, TTKHMS, 4 bộ L1, L2, L3) — **xin phép lại cho việc mới**.
- Biến mail `${label_hashid}`: 2 cơ chế (client `mail.js` khoá tự đặt / eNotify hashid field thật) — đã đối chiếu 26 mẫu L1 đúng.
  Mẫu "Gửi thông báo đến người ký"/"Nhắc người soạn" gọi từ `code/config.js` form Duyệt, không qua eNotify.

## 5. Bẫy đã gặp

- **eWriter khớp placeholder theo CẢ label + hashid** → đừng đổi label field đang là placeholder docx (kiểm bằng `tools/saigoncoop/usage.js`).
  Lỗi chính tả là placeholder docx (HĐMB datepicker-7 "Ngày hiệu hết lực hợp đồng", GĐNTT textField-4 "Tài ngân hàng") → sửa phải đổi docx cùng lúc.
- Chữ ký eWriter không hiện = chưa import form Duyệt vào tài liệu eWriter; import/bind biến chữ ký phải làm trên **UI eWriter**.
- Khối chữ ký (`code/signature.js` node Duyệt) phân nhóm GĐ phòng ban / Ban TGĐ / HĐQT theo **dept HOẶC role** — đừng quay về chỉ dept
  (xoá-thêm-lại người ký ở Update làm mất dòng dept). Server từng mất fix này ở 6 form Duyệt; user chọn giữ bản server.
- Refresh/propagate form con vào Update sẽ **đưa Logo lồng quay lại** → chạy lại `strip_nested_logo.js`, và label child_form → `childlabel.js`.
- Cổng submit chỉ chặn được khi ô cổng **required = true** (code chỉ ghi rỗng/OK/YCCS). GD `textField-2` từng bị dựng với
  required=false → form Duyệt Phê duyệt gửi được khi chưa ký đủ (sửa L1 + subF_KyDuyet 27/10). Form cha giữ bản sao field form con → sửa cả từng form cha.
- Clone form giữ id field form gốc → `clone_sgc.js` tự đổi id; nhớ khai `targetFormId`.
- Hashid node mới chèn qua API bị server thay khi lưu → luôn đọc lại hashid từ server trước khi dùng cho kế thừa/eWriter.
- Form 8.1 CVGPĐ HSMT (`000071MgINgTlgLNJnpLHzzwz`): cột Nhà thầu chọn từ bảng ẩn `table_advance-4` (kế thừa từ node 7.1 Nhận thông tin HSMT
  `00007163IdbTv8e19GqosVVeV` table_advance-1); Trạng thái tự điền theo Số CV phúc đáp, sửa tay được.
- Update HĐMB/GĐNTT/TBKQĐT được kích hoạt khi eContract TỪ CHỐI (dây đọc dropdown-1 form upload eContract); khối YCCS + dropdown ẩn là di sản.

## 6. Việc còn tồn (2026-10-26)

**Chờ user / BA**
- R03: uỷ quyền eFlow chỉ bật node 2 (node 17, 20 tắt) — hỏi BA.
- R04: eNotify YCCS node 2/17/20 gửi cố định tài khoản TEST (TEST FPT 01) + mẫu «Uỷ quyền» ở 17 — hỏi BA.
- Phạm vi 4–5 luồng còn lại (mục 2).

**Lỗi thật lint phát hiện (chưa sửa)** — `node bin/kyta.js eform lint workspace/saigoncoop/sandbox`
- Placeholder `__TABLE_STT_n__` / `__TABLE_UPLOAD__` chưa điền trong `code/config.js` của TTPDTT, BBĐG NCC, BBNT, BBTL, CVĐP
  → module bỏ qua → các bảng **không tự đánh STT / điền giờ upload**. Cách sửa: dò key thật theo nhãn bảng, hoặc bỏ dòng nếu bảng đã xoá (hỏi BA).
- TBKQĐT_Duyệt: khối ký nháy (`SO_LUONG_KY_NHAY`, `CHU_KY_NHAY_1/2`…) trỏ field đã bỏ khi chuyển ký eContract (commit d23e6b2) → code chết, xoá sau khi user xác nhận.
- Biên bản họp HĐ thầu start/Update: danh sách STT trỏ `table_advance-2/3` không còn trong form.

**Đã biết, chưa làm**
- L1: bản in BBHHĐT Start có 9 placeholder trỏ hashid không có trên form + 2 bảng lệch label.
- Form không ký (HSMT, KHDTDVTV, 9 form upload): form con E chưa dựng.
- GĐNTT dây "Từ chối" đọc `000071pyIpfELyrk2pLcQQKQ_dropdown-1` (form không gắn node) **[Unverified]** sai.
- L2: `ewriter clone` (API duplicate) lỗi fetch failed → nhờ user nhân bản bản in trên UI.
- L2/L3: chưa chạy ticket thật; Duyệt chỉ kế thừa từ node soạn, không từ Update — vòng 2 có hiện dữ liệu đã sửa không **[Unverified]**.
- Chưa xem chế độ ký của widget bảng ký (dòng người ký, ô chữ ký, chip) trên ticket thật.

## 7. Script dự án — `tools/saigoncoop/`

Chạy từ gốc repo, ví dụ `node tools/saigoncoop/port_bo.js tools/saigoncoop/bo2/TTKHMS.js` (mặc định dry-run, `--write` để ghi).
Backup trước khi ghi + output trung gian (hmap/idmap, defs) ở `.kyta/archive/saigoncoop-out/` (local, không commit).
Spec từng bộ: `bo/` (L1, kèm `<bộ>.map.json` ánh xạ field cũ → form con), `bo2/` (L2), `bo3/` (L3). Dữ liệu: `subforms.json`, `bound.json`.

| Script | Việc |
|---|---|
| `build_subforms.js` | Dựng form con A/B/F từ bộ BBTL (đã chạy; giữ để tham khảo) |
| `restructure_bo.js` / `restructure_sign.js` | Tái cấu trúc 1 bộ L1 theo mẫu BBTL (form con, 2 field/hàng, splitter, label) |
| `code_remap.js` / `mail_remap.js` | Đổi id field trong code / biến mail theo `bo/<bộ>.map.json` |
| `eflow_fix_bo.js` / `eflow_gaps2.js` | Sửa eNotify + kế thừa sau khi tách form con / liệt kê chỗ eFlow còn trỏ field cũ |
| `port_bo.js` + `port_eflow.js` | Port 1 bộ L1 → L2 (giữ formId + hashid L2 cho field khớp) và cấu hình eFlow tương ứng. Spec: `KEEP` giữ field L2, `SKIP` bỏ field L1, `ALIAS` ghép cặp khác nhãn. 28/10 port lại 7 bộ L2 (`bo2/TTKHMS.js`, `bo2/port_*.js`) |
| `graft_bo.js` + `inherit_bo.js` | Ghép khung ký L1 vào bộ L2 có nội dung riêng + kế thừa theo mẫu L1 |
| `graft_ec.js` + `ec_eflow.js` | Dựng bộ eContract L2/L3 theo mẫu HĐMB L1 + eFlow (công thức có điều kiện, kế thừa node sửa, dây completed/not) |
| `clone_sgc.js` | Clone form + chuyển trạng thái 1→2→3→4, tự đổi id field |
| `strip_nested_logo.js` / `childlabel.js` | Gỡ Logo lặp trong Start lồng / xoá label child_form |
| `attach_rename.js` | Chuẩn hoá tên "tài liệu đính kèm" (kể cả bản nhúng) |
| `usage.js` | Field nào đang là placeholder docx / biến mail (dùng `defs/` trong `.kyta/archive/saigoncoop-out`) |
| `inh_clean.js` | Bỏ dòng kế thừa có nguồn/đích không còn (đã chạy cho L1 R02b/R07) |
| `tp/build.py` | Dựng Excel test plan (`python3 tools/saigoncoop/tp/build.py <out.xlsx>`; dữ liệu `tp/data_*.py`) |

Test plan L1: `scratch/saigoncoop/SaigonCoop_Luong1_Tren500tr_TestPlan.xlsx` (local, gitignore) — 115 bước theo **thứ tự node chạy
của 1 ticket** (T001–T107 ticket chính + P1–P8 ticket phụ), eContract chỉ ghi «thao tác trên giao diện eContract», bỏ qua node Tổng hợp.
Áp cách viết này cho test L2, L3.

Toàn bộ scratchpad các phiên trước (script một lần, backup, dump giao diện) lưu ở `.kyta/archive/scratchpad/<phiên>/` (local).
