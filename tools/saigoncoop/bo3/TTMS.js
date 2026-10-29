// L3 Tờ trình mua sắm ← khung ký Tờ trình phê duyệt trúng thầu (L1). Không có bản in → bỏ field ngày/tháng/năm, hình thức lập, xem tài liệu.
const ATT = { label: 'Bảng tài liệu đính kèm' };
const CONTENT = ['h1-1', 'h2-1', ['cols', 'textField-1', 'datepicker-1'], ['cols', 'dropdown-1', 'textField-2'], ['cols', 'textField-3', 'textField-4'],
  ['cols', 'textField-5', 'dropdown-2'], 'textArea-1', 'h2-2', ['cols', 'number-1', 'number-2'], 'h3-1', 'table_advance-1'];
module.exports = {
  L1: { S: '00007115IDNLS65mMp63dH55o5', D: '000071QwILlQhn3RbL9M5UDDGD', U: '000071arIn6aS5V6KeOqaillpl' },
  L2: { S: '000071rgIp2HEwPLL0DlUzzNz', D: '0000718DIVzs185XJ51lSLLKL', U: '00007123IreFoXmQrE6DcppJp' },
  SID: { 'sid-7D1FAF2B-3297-4105-B482-832DC6E445AB': 'sid-E8DBB1C2-7337-462C-B20C-8DC88AC31727' },
  CODEMAP: { '00007115IDNLS65mMp63dH55o5_table_advance-4': '000071rgIp2HEwPLL0DlUzzNz_table_advance-2' },
  LAYOUT: {
    S: [['child', 'L1:child_form-2'], ...CONTENT, ['L1', 'upload_file-1'], 'h2-3', 'text-1', 'table_advance-2', ['child', 'L1:child_form-1']],
    D: [['child', 'L1:child_form-3'], ...CONTENT, ['L1', 'upload_file-1'], 'h2-3', 'text-1', 'table_advance-2', ['child', 'L1:child_form-1'], ['child', 'L1:child_form-2'],
      ['splitter', 'splitter-1', [['L1', 'textField_ticketName-1'], ['L1', 'rich_text_advance-1'], ['L1', 'rich_text_advance-2']]]],
    U: [['child', 'L1:child_form-3'], ['child', 'L1:child_form-2', { readonly: true }], ['own', 'S', { reuse: 'child_form-1' }]],
  },
  LABELS: { S: { 'table_advance-2': ATT }, D: { 'table_advance-2': ATT } },
  INH: { soan: 'sid-BE3A1E5E-333A-4FA5-B9C3-0CBAC4A78633', duyet: 'sid-E8DBB1C2-7337-462C-B20C-8DC88AC31727', update: 'sid-BA08B8A3-A585-49DF-BA35-65AF151C017C' },
};
module.exports.SRC = module.exports.L1; module.exports.DST = module.exports.L2;
module.exports.EFLOW = {
  M2: '00007RmI8EU1VDa5n8q',
  TEXT: [['Trên 500tr_Tờ trình phê duyệt trúng thầu_', '3_Tờ trình mua sắm_']],
  NODES: [['E31AD611', 'BE3A1E5E'], ['3A916F9D', 'BA08B8A3'], ['2D52ACF0', 'D4AAC553'], ['1A0B1EB2', '532C124D'], ['068191C9', '6D021A8F'], ['CD0AE650', 'BEBA4F68']],
  INHERIT: [],
  NOTIFY: [['2D52ACF0', 'D4AAC553'], ['1A0B1EB2', '532C124D'], ['068191C9', '6D021A8F'], ['CD0AE650', 'BEBA4F68']],
  IMPL_FORM: [['E8DBB1C2', { formId: '000071rgIp2HEwPLL0DlUzzNz', fieldId: '0000714XIkQtdLArKXAdcPPOP_dropdown-1', hashid: 'y9s7bz520', label: '[HT] DS người thực hiện (phòng ban + email người ký)', userTaskId: 'sid-BE3A1E5E-333A-4FA5-B9C3-0CBAC4A78633' }]],
};
