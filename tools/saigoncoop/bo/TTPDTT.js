// Tờ trình phê duyệt trúng thầu — bảng hồ sơ (table_advance-4) biến thể riêng → giữ, không F.
const IDS = { S: '00007115IDNLS65mMp63dH55o5', D: '000071QwILlQhn3RbL9M5UDDGD', U: '000071arIn6aS5V6KeOqaillpl' };
const body = [
  ['cols', 'textField-1', 'datepicker-1'], 'textField-2', 'h2-2', 'h2-1', 'textArea-2',
  'h3-1', ['cols', 'textField-3', 'number-1'], 'table_advance-1', ['cols', 'number-7', 'textField-5'], 'textArea-1',
  'h3-2', ['cols', 'textField-6', 'number-2'], 'table_advance-2', ['cols', 'number-8', 'textField-8'], 'textArea-3',
  'h2-3', 'h3-3', ['cols', 'textField-9', 'number-3'], 'textField-10', 'h3-4', ['cols', 'textField-11', 'number-6'], 'textField-15',
  'h2-4', 'table_advance-3', 'text-2', 'upload_file-1',
];
const MV = {
  S: { 'table_advance-5': 'GS.table_advance-1', 'dropdown-7': 'GS.dropdown-1', 'textField-45': 'GS.textField-1', 'textField-46': 'GS.textField-2', 'textField-47': 'GS.textField-3' },
  D: { 'dropdown-24': 'B.dropdown-1', 'textField-45': 'B.textField-1', 'textField-46': 'B.textField-2', 'textArea-4': 'B.textArea-1',
    'table_advance-5': 'GD.table_advance-1', 'textField-47': 'GD.textField-1', 'textField-48': 'GD.textField-2', 'dropdown-25': 'GD.dropdown-1', 'textField-49': 'GD.textField-3', 'textField-50': 'GD.textField-4' },
  U: { 'textField-45': 'A.textField-1', 'textField-46': 'A.textField-2', 'textArea-4': 'A.textArea-1' },
};
const date = { 'textField-42': '[HT] Ngày hiện tại', 'textField-43': '[HT] Tháng hiện tại', 'textField-44': '[HT] Năm hiện tại', 'dropdown-6': '[HT] Hình thức lập tài liệu (có/không biểu mẫu)' };
module.exports = {
  IDS, MV,
  LAYOUT: {
    S: SUB => ['h1-1', 'h2-6', ...body, 'h2-5', 'table_advance-4', 'text-3', ['child', SUB.GS],
      ['splitter', 'splitter-1', ['dropdown-6', 'textField-42', 'textField-43', 'textField-44']]],
    D: SUB => ['h1-1', ...body, 'view_ewriter-1', 'h2-5', 'table_advance-4', 'text-3', ['child', SUB.GD], ['child', SUB.B],
      ['splitter', 'splitter-1', ['dropdown-6', 'textField_ticketName-1', 'textField-42', 'textField-43', 'textField-44', 'rich_text_advance-1', 'rich_text_advance-2']]],
    U: (SUB, IDS) => [['child', SUB.A, { readonly: true }], ['child', IDS.S, { reuse: 'child_form-1' }]],
  },
  LABELS: { S: date, D: { ...date, 'textField_ticketName-1': '[MAIL] Ticket Name' }, U: {} },
};
