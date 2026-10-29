// Biên bản họp hội đồng thầu — Start: Ngày/Tháng/Năm + bảng là placeholder docx → giữ label. view_ewriter-1 Start (ẩn) giữ chỗ cũ.
const IDS = { S: '000071owIPz0UoG8LGGE8t44b4', D: '000071VoIPz2IwlReM2WaI99V9', U: '0000718DIPGqt16DW9WQVSLLKL' };
const MV = {
  S: { 'table_advance-8': 'GS.table_advance-1', 'dropdown-11': 'GS.dropdown-1', 'textField-22': 'GS.textField-1', 'textField-23': 'GS.textField-2', 'textField-24': 'GS.textField-3' },
  D: { 'dropdown-18': 'B.dropdown-1', 'textField-22': 'B.textField-1', 'textField-23': 'B.textField-2', 'textArea-6': 'B.textArea-1',
    'table_advance-8': 'GD.table_advance-1', 'textField-24': 'GD.textField-1', 'textField-25': 'GD.textField-2', 'dropdown-19': 'GD.dropdown-1', 'textField-26': 'GD.textField-3', 'textField-27': 'GD.textField-4' },
  U: { 'textField-22': 'A.textField-1', 'textField-23': 'A.textField-2', 'textArea-6': 'A.textArea-1' },
};
module.exports = {
  IDS, MV,
  LAYOUT: {
    S: SUB => ['h1-1', 'h2-1', ['cols', 'datepicker-1', 'textField-1'], 'h2-2', ['cols', 'datepicker-2', 'datepicker-3'], 'textField-2',
      'h3-5', 'table_advance-5', 'table_advance-4', 'upload_file-2', 'h2-6', 'table_advance-7', 'text-9', 'view_ewriter-1', ['child', SUB.GS],
      ['splitter', 'splitter-1', ['upload_file-1', 'textField-19', 'textField-20', 'textField-21']]],
    D: SUB => ['h1-1', 'h2-1', ['cols', 'datepicker-1', 'textField-1'], 'h2-2', ['cols', 'datepicker-2', 'datepicker-4'], 'textField-2',
      'h2-3', 'table_advance-1', 'table_advance-2', 'upload_file-1', 'view_ewriter-1', 'h2-6', 'table_advance-7', 'text-9', ['child', SUB.GD], ['child', SUB.B],
      ['splitter', 'splitter-1', ['textField_ticketName-1', 'textField-29', 'textField-28', 'textField-30', 'textField-19', 'textField-20', 'textField-21', 'rich_text_advance-1', 'rich_text_advance-2']]],
    U: (SUB, IDS) => [['child', SUB.A, { readonly: true }], ['child', IDS.S, { reuse: 'child_form-1' }]],
  },
  LABELS: {
    S: { 'upload_file-1': '[HT] Upload file' },
    D: { 'textField_ticketName-1': '[MAIL] Ticket Name', 'textField-29': '[MAIL] Tiêu đề mail', 'textField-28': '[MAIL] Họ tên người nhận (người ký kế tiếp)',
      'textField-30': '[MAIL] DS họ tên người đã ký (báo YCCS)', 'textField-19': '[HT] Ngày hiện tại', 'textField-20': '[HT] Tháng hiện tại', 'textField-21': '[HT] Năm hiện tại' },
    U: {},
  },
};
