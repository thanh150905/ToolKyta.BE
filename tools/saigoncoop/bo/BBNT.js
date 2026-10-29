// Biên bản nghiệm thu — bảng hồ sơ trùng chuẩn F (Start + Duyệt). Start không còn field ẩn riêng → không splitter.
const IDS = { S: '000071KnIxfNayOV0NRTKK3K', D: '000071LEIvfGwrR634yfxxPx', U: '000071qOI9snOMQaVeGt99Q9' };
const body = [
  'h1-1', 'dropdown-1', 'h2-1', ['cols', 'textField-1', 'datepicker-1'], 'textField-3', ['cols', 'textField-16', 'textField-17'], 'textArea-1',
  ['cols', 'textField-18', 'number-1'],
  ['cols', 'textField-4', 'textField-5'], ['cols', 'textField-6', 'textField-7'], ['cols', 'dropdown-10', 'dropdown-11'],
  ['cols', 'textField-8', 'textField-9'], ['cols', 'textField-10', 'textField-11'], ['cols', 'dropdown-12', 'dropdown-13'],
  'upload_file-1',
];
const MV = {
  S: { 'table_advance-1': 'F.table_advance-1', 'table_advance-2': 'GS.table_advance-1', 'dropdown-14': 'GS.dropdown-1', 'textField-19': 'GS.textField-1', 'textField-20': 'GS.textField-2', 'textField-21': 'GS.textField-3' },
  D: { 'table_advance-1': 'F.table_advance-1', 'dropdown-14': 'B.dropdown-1', 'textField-29': 'B.textField-1', 'textField-30': 'B.textField-2', 'textArea-2': 'B.textArea-1',
    'table_advance-2': 'GD.table_advance-1', 'textField-31': 'GD.textField-1', 'textField-32': 'GD.textField-2', 'dropdown-15': 'GD.dropdown-1', 'textField-33': 'GD.textField-3', 'textField-34': 'GD.textField-4' },
  U: { 'textField-1': 'A.textField-1', 'textField-2': 'A.textField-2', 'textArea-1': 'A.textArea-1' },
};
module.exports = {
  IDS, MV,
  LAYOUT: {
    S: SUB => [...body, 'h2-2', ['child', SUB.F], 'text-1', ['child', SUB.GS]],
    D: SUB => [...body, 'view_ewriter-1', 'h2-2', ['child', SUB.F, { readonly: true }], 'text-1', ['child', SUB.GD], ['child', SUB.B],
      ['splitter', 'splitter-1', ['textField_ticketName-1', 'rich_text_advance-1', 'rich_text_advance-2']]],
    U: (SUB, IDS) => [['child', SUB.A, { readonly: true }], ['child', IDS.S, { reuse: 'child_form-1' }]],
  },
  LABELS: { S: {}, D: { 'textField_ticketName-1': '[MAIL] Ticket Name' }, U: {} },
};
