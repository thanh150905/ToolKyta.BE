# Sheet "Logic ngầm" (cơ chế chạy ngầm) + "Email" + "Rủi ro"

# (mã, cơ chế, áp dụng ở đâu, cách chạy (chi tiết), tester cần kiểm gì)
LOGIC = [
    ("L01", "Thiết lập bảng ký (bảng người ký)",
     "Form Start/Update của 3 bộ ký eForm: TTKHMS (node 1, 2.1), BBHHĐT (16, 18.1), TTPDTT (19, 20.1)",
     "• Bảng ký là widget riêng (không phải bảng thường). Mỗi nhóm = 1 dòng PHÒNG BAN + các dòng NGƯỜI KÝ bên dưới.\n"
     "• Chọn theo chuỗi: Phòng ban → Chức vụ (lọc theo phòng ban) → Người thực hiện (lọc theo phòng ban + chức vụ). Nguồn: danh mục nhân sự (eCatalog id 6a218240be1f055f619113d8).\n"
     "• Chọn người → Email tự điền (vẫn sửa tay được). Đổi phòng ban → xoá chức vụ/người của cả nhóm. Đổi chức vụ → xoá người của dòng đó.\n"
     "• 1 email chỉ được xuất hiện 1 lần trong bảng: chọn trùng → popup «Người ký bị trùng»; gõ email tay trùng → popup «Email bị trùng» khi rời ô.\n"
     "• THỨ TỰ DÒNG = THỨ TỰ KÝ (tính cả qua các phòng ban, từ trên xuống).\n"
     "• Code tự sinh 3 field ẩn từ bảng: [HT] DS người thực hiện (phòng ban + email, bỏ trùng) → dùng làm NGƯỜI THỰC HIỆN node ký + người nhận mail hoàn thành; [MAIL] Họ tên + Email người ký ĐẦU TIÊN → người nhận mail M01.\n"
     "• Cổng gửi: phải có ≥1 dòng người ký có tên hoặc email. Không có → bấm Gửi bị chặn, hiện modal «Chưa thể gửi».",
     "Chọn đủ 3 cấp, email tự điền; chặn trùng người; thứ tự ký đúng thứ tự dòng; gửi khi bảng trống bị chặn đúng thông báo; dòng thiếu email (chỉ chọn phòng ban/chức vụ) vẫn gửi được → xem rủi ro R06."),
    ("L02", "Ký tuần tự trên form Duyệt",
     "Node 2, 17, 20",
     "• Bảng ký ở Duyệt kế thừa từ bảng ký Start. Widget lấy email đăng nhập (API uaa/account) để biết dòng nào là «Bạn».\n"
     "• Chỉ dòng CHƯA KÝ ĐẦU TIÊN được ký (Đến lượt). Chỉ người có email trùng dòng đó mới thấy nút «✎ Ký tại đây». Người khác thấy «Chờ người này ký» / «🔒 Chưa tới lượt bạn» / «🔒 Chờ lượt».\n"
     "• Ký xong: lưu ảnh chữ ký + ngày giờ ký (dd/MM/yyyy HH:mm). Người ký được xoá chữ ký của CHÍNH MÌNH (nút ✕) để ký lại; không xoá được của người khác.\n"
     "• Thanh tiến độ: «x/y chữ ký» tổng + «x/y đã ký» mỗi phòng ban.\n"
     "• Người không có trong bảng: thanh trạng thái «Bạn không có trong danh sách ký của hồ sơ này.»",
     "Đúng người, đúng lượt mới ký được; xoá/ký lại chữ ký của mình; tiến độ đếm đúng; người ngoài danh sách không ký được."),
    ("L03", "Cổng gửi (Gửi/Lưu) ở form Duyệt — ai được bấm Gửi",
     "Node 2, 17, 20 (field ẩn [HT] Cờ chặn submit (OK/YCCS) của form con GD)",
     "Field ẩn bắt buộc. Rỗng → nền tảng chặn Gửi và hiện modal lý do. Giá trị:\n"
     "• YCCS: người ĐANG ĐẾN LƯỢT chọn «Yêu cầu chỉnh sửa» → gửi được ngay, KHÔNG cần ký → luồng sang node sửa.\n"
     "• OK: người đã ký VÀ không còn ai chưa ký (người ký CUỐI) → gửi được → luồng đi tiếp.\n"
     "• Rỗng + thông báo:\n"
     "  – Đã ký nhưng còn người chưa ký: «Bạn đã ký thành công, nhưng danh sách vẫn còn người chưa ký… Nhấn Lưu thông tin để hoàn tất bước của bạn và tiếp tục.» (tiêu đề «Chưa đủ chữ ký để chuyển tiếp») → người ký giữa chừng chỉ bấm LƯU, không bấm Gửi.\n"
     "  – Đến lượt nhưng chưa ký: «Bạn chưa ký. Bấm vào ô ký ở dòng N (dòng có nhãn \"BẠN\") rồi ký để tiếp tục.»\n"
     "  – Chưa tới lượt: «Vui lòng chờ <tên người đang đến lượt> hoàn tất ký trước…» (tiêu đề «Chưa đến lượt ký»).\n"
     "  – Không có trong danh sách: «Bạn không có trong danh sách ký của hồ sơ này nên không thể gửi…».\n"
     "  – Chưa xác định người đăng nhập: «Chưa xác định được người đăng nhập. Tải lại trang rồi thử lại.»\n"
     "• Dropdown «Xác nhận phê duyệt» bị KHOÁ nếu chưa tới lượt mình.",
     "Mỗi thông báo trên hiện đúng tình huống; chỉ người ký cuối Gửi được; YCCS gửi được không cần ký; người giữa chừng dùng Lưu."),
    ("L04", "Yêu cầu chỉnh sửa (YCCS) → sửa → ký lại",
     "Node 2→2.1, 17→18.1, 20→20.1",
     "• Ở Duyệt: form con «Xác nhận phê duyệt» mặc định «Phê duyệt» (ẩn Họ tên/Email/Lý do). Chọn «Yêu cầu chỉnh sửa» → hiện 3 ô; Họ tên + Email tự điền theo người đăng nhập (chỉ đọc), Lý do BẮT BUỘC.\n"
     "• Gửi → dây «Yêu cầu chỉnh sửa» (cờ = YCCS) → eNotify M03 → node sửa (người tạo ticket).\n"
     "• Node sửa: khối đầu hiện Họ tên/Email/Lý do người YCCS (chỉ đọc, kế thừa từ Duyệt); bên dưới là toàn bộ form Start (sửa được, gồm cả bảng ký).\n"
     "• Gửi node sửa → eAPI → M01 gửi người ký đầu tiên THEO BẢNG ĐÃ SỬA → quay lại node Duyệt, ký lại từ đầu.",
     "Khối YCCS hiện đúng người/lý do; sửa nội dung + đổi người ký ở node sửa; vòng 2 Duyệt hiển thị DỮ LIỆU ĐÃ SỬA (xem R01); chữ ký vòng 1 không còn; mail M01 vòng 2 đến đúng người ký đầu mới."),
    ("L05", "Uỷ quyền (chuyển tiếp nhiệm vụ ký)",
     "Node 2 (eFlow bật «Uỷ quyền» internal). Node 17, 20: eFlow ĐANG TẮT uỷ quyền (xem R03)",
     "• Người ký A dùng chức năng uỷ quyền/chuyển tiếp của nền tảng cho B.\n"
     "• Khi B mở form Duyệt: code đọc lịch sử chuyển tiếp của node (API recipient-details, action = forward) → các dòng CHƯA KÝ có email A được ĐỔI THÀNH B (email, họ tên, chức vụ tra từ danh mục nhân sự). Dòng đã ký giữ nguyên.\n"
     "• Dưới ô chữ ký của B hiện dòng «<tên A> đã xem xét tài liệu» (A là người trung gian). Chuỗi A→B→C: C ký, hiện cả A và B đã xem xét.\n"
     "• Sau đổi, B được tính đúng lượt ký và cổng gửi như người ký bình thường. Thứ tự dòng không đổi.\n"
     "• Tên người ký trên khối chữ ký bản in = B (người thực ký).",
     "A uỷ quyền cho B trước lượt và đúng lượt; B thấy dòng «Bạn» và ký được; A không còn ký được; dòng «A đã xem xét tài liệu» hiện; khối chữ ký bản in ghi tên/chức vụ B; uỷ quyền chuỗi A→B→C."),
    ("L06", "Bản in = file Tài liệu ký kết (.docx) + khối chữ ký của form",
     "Form Duyệt node 2, 17, 20 (ô «Xem tài liệu phê duyệt» / view eWriter)",
     "• Tài liệu ký kết ở Start chỉ nhận .doc/.docx, ≤10MB. Khi mở Duyệt, code tải file .docx ĐẦU TIÊN trong ô Tài liệu ký kết → nạp vào Rich text advance 1 (ẩn) → eWriter in nguyên nội dung file. File .pdf/.doc KHÔNG nạp được (chỉ .docx).\n"
     "• Mỗi lần bảng ký đổi, code dựng KHỐI CHỮ KÝ (Rich text advance 2, ẩn) chỉ gồm người ĐÃ KÝ: mỗi người = Phòng ban / Chức vụ / Ảnh chữ ký / Họ tên.\n"
     "• Gom 3 nhóm, thứ tự cố định: (1) phòng ban thường (in tên phòng ban), (2) phòng ban có chữ «điều hành» → tiêu đề «Ý KIẾN CỦA BAN TỔNG GIÁM ĐỐC SAIGON CO.OP», (3) phòng ban có chữ «hội đồng quản trị» → «Ý KIẾN CỦA CHỦ TỊCH HỘI ĐỒNG QUẢN TRỊ SAIGON CO.OP» (so khớp không dấu, không phân biệt hoa thường). Nhóm 2, 3 không in tên phòng ban.\n"
     "• Tối đa 3 người/hàng; 1 người → căn giữa; nhiều người → xếp từ PHẢI sang TRÁI.\n"
     "• eWriter ghép: nội dung file + khối chữ ký → «Xem bản in».",
     "Bản in đúng nội dung file docx; chữ ký xuất hiện dần theo người đã ký; tiêu đề nhóm Ban TGĐ/HĐQT đúng; bố cục 1/2/3/4 người; file .pdf thì bản in không có nội dung; vòng 2 sau YCCS bản in lấy FILE MỚI (xem R02)."),
    ("L07", "Nút «✉ Gửi email nhắc ký» (báo người ký kế tiếp)",
     "Bảng ký ở form Duyệt node 2, 17, 20",
     "• Chỉ hiện ở dòng CỦA MÌNH, khi mình ĐÃ KÝ và còn người phía sau chưa ký.\n"
     "• Bấm → code gửi mail M04 cho người chưa ký đầu tiên (họ tên + link mở đúng nhiệm vụ của người đó).\n"
     "• Giới hạn 30 giây/lần (nhớ cả khi tải lại trang): bấm lại sớm → «Vừa gửi thông báo — vui lòng chờ N giây nữa mới gửi lại.»\n"
     "• Người ký kế tiếp KHÔNG có eNotify tự động riêng — ngoài mail giao việc mặc định của nền tảng, chỉ nhận M04 khi người trước bấm nút.",
     "Nút hiện/ẩn đúng điều kiện; mail đến đúng người kế tiếp; link mở đúng; chặn 30 giây."),
    ("L08", "Tổng hợp danh sách người đã ký (cho mail YCCS)",
     "Form Duyệt node 2, 17, 20",
     "• Ban đầu field [MAIL] DS email người đã ký nhận giá trị kế thừa = DS người thực hiện (cả tên phòng ban + mọi email). Khi form load/bảng ký đổi, code ghi đè = email những người ĐÃ KÝ (bỏ trùng). Node 2 còn ghi họ tên đã ký vào [MAIL] DS họ tên.\n"
     "• Mail M03 (YCCS) gửi tới danh sách này.",
     "YCCS ở người thứ 1 (chưa ai ký) → M03 không gửi cho ai trong bảng ký (chỉ tài khoản test cố định, R04); YCCS ở người thứ 3 → M03 đến đúng 2 người đã ký."),
    ("L09", "eContract: chọn file đưa đi ký + từ chối → sửa → ký lại",
     "7 node eContract: HDDVTV, HSMT, eContract18 (TBKQĐT), HDMB, GDNTT, BBNT, BBTL",
     "• Node eContract gắn form «upload file-econtract»; ô File econtract được kế thừa CÓ ĐIỀU KIỆN:\n"
     "  NẾU cờ ẩn «[HT] Đã nộp lại tài liệu ký kết» ở node sửa (x.1) = «Có» → lấy Tài liệu ký kết của node sửa; NGƯỢC LẠI → lấy Tài liệu ký kết của node soạn.\n"
     "  Cờ này mặc định «Có» và chỉ có giá trị khi node sửa đã chạy → lần 1 lấy file node soạn, từ lần 2 lấy file node sửa.\n"
     "• Kết quả ký trả về 2 field ẩn: [HT] Trạng thái eContract (completed / rejected / overdue / voided) và [HT] Lý do từ chối ký.\n"
     "• Dây: completed → «Ký thành công» → Tổng hợp → node kế tiếp. KHÁC completed (rejected, overdue, voided) → «Từ chối» → node sửa.\n"
     "• Node sửa: khối «Người trả về» (hiện CHƯA có nguồn → luôn trống, R05) + «Lý do trả về» (= lý do từ chối của eContract); bên dưới là form Start (tiêu đề form Start bị ẩn). Gửi → eAPI → quay lại cùng node eContract.",
     "Lần 1 eContract nhận đúng file node soạn; từ chối → node sửa hiện lý do; nộp file mới → lần 2 eContract nhận FILE MỚI; từ chối lần 2 → lần 3 vẫn nhận file mới nhất; quá hạn/huỷ cũng về node sửa."),
    ("L10", "Tổng hợp tài liệu",
     "Node Tổng hợp 1–7 (form «Tổng hợp tài liệu»)",
     "Node tự động, không người thực hiện. Ô Upload file kế thừa File econtract của node eContract ngay trước (bản file đã đưa đi ký). Xong tự chuyển node kế tiếp.",
     "Xem ticket ở node Tổng hợp: Upload file = đúng file đã ký thành công (file vòng cuối nếu có ký lại)."),
    ("L11", "Bảng tài liệu đính kèm → gom file",
     "Hầu hết form soạn/upload (bảng «Bảng tài liệu đính kèm» 4 cột: Loại tài liệu | Mô tả | Thời gian thực hiện | Tài liệu tải lên)",
     "• Mọi file ở mọi dòng của bảng được gom vào field ẩn «[HT] Gom file tài liệu đính kèm» để node sau / eWriter dùng.\n"
     "• Có file mà ô «Thời gian thực hiện» trống → tự điền ngày giờ hiện tại.\n"
     "• Ticket nhân bản: đóng dấu lại ngày giờ hiện tại cho mọi dòng có file (TTKHMS Start).",
     "Thêm/xoá file ở nhiều dòng → field gom đúng số file; ngày tự điền; nhân bản ticket → ngày mới."),
    ("L12", "Hình thức lập tài liệu: Có / Không có biểu mẫu",
     "TTKHMS, TTPDTT (ẩn, kế thừa), HĐMB, GĐNTT, BBNT (Start/Update/Duyệt)",
     "• «Không có biểu mẫu» (mặc định) → ẩn phần nội dung chi tiết, chỉ cần thông tin chung + upload Tài liệu ký kết.\n"
     "• «Có biểu mẫu» → hiện toàn bộ nội dung chi tiết (nhiều field bắt buộc).\n"
     "• Lựa chọn kế thừa sang Duyệt/Update nên Duyệt hiện đúng phần tương ứng.",
     "Chuyển qua lại 2 lựa chọn → ẩn/hiện đúng; field bắt buộc bị ẩn không chặn gửi; Duyệt/Update hiển thị khớp lựa chọn ở Start."),
    ("L13", "Công thức tự tính",
     "Nhiều form",
     "• Ticket Name (TTKHMS Start) = «<Tên dự án>_Trên 500tr Đấu thầu_<ngày giờ tạo dd/MM/yyyy HH:mm:ss>».\n"
     "• Tổng cộng (TTKHMS) = tổng cột Thành tiền của Bảng giá trị ước tính gói thầu (tính lại khi thêm/xoá/sửa dòng).\n"
     "• Bằng chữ: HĐMB (Giá trị HĐ, đợt 1, đợt 2), TBKQĐT (Giá trúng thầu), GĐNTT (Số tiền đề nghị) = đọc số thành chữ.\n"
     "• Ngày/Tháng/Năm hiện tại (ẩn, cho bản in) = tách từ ngày lập của form.\n"
     "• [HT] Tên tài liệu eContract (HĐĐVTV) = «Hợp đồng thuê đơn vị tư vấn_<Tên ĐVTV>_<ngày giờ>»; (HSMT) = «Hồ sơ mời thầu_<ngày giờ>».",
     "Đổi số liệu → kết quả cập nhật ngay; số lớn/0/để trống; tên ticket đúng định dạng."),
    ("L14", "Người thực hiện tự điền theo người đăng nhập",
     "Form con «Người thực hiện» ở các node upload 7–15, 18 (và CVGPĐ HSMT/HSDT chỉ đọc)",
     "Dropdown Người thực hiện lấy từ danh mục nhân sự; Phòng ban + Chức vụ tự điền theo người chọn. Chi tiết lọc/tự chọn: xem sheet «Logic form».",
     "Người đăng nhập có/không có trong danh mục nhân sự."),
    ("L15", "Danh sách nhà thầu dùng xuyên node",
     "Node 8 → 10, 11, 14; node 16 → 18",
     "• Bảng DS nhà thầu đăng ký ở node 8 được kế thừa (bảng ẩn) sang node 10, 11, 14 để làm nguồn chọn nhà thầu.\n"
     "• Bảng tổng hợp kết quả kiểm toán node 16 → bảng ẩn ở node 18 làm nguồn chọn NCC.\n"
     "Chi tiết hành vi từng bảng: sheet «Logic form».",
     "Nhà thầu nhập ở node 8 xuất hiện trong dropdown ở 10/11/14; sửa node 8 không ảnh hưởng ngược."),
]

# (mã, tên mail, khi nào gửi, người nhận, mẫu (id), nội dung cần kiểm)
EMAILS = [
    ("M01", "Gửi thông báo đến người ký đầu tiên",
     "eNotify ngay trước node ký: sau Start (→2), sau 16 (→17), sau 19 (→20); và sau eAPI khi quay lại từ node sửa 2.1/18.1/20.1",
     "Field [MAIL] Email người ký đầu tiên (dòng người ký đầu tiên trong bảng ký). Vòng 1 lấy từ form soạn; vòng 2 lấy từ form sửa.",
     "TTKHMS 000070eI6iAay5NleR · BBHHĐT 00007GyIGS0NxVDg2R · TTPDTT 00007vkI3Spe9B9vp",
     "• Kính gửi = họ tên người ký đầu tiên (không phải tên phòng ban).\n• Tên giao dịch = Ticket Name thật (không còn chữ mẫu «Hợp đồng vay tín chấp»).\n• Link «Xem chi tiết» mở đúng ticket/nhiệm vụ ký.\n• Vòng 2: gửi người ký đầu theo bảng đã sửa.\n• Ghi nhận: dòng «Bước xử lý: Phê duyệt» là chữ cố định."),
    ("M02", "Gửi thông báo đến danh sách người hoàn thành ký",
     "eNotify sau khi node ký đi dây «Ký thành công» (OK): 2→3, 17→18, 20→21",
     "Field [HT] DS người thực hiện của form soạn (gồm email mọi người ký + tên phòng ban).",
     "TTKHMS 000073LINHG5Kb6eLd · BBHHĐT 00007N1I8CvqAx8OPA · TTPDTT 00007ENIGCralQK64",
     "• Đủ mọi người ký nhận mail, không ai thừa.\n• Tên giao dịch đúng.\n• Ghi nhận: «Bước Xem xét hợp đồng… đã hoàn thành» và «Bước xử lý: Xem xét hợp đồng» là chữ CỐ ĐỊNH trong mẫu (không phải tên node thật) → báo BA nếu cần sửa."),
    ("M03", "Gửi thông báo đến danh sách người đã ký khi yêu cầu chỉnh sửa",
     "eNotify sau dây «Yêu cầu chỉnh sửa»: 2→2.1, 17→18.1, 20→20.1",
     "Field [MAIL] DS email người đã ký (chỉ người ĐÃ KÝ trước khi YCCS) + tài khoản cố định TEST FPT 01 (ladalep254@archifun.com) & phòng TEST_TESTER (R04).",
     "TTKHMS 00007OWI0hEng2vaLV · BBHHĐT 00007VoI2FJ6dELn4y · TTPDTT 00007vkIaFpe9BglK",
     "• Người yêu cầu chỉnh sửa = họ tên người chọn YCCS.\n• Lý do = đúng lý do đã nhập (giữ xuống dòng/ký tự đặc biệt).\n• Người chưa ký và người YCCS KHÔNG nhận.\n• Ghi nhận chữ cố định «tại bước Xem xét hợp đồng»."),
    ("M04", "Gửi thông báo đến người ký (nhắc người ký kế tiếp)",
     "Người ký bấm nút «✉ Gửi email nhắc ký» trong bảng ký ở Duyệt (code gửi, không qua eNotify)",
     "Người chưa ký đầu tiên trong bảng (người kế tiếp).",
     "TTKHMS 00007MgI0IRA5p44L · BBHHĐT 00007bBIwcazexLrxx · TTPDTT 00007AeIyUp5oRnwN",
     "• Kính gửi = họ tên người kế tiếp.\n• Tên giao dịch đúng.\n• Link «Xem giao dịch/Xem chi tiết» mở đúng nhiệm vụ của NGƯỜI NHẬN (không phải của người gửi).\n• Tiêu đề mail: TTKHMS/TTPDTT = «[THÔNG BÁO KYTA]: NHẮC NHỞ NHIỆM VỤ CẦN XỬ LÝ»; BBHHĐT cũng phải như vậy (R02b đã sửa).\n• Người kế tiếp là người được uỷ quyền → mail đến người được uỷ quyền."),
    ("M05", "Mẫu «Trên 500tr_Uỷ quyền thực hiện giao dịch»",
     "Đang gắn vào eNotify sau dây YCCS của node 17 (cùng M03)",
     "Tài khoản cố định TEST FPT 01 + phòng TEST_TESTER",
     "00007DzIyIpA5MnmXJ",
     "Cấu hình nghi lỗi/tồn dư test (R04): mail «Bạn được uỷ quyền…» gửi khi YCCS BBHHĐT. Ghi nhận có/không nhận."),
    ("M06", "Mail giao nhiệm vụ mặc định của nền tảng + mail eContract",
     "Mỗi khi node có người thực hiện được kích hoạt (cấu hình người thực hiện bật thông báo email); eContract tự gửi mail ký",
     "Người thực hiện của node",
     "Mẫu hệ thống",
     "Tester đã biết — chỉ cần xác nhận mỗi người ký của node ký đều nhận việc (kể cả khi DS người thực hiện có lẫn tên phòng ban, R06)."),
]

# (mã, mức, mô tả, ảnh hưởng, cách kiểm/ test case liên quan)
RISKS = [
    ("R01", "Cao", "Node Duyệt (2, 17, 20) chỉ kế thừa dữ liệu từ node SOẠN (Start/16/19), không từ node SỬA (2.1/18.1/20.1). [Chưa xác minh] nền tảng có lấy giá trị mới nhất sau khi node sửa đã sửa cùng field hay không.",
     "Vòng 2 sau YCCS, Duyệt có thể hiện dữ liệu/bảng ký/file CŨ.", "TC YC-05, YC-06"),
    ("R02", "Cao", "Code nạp docx ở Duyệt BỎ QUA nếu Rich text 1 đã có nội dung. [Chưa xác minh] khi quay lại node Duyệt vòng 2, rich text có giữ nội dung vòng 1 không.",
     "Vòng 2 bản in có thể vẫn là file cũ.", "TC BI-06"),
    ("R02b", "Đã sửa 26/10", "[ĐÃ SỬA 26/10 — bỏ 2 dòng kế thừa] Node 17: 2 dòng kế thừa trỏ field nguồn đã xoá ở form 16 («Người tham dự 1/2») → đích là [MAIL] Tiêu đề mail và [MAIL] DS họ tên người đã ký.",
     "Kiểm lại: tiêu đề mail M04 của BBHHĐT phải là tiêu đề mặc định.", "TC ML-07"),
    ("R03", "Cao", "eFlow: chỉ node 2 bật «Uỷ quyền»; node 17 và 20 đang TẮT.",
     "Có thể không uỷ quyền được ở BBHHĐT / TTPDTT. Cần BA xác nhận có cần uỷ quyền ở 17, 20.", "TC UQ-07"),
    ("R04", "Trung bình", "eNotify YCCS của node 2, 17, 20 có thêm cấu hình gửi cố định tới tài khoản TEST FPT 01 (ladalep254@archifun.com) + phòng TEST_TESTER; node 17 còn gửi mẫu «Uỷ quyền thực hiện giao dịch».",
     "Mail thừa / sai mẫu. Phải gỡ trước khi lên production.", "TC ML-05"),
    ("R05", "Thấp", "Form con «Từ chối eContract» ở node sửa: «Người trả về» chưa có nguồn dữ liệu (eContract chỉ trả trạng thái + lý do).",
     "Ô Người trả về luôn trống.", "TC EC-04"),
    ("R06", "Trung bình", "Form Start chỉ chặn gửi khi KHÔNG có người ký nào; không chặn dòng thiếu email / phòng ban chưa chọn / thiếu chức vụ. DS người thực hiện gộp cả TÊN PHÒNG BAN lẫn email.",
     "Dòng thiếu email → người đó không được giao việc, không ai ký được dòng đó → kẹt node. [Chưa xác minh] tên phòng ban trong danh sách người thực hiện có bị giao cả phòng không.", "TC BK-08, BK-09"),
    ("R07", "Đã sửa 26/10", "[ĐÃ SỬA 26/10 — bỏ 1 + 10 + 7 dòng] Node 5 có 1 dòng kế thừa File econtract HĐĐVTV vào field không còn tồn tại; node 18.1 (10 dòng) và 26.1 (7 dòng) có dòng kế thừa trỏ field đã xoá cả 2 đầu.",
     "Không ảnh hưởng hiển thị. Kiểm lại node 18.1, 26.1 vẫn hiện đủ dữ liệu cũ.", "TC FM-ALL-02"),
    ("R08", "Thấp", "Mẫu mail M02/M03 có chữ cố định «Xem xét hợp đồng» ở dòng Bước xử lý.", "Nội dung mail không đúng bước thật.", "TC ML-03, ML-04"),
]
