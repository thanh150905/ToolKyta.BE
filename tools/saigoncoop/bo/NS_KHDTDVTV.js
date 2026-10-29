// Ký HĐ thuê đơn vị tư vấn: bảng tài liệu → F; bảng ký ẩn (custom UI) giữ chỗ; field ẩn eContract gắn [HT].
const { GOM } = require('./_common');
module.exports = {
  IDS: { S: '000071mzIDJUW2zVzgMRUMMvM' },
  MV: { S: { 'table_advance-1': 'F.table_advance-1' } },
  LAYOUT: { S: SUB => ['h1-1', 'h2-1', 'textField-1', ['cols', 'textField-3', 'datepicker-1'], 'number-1', 'upload_file-2', 'h2-2', ['child', SUB.F], 'text-1', 'table_advance-2',
    ['splitter', 'splitter-1', ['dropdown-1', 'upload_file-1', 'datepicker-2', 'textField-5', 'textField-6', 'textField-4', 'dropdown-2']]] },
  LABELS: { S: { 'dropdown-1': '[HT] DS người thực hiện (phòng ban + email người ký)', 'upload_file-1': GOM, 'datepicker-2': '[HT] Ngày giờ hiện tại',
    'textField-5': '[HT] Ngày giờ dạng chuỗi (nguồn chuẩn hoá)', 'textField-6': '[HT] Ngày giờ đã chuẩn hoá (Convert date)', 'textField-4': '[HT] Tên tài liệu eContract', 'dropdown-2': '[HT] Trạng thái eContract' } },
};
