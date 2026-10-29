# Dựng file Excel tài liệu test luồng 1 SaigonCoop (Trên 500tr)
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.utils import get_column_letter

sys.path.insert(0, sys.path[0])
from data_flow import FLOW
from data_logic import LOGIC, EMAILS, RISKS
from data_forms import FORM_LOGIC, RISKS_MORE
from data_journey import MAIN, SIDE, ACTORS

OUT = sys.argv[1]
F = "Arial"
HDR_FILL = PatternFill("solid", fgColor="1F3864")
HDR_FONT = Font(name=F, bold=True, color="FFFFFF", size=10)
BODY = Font(name=F, size=10)
BOLD = Font(name=F, size=10, bold=True)
TITLE = Font(name=F, size=14, bold=True, color="1F3864")
INPUT_FILL = PatternFill("solid", fgColor="FFF2CC")
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
PRIO = {"Cao": "FCE4D6", "Trung bình": "FFF2CC", "Thấp": "E2EFDA"}

wb = Workbook()


def table(ws, start_row, headers, rows, widths, input_cols=()):
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=start_row, column=c, value=h)
        cell.font, cell.fill, cell.alignment, cell.border = HDR_FONT, HDR_FILL, Alignment(wrap_text=True, vertical="center"), BORDER
    for r, row in enumerate(rows, start_row + 1):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.font, cell.alignment, cell.border = BODY, WRAP, BORDER
            if c in input_cols:
                cell.fill = INPUT_FILL
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(row=start_row + 1, column=1)
    last = start_row + len(rows)
    ws.auto_filter.ref = f"A{start_row}:{get_column_letter(len(headers))}{last}"
    return last


def title(ws, text, sub):
    ws["A1"] = text
    ws["A1"].font = TITLE
    ws["A2"] = sub
    ws["A2"].font = Font(name=F, size=10, italic=True, color="595959")


# ---------------- 1. Hướng dẫn ----------------
ws = wb.active
ws.title = "Hướng dẫn"
title(ws, "TÀI LIỆU TEST LUỒNG 1 — SAIGON CO.OP «Trên 500tr / Đấu thầu rộng rãi, hạn chế»",
      "Môi trường: sandbox · Luồng eFlow 00007mzImMIW2zVlrGe (version 57) · Cập nhật 26/10/2026 (bản 2: đã sửa R02b, R07, R09–R12)")
guide = [
    ("MỤC ĐÍCH", "Giúp tester chưa nắm hệ thống hiểu các logic CHẠY NGẦM của luồng (bảng ký, ký tuần tự, cổng gửi, YCCS, uỷ quyền, ghép file ký với chữ ký, eContract chọn file, email) và test đủ mọi trường hợp. Chức năng chuẩn của eContract / eRequest coi như tester đã biết, tài liệu chỉ nói phần riêng của luồng này."),
    ("ĐỌC THEO THỨ TỰ", "1) Sơ đồ luồng → 2) Logic ngầm → 3) Email → 4) Logic form (tra cứu) → 5) Rủi ro đã biết → 6) Test case (làm theo, ghi kết quả) → 7) Tổng quan (tự đếm theo chặng)."),
    ("CÁCH GHI KẾT QUẢ", "Chỉ điền vào các ô NỀN VÀNG ở sheet «Test case»: Kết quả (chọn Pass / Fail / Blocked / N/A), Ticket ID / Bug, Ghi chú, Người test, Ngày test. Sheet «Tổng quan» tự đếm."),
    ("CÁCH CHẠY", "Sheet «Test case» viết theo ĐÚNG THỨ TỰ NODE của 1 ticket chính (T001 → T0xx): tạo 1 ticket rồi làm lần lượt từ trên xuống, mỗi bước đăng nhập đúng «Người thao tác». Node chạy lại (Duyệt vòng 2 sau YCCS, eContract ký lại sau từ chối) được test lại ngay tại chỗ. Node eContract chỉ ghi ngắn «thao tác trên giao diện eContract». Node Tổng hợp bỏ qua. Cuối sheet là ticket phụ P1–P8 cho tình huống không đi được trên ticket chính."),
    ("VÍ DỤ 1 DÒNG", "T019 · Kết quả = Fail · Ticket ID / Bug = TK-000123 / BUG-45 · Ghi chú = «A bấm Gửi vẫn chuyển node dù B chưa ký» · Người test = Lan · Ngày test = 27/10/2026."),
    ("QUY ƯỚC KẾT QUẢ", "Pass: đúng mong đợi. Fail: sai (ghi rõ thực tế + ticket). Blocked: không chạy được do bước trước lỗi / thiếu tài khoản. N/A: không áp dụng. Test case có chữ «[Rủi ro]» là điểm dev nghi lỗi — ghi lại đúng thực tế, Fail nếu đúng như rủi ro mô tả."),
    ("Ký hiệu node", "Số node theo tên node trên eFlow (1 = sự kiện Start, 2.1/18.1/… = node sửa). Một số nhãn trong form còn ghi số cũ (vd «node 7.1» = node 8 hiện tại, «node 16» = node 16)."),
    ("TÀI KHOẢN CẦN CHUẨN BỊ",
     "• 1 tài khoản CV KS&TT tạo ticket (người tạo = người thực hiện mọi node soạn/upload/sửa).\n"
     "• 4–5 tài khoản người ký có trong danh mục nhân sự (eCatalog «Danh sách user» 6a218240be1f055f619113d8), thuộc ≥2 phòng ban; nên có 1 phòng ban tên chứa «Điều hành» và 1 chứa «Hội đồng quản trị» để test khối chữ ký.\n"
     "• 1–2 tài khoản để nhận uỷ quyền (có trong danh mục nhân sự).\n"
     "• 1 tài khoản KHÔNG có trong danh mục nhân sự (test FM-07-02).\n"
     "• Tài khoản role «Đơn vị tư vấn» (TEST_DVTV) — node 5, 6.1, eContract HSMT.\n"
     "• Tài khoản role «Chuyên viên KS&TT» (TEST_CVKSTT) — eContract HDDVTV, TBKQĐT, HĐMB, BBNT, BBTL.\n"
     "• Tài khoản role id 2927 «Tổ trưởng TC-KH» (TEST_TCKH) — eContract GĐNTT.\n"
     "• Truy cập được hộp thư của các tài khoản trên để kiểm email."),
    ("FILE TEST CẦN CHUẨN BỊ",
     "• 3 file .docx khác nội dung (X, Y, Z), có bảng + ảnh + định dạng (để so bản in và file eContract mỗi vòng).\n"
     "• 1 file .doc, 1 file .pdf, 1 file .xlsx, 1 file .docx > 10MB, 1 file .exe (hoặc định dạng lạ).\n"
     "• File ảnh/PDF làm biên lai, công văn (≤10MB và >10MB)."),
    ("MẸO", "• Mỗi lần đổi tài khoản nên mở cửa sổ ẩn danh để tránh lẫn phiên đăng nhập (widget bảng ký nhận diện «Bạn» theo email đăng nhập).\n"
     "• Widget nhắc ký lưu mốc 30 giây trong trình duyệt — đổi trình duyệt sẽ không bị chặn.\n"
     "• Ghi ticket ID cho mọi case Fail để dev tra cấu hình."),
]
r = 4
for k, v in guide:
    ws.cell(row=r, column=1, value=k).font = BOLD
    c = ws.cell(row=r, column=2, value=v)
    c.font, c.alignment = BODY, WRAP
    ws.cell(row=r, column=1).alignment = WRAP
    r += 1
r += 1
ws.cell(row=r, column=1, value="VAI TRÒ DÙNG TRONG TEST CASE").font = BOLD
r += 1
for k, v in ACTORS:
    a = ws.cell(row=r, column=1, value=k); a.font, a.fill, a.border = BOLD, PatternFill("solid", fgColor="DDEBF7"), BORDER
    b = ws.cell(row=r, column=2, value=v); b.font, b.alignment, b.border = BODY, WRAP, BORDER
    r += 1
ws.column_dimensions["A"].width = 24
ws.column_dimensions["B"].width = 130

# ---------------- 2. Sơ đồ luồng ----------------
ws = wb.create_sheet("Sơ đồ luồng")
title(ws, "SƠ ĐỒ LUỒNG — theo thứ tự chạy", "Node ký eForm: 2, 17, 20 · Node eContract: 7 node · Tổng hợp: 7 node. eAPI chạy ngầm giữa node sửa và node ký/eContract.")
table(ws, 4, ["Bước", "Node", "Loại", "Form gắn", "Người thực hiện", "Dữ liệu kế thừa vào node", "Đi tiếp / rẽ nhánh", "Email phát sinh"],
      FLOW, [7, 40, 14, 30, 34, 44, 40, 30])

# ---------------- 3. Logic ngầm ----------------
ws = wb.create_sheet("Logic ngầm")
title(ws, "LOGIC CHẠY NGẦM — cơ chế riêng của luồng", "Mã Lxx được tham chiếu trong sheet Test case.")
table(ws, 4, ["Mã", "Cơ chế", "Áp dụng ở", "Cách chạy", "Tester cần kiểm"], LOGIC, [6, 26, 30, 100, 45])

# ---------------- 4. Email ----------------
ws = wb.create_sheet("Email")
title(ws, "EMAIL — khi nào gửi, gửi ai, kiểm gì", "Mã Mxx được tham chiếu trong sheet Test case. Mail của eContract và mail giao việc mặc định: tester đã biết.")
table(ws, 4, ["Mã", "Tên mẫu mail", "Khi nào gửi", "Người nhận", "Mẫu (id)", "Nội dung cần kiểm"], EMAILS, [6, 30, 38, 40, 32, 60])

# ---------------- 5. Logic form ----------------
ws = wb.create_sheet("Logic form")
title(ws, "LOGIC TỪNG FORM — field có ẩn/hiện, bắt buộc, tự điền, công thức, kiểm tra",
      "Form Update/Duyệt nhúng lại form Start nên logic giống Start trừ khi ghi khác. Cột cuối = điểm nghi lỗi cần để ý.")
table(ws, 4, ["Node", "Form", "Field / khối", "Loại logic", "Chi tiết", "Nghi lỗi / ghi chú"], FORM_LOGIC, [12, 30, 34, 18, 80, 45])

# ---------------- 6. Rủi ro ----------------
ws = wb.create_sheet("Rủi ro đã biết")
title(ws, "RỦI RO / NGHI LỖI DEV ĐÃ THẤY KHI ĐỌC CẤU HÌNH (chưa chạy ticket thật)",
      "Tester chạy test case liên quan và ghi lại thực tế. [Chưa xác minh] = suy ra từ cấu hình, chưa kiểm trên ticket.")
import re as _re
_steps = [(f"T{i:03d}", t[-1]) for i, t in enumerate(MAIN, 1)]
_c = {}
for t in SIDE:
    k = t[0].split(".")[0]; _c[k] = _c.get(k, 0) + 1; _steps.append((f"{k}-{_c[k]:02d}", t[-1]))
def _refs(code):
    return ", ".join(i for i, ref in _steps if _re.search(r"\b" + _re.escape(code) + r"\b", ref)) or "—"
RISK_ROWS = [r[:4] + (_refs(r[0]),) for r in RISKS + RISKS_MORE]
last = table(ws, 4, ["Mã", "Mức", "Mô tả", "Ảnh hưởng", "Bước test"], RISK_ROWS, [7, 13, 90, 50, 22])
for rr in range(5, last + 1):
    m = ws.cell(row=rr, column=2)
    m.fill = PatternFill("solid", fgColor={"Cao": "FCE4D6", "Trung bình": "FFF2CC", "Thấp": "E2EFDA", "Đã sửa 26/10": "C6EFCE"}.get(m.value, "FFFFFF"))

# ---------------- 7. Test case (theo thứ tự node chạy) ----------------
ws = wb.create_sheet("Test case")
title(ws, "TEST CASE — làm từ trên xuống theo đúng thứ tự node của ticket chính T1; ticket phụ P1–P8 ở cuối",
      "Chỉ điền các cột nền vàng. Một node chạy nhiều lần (Duyệt vòng 2, eContract ký lại) được test lại ở đúng chỗ nó chạy. Node Tổng hợp bỏ qua.")
HDR = ["Bước", "Chặng", "Node", "Vòng / lần", "Người thao tác", "Mục tiêu", "Các bước", "Kết quả mong đợi", "Ưu tiên", "Tham chiếu",
       "Kết quả", "Ticket ID / Bug", "Ghi chú", "Người test", "Ngày test"]
rows = []
for i, t in enumerate(MAIN, 1):
    rows.append([f"T{i:03d}"] + list(t) + ["", "", "", "", ""])
sid = {}
for t in SIDE:
    k = t[0].split(".")[0]
    sid[k] = sid.get(k, 0) + 1
    rows.append([f"{k}-{sid[k]:02d}"] + list(t) + ["", "", "", "", ""])
last = table(ws, 4, HDR, rows, [7, 20, 24, 10, 13, 30, 55, 60, 10, 13, 11, 16, 30, 12, 12], input_cols=(11, 12, 13, 14, 15))
prev = None
for rr in range(5, last + 1):
    p = ws.cell(row=rr, column=9)
    p.fill = PatternFill("solid", fgColor=PRIO.get(p.value, "FFFFFF"))
    ch = ws.cell(row=rr, column=2)
    if ch.value != prev:          # tô đậm dòng đầu mỗi chặng cho dễ nhìn
        for c in range(1, 4):
            ws.cell(row=rr, column=c).font = BOLD
        prev = ch.value
dv = DataValidation(type="list", formula1='"Pass,Fail,Blocked,N/A"', allow_blank=True)
ws.add_data_validation(dv)
rng = f"K5:K{last}"
dv.add(rng)
for val, col in (("Pass", "C6EFCE"), ("Fail", "FFC7CE"), ("Blocked", "F4B084"), ("N/A", "D9D9D9")):
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[f'"{val}"'], fill=PatternFill("solid", fgColor=col)))
TC_LAST = last

# ---------------- 8. Tổng quan ----------------
ws = wb.create_sheet("Tổng quan", 1)
title(ws, "TỔNG QUAN TIẾN ĐỘ TEST", "Tự tính từ sheet «Test case» — không sửa tay.")
groups = []
for x in rows:
    if x[1] not in groups:
        groups.append(x[1])
hdr = ["Chặng", "Tổng", "Pass", "Fail", "Blocked", "N/A", "Chưa test", "% đã test"]
for c, h in enumerate(hdr, 1):
    cell = ws.cell(row=4, column=c, value=h)
    cell.font, cell.fill, cell.border = HDR_FONT, HDR_FILL, BORDER
TCR = f"'Test case'!$B$5:$B${TC_LAST}"
TRR = f"'Test case'!$K$5:$K${TC_LAST}"
r = 5
for g in groups + ["TỔNG"]:
    ws.cell(row=r, column=1, value=g)
    if g == "TỔNG":
        for c in range(2, 8):
            L = get_column_letter(c)
            ws.cell(row=r, column=c, value=f"=SUM({L}5:{L}{r-1})")
    else:
        ws.cell(row=r, column=2, value=f'=COUNTIF({TCR},A{r})')
        for c, st in zip(range(3, 7), ["Pass", "Fail", "Blocked", "N/A"]):
            ws.cell(row=r, column=c, value=f'=COUNTIFS({TCR},A{r},{TRR},"{st}")')
        ws.cell(row=r, column=7, value=f"=B{r}-SUM(C{r}:F{r})")
    ws.cell(row=r, column=8, value=f"=IFERROR(SUM(C{r}:F{r})/B{r},0)")
    ws.cell(row=r, column=8).number_format = "0%"
    for c in range(1, 9):
        cell = ws.cell(row=r, column=c)
        cell.border = BORDER
        cell.font = BOLD if g == "TỔNG" else BODY
    r += 1
ws.cell(row=r + 1, column=1, value="Số test case ưu tiên Cao chưa Pass:").font = BOLD
ws.cell(row=r + 1, column=2, value=f"=COUNTIFS('Test case'!$I$5:$I${TC_LAST},\"Cao\",{TRR},\"<>Pass\")").font = BOLD
for i, w in enumerate([36, 9, 9, 9, 10, 9, 11, 11], 1):
    ws.column_dimensions[get_column_letter(i)].width = w

for s in wb.worksheets:
    s.sheet_view.zoomScale = 100
from openpyxl.workbook.properties import CalcProperties
wb.calculation = CalcProperties(fullCalcOnLoad=True)
wb.save(OUT)
print("rows", len(rows), "groups", len(groups))
