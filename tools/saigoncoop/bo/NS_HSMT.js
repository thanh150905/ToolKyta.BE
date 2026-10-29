// HSMT: bảng tài liệu → F; bảng ký ẩn (custom UI) + preview ẩn giữ chỗ (code §A đọc); field ẩn eContract gom splitter, gắn [HT].
const { GOM } = require('./_common');
module.exports = {
  IDS: { S: '00007115I3Dc65GR43G3c55o5' },
  MV: { S: { 'table_advance-2': 'F.table_advance-1' } },
  LAYOUT: { S: SUB => ['h1-1', 'h2-1', ['cols', 'textField-2', 'textField-1'], ['cols', 'dropdown-5', 'textField-5'], ['cols', 'dropdown-1', 'dropdown-2'],
    'h2-2', 'number-1', ['cols', 'textField-8', 'datepicker-1'], 'upload_file-2', 'h2-5', ['child', SUB.F], 'text-1', 'view_ewriter-1', 'table_advance-3',
    ['splitter', 'splitter-1', ['dropdown-3', 'upload_file-1', 'datepicker-2', 'textField-9', 'textField-10', 'textField-11', 'dropdown-4', 'textField-12', 'textField-13']]] },
  LABELS: { S: { 'dropdown-3': '[HT] DS người thực hiện (phòng ban + email người ký)', 'upload_file-1': GOM, 'datepicker-2': '[HT] Ngày giờ hiện tại',
    'textField-9': '[HT] Ngày giờ dạng chuỗi (nguồn chuẩn hoá)', 'textField-10': '[HT] Ngày giờ đã chuẩn hoá (Convert date)', 'textField-11': '[HT] Tên tài liệu eContract',
    'dropdown-4': '[HT] Trạng thái eContract', 'textField-12': '[HT] Cắt năm', 'textField-13': '[HT] Số fix cứng' } },
};
