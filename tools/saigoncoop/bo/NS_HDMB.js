// Hợp đồng mua bán (Start + Update). Start dàn lại 2 field/hàng; Update: khối YCCS di sản → form con TC.
module.exports = {
  IDS: { S: '000071ENIpKTrXAawmKRtJJ4J', U: '00007115IDdws65qb8By2t55o5' },
  MV: { S: { 'table_advance-2': 'F.table_advance-1' }, U: { 'textField-1': 'DROP', 'textField-2': 'DROP', 'textArea-1': 'DROP', 'dropdown-8': 'DROP' } },
  LAYOUT: {
    S: SUB => ['h1-1', 'dropdown-6', 'h2-17', ['cols', 'textField-1', 'datepicker-1'], 'textField-2',
      'h2-1', ['cols', 'dropdown-1', 'textField-36'],
      'h2-2', ['cols', 'textField-3', 'textField-4'], ['cols', 'phone_number-1', 'number-1'], ['cols', 'textField-5', 'number-2'], ['cols', 'textField-6', 'textField-7'], 'phone_number-2',
      'h2-3', 'textField-8', 'h2-4', 'textField-9', 'h2-5', ['cols', 'textField-10', 'textField-11'],
      'h2-6', 'dropdown-3', ['cols', 'number-3', 'textField-12'], 'dropdown-4', ['cols', 'number-4', 'textField-14'], 'dropdown-5', ['cols', 'number-5', 'textField-13'],
      ['cols', 'textField-15', 'datepicker-2'], 'textField-16', ['cols', 'textField-17', 'datepicker-5'], 'textField-18',
      'h2-7', ['cols', 'textField-19', 'textField-20'], 'h2-8', 'textField-21', 'h2-9', 'h2-10',
      'h3-1', ['cols', 'textField-22', 'textField-23'], 'textField-24', 'h3-2', ['cols', 'textField-25', 'textField-26'], 'textField-27',
      'h3-3', ['cols', 'textField-28', 'textArea-1'], ['cols', 'phone_number-3', 'phone_number-4'], 'email-1',
      'h2-11', 'h2-12', ['cols', 'textField-29', 'textField-30'], 'h2-13', 'textField-31', 'h2-14', ['cols', 'datepicker-6', 'datepicker-7'],
      'h2-15', 'table_advance-1', ['cols', 'number-6', 'number-7'], ['cols', 'number-8', 'textField-32'],
      'upload_file-1', 'h2-16', ['child', SUB.F], 'text-1', ['splitter', 'splitter-1', ['dropdown-7']]],
    U: (SUB, IDS) => [['child', SUB.TC, { readonly: true }], ['child', IDS.S, { reuse: 'child_form-1' }]],
  },
  LABELS: { S: { 'dropdown-7': '[HT] DS người thực hiện (phòng ban + email người ký)', 'textField-17': 'Thời hạn bảo lãnh bảo hành (ngày)' }, U: {} },
};
