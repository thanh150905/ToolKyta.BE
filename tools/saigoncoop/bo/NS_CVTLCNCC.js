// Công văn trả lời của NCC: bỏ columns bọc tiêu đề, dàn 2 field/hàng; bảng tài liệu → F.
module.exports = {
  IDS: { S: '000071PnI8bdhQgVDA3aWTDDPD' },
  MV: { S: { 'table_advance-1': 'F.table_advance-1' } },
  LAYOUT: { S: SUB => ['h1-1', 'h2-1', ['cols', 'textField-1', 'textField-2'], 'textField-3', 'h2-2', ['cols', 'textField-4', 'datepicker-1'], ['cols', 'datepicker-2', 'textField-5'],
    'h2-3', ['child', SUB.F], 'text-1', ['splitter', 'splitter-1', ['textField-6', 'textField-7']]] },
  LABELS: { S: { 'textField-6': '[HT] Họ người đăng nhập', 'textField-7': '[HT] Tên người đăng nhập' } },
};
