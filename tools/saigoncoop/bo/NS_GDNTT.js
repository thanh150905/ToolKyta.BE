// Giấy đề nghị thanh toán (Start + Update). Update: bỏ khối YCCS + dropdown "Yêu cầu chỉnh sửa" di sản → form con TC (từ chối eContract).
const { GOM } = require('./_common');
module.exports = {
  IDS: { S: '000071XrIXklTvKrv9XGoHMMdM', U: '000071mzI8SW2AkLvBOiMMvM' },
  MV: { S: { 'table_advance-1': 'F.table_advance-1' }, U: { 'textField-1': 'DROP', 'textField-2': 'DROP', 'textArea-1': 'DROP', 'dropdown-6': 'DROP' } },
  LAYOUT: {
    S: SUB => ['h1-1', 'dropdown-4', 'h2-5', ['cols', 'datepicker-1', 'dropdown-1'], ['cols', 'textField-11', 'textField-1'],
      'h2-1', 'dropdown-3', ['cols', 'textField-2', 'textField-3'], 'textField-4', ['cols', 'textField-5', 'textField-6'], ['cols', 'number-1', 'textField-7'],
      'h2-2', ['cols', 'number-2', 'textField-8'], 'textArea-1', 'textField-9', 'radio_button-2', 'textArea-2',
      'h2-3', 'textField-10', 'text-4', ['cols', 'number-3', 'number-4'], 'number-5', 'radio_button-1', ['cols', 'datepicker-2', 'datepicker-3'],
      'upload_file-1', 'h2-4', ['child', SUB.F], 'text-5', ['splitter', 'splitter-1', ['dropdown-5']]],
    U: (SUB, IDS) => [['child', SUB.TC, { readonly: true }], ['child', IDS.S, { reuse: 'child_form-1' }]],
  },
  LABELS: { S: { 'dropdown-5': '[HT] DS người thực hiện (phòng ban + email người ký)' }, U: {} },
};
