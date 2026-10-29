// Công văn đàm phán NCC — bỏ các row lồng (row-1..5), dàn phẳng 2 field/hàng; bảng tài liệu biến thể riêng → giữ.
const IDS = { S: '000071LEIrD4FGwQXxNKmtxxPx', D: '000071DzIyk0SxA5OKgeJsQQGQ', U: '000071XrIXxdHvKgRBNQmCMMdM' };
const body = [
  'h1-1', 'dropdown-1', ['cols', 'textField-3', 'datepicker-1'], 'textField-4',
  'h2-1', ['cols', 'textField-5', 'phone_number-1'], 'textArea-1', ['cols', 'textField-8', 'textField-7'], 'textField-6',
  'h2-2', 'textArea-2', ['cols', 'datepicker-2', 'textField-9'], 'upload_file-1',
];
const MV = {
  S: { 'table_advance-2': 'GS.table_advance-1', 'dropdown-2': 'GS.dropdown-1', 'textField-22': 'GS.textField-1', 'textField-23': 'GS.textField-2', 'textField-24': 'GS.textField-3' },
  D: { 'dropdown-8': 'B.dropdown-1', 'textField-22': 'B.textField-1', 'textField-23': 'B.textField-2', 'textArea-3': 'B.textArea-1',
    'table_advance-2': 'GD.table_advance-1', 'textField-24': 'GD.textField-1', 'textField-25': 'GD.textField-2', 'dropdown-9': 'GD.dropdown-1', 'textField-26': 'GD.textField-3', 'textField-27': 'GD.textField-4' },
  U: { 'textField-22': 'A.textField-1', 'textField-23': 'A.textField-2', 'textArea-3': 'A.textArea-1' },
};
const date = { 'textField-19': '[HT] Ngày hiện tại', 'textField-20': '[HT] Tháng hiện tại', 'textField-21': '[HT] Năm hiện tại' };
module.exports = {
  IDS, MV,
  LAYOUT: {
    S: SUB => [...body, 'h2-3', 'table_advance-1', 'text-1', ['child', SUB.GS], ['splitter', 'splitter-1', ['textField-19', 'textField-20', 'textField-21']]],
    D: SUB => [...body, 'view_ewriter-1', 'h2-3', 'table_advance-1', 'text-1', ['child', SUB.GD], ['child', SUB.B],
      ['splitter', 'splitter-1', ['textField_ticketName-1', 'textField-19', 'textField-20', 'textField-21', 'rich_text_advance-1', 'rich_text_advance-2']]],
    U: (SUB, IDS) => [['child', SUB.A, { readonly: true }], ['child', IDS.S, { reuse: 'child_form-1' }]],
  },
  LABELS: { S: date, D: { ...date, 'textField_ticketName-1': '[MAIL] Ticket Name' }, U: {} },
};
