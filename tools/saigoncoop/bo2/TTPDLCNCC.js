// Tờ trình phê duyệt lựa chọn NCC (L2) ← khung ký của Tờ trình phê duyệt trúng thầu (L1). Không có bản in eWriter → bỏ field ngày/tháng/năm, hình thức lập, xem tài liệu.
const ATT = { cols: [[0, 'Loại tài liệu'], [3, 'Tài liệu tải lên']], label: 'Bảng tài liệu đính kèm' };
const CONTENT = [
  'h1-1', 'h2-1', ['cols', 'textField-1', 'datepicker-1'], ['cols', 'dropdown-1', 'textField-4'], ['cols', 'textField-5', 'textField-2'],
  ['cols', 'textField-3', 'dropdown-4'], 'textArea-1', 'h2-2', ['cols', 'number-1', 'number-2'], 'h3-1', 'table_advance-1',
];
module.exports = {
  L1: { S: '00007115IDNLS65mMp63dH55o5', D: '000071QwILlQhn3RbL9M5UDDGD', U: '000071arIn6aS5V6KeOqaillpl' },
  L2: { S: '000071mzIE3UW4BxN38QUMMvM', D: '000071WBIAATaQkm6yz1S66G6', U: '000071VoIl0twgJ4o0PXI99V9' },
  SID: { 'sid-7D1FAF2B-3297-4105-B482-832DC6E445AB': 'sid-9FA47E2A-BF4B-4F9E-A31B-858B6D90B12E' },
  CODEMAP: { '00007115IDNLS65mMp63dH55o5_table_advance-4': '000071mzIE3UW4BxN38QUMMvM_table_advance-2' },
  LAYOUT: {
    S: [['child', 'L1:child_form-2'], ...CONTENT, ['L1', 'upload_file-1'], 'h2-3', 'text-1', 'table_advance-2', ['child', 'L1:child_form-1']],
    D: [['child', 'L1:child_form-3'], ...CONTENT, ['L1', 'upload_file-1'], 'h2-3', 'text-1', 'table_advance-2', ['child', 'L1:child_form-1'], ['child', 'L1:child_form-2'],
      ['splitter', 'splitter-1', [['L1', 'textField_ticketName-1'], ['L1', 'rich_text_advance-1'], ['L1', 'rich_text_advance-2']]]],
    U: [['child', 'L1:child_form-3'], ['child', 'L1:child_form-2', { readonly: true }], ['own', 'S', { reuse: 'child_form-1' }]],
  },
  LABELS: { S: { 'h2-3': 'TÀI LIỆU ĐÍNH KÈM', 'table_advance-2': ATT }, D: { 'h2-3': 'TÀI LIỆU ĐÍNH KÈM', 'table_advance-2': ATT } },
};
module.exports.INH = { soan: 'sid-4C906557-55A8-4022-8D36-93FB67A261E1', duyet: 'sid-9FA47E2A-BF4B-4F9E-A31B-858B6D90B12E', update: 'sid-6CDFF2BB-BBDF-49E6-A9D7-7D584ADB253E' };
module.exports.SRC = module.exports.L1; module.exports.DST = module.exports.L2;
module.exports.EFLOW = {
  TEXT: [['Trên 500tr_Tờ trình phê duyệt trúng thầu_', 'Dưới 500tr_Tờ trình phê duyệt lựa chọn NCC_']],
  NODES: [['E31AD611', '4C906557'], ['3A916F9D', '6CDFF2BB'], ['2D52ACF0', '99D986A8'], ['1A0B1EB2', 'ADF61DF2'], ['068191C9', 'DB7A6CD0'], ['CD0AE650', '6F5C26DD']],
  INHERIT: [],
  NOTIFY: [['2D52ACF0', '99D986A8'], ['1A0B1EB2', 'ADF61DF2'], ['068191C9', 'DB7A6CD0'], ['CD0AE650', '6F5C26DD']],
  IMPL_FORM: [['9FA47E2A', { formId: '000071mzIE3UW4BxN38QUMMvM', fieldId: '0000714XIkQtdLArKXAdcPPOP_dropdown-1', hashid: 'y9s7bz520', label: '[HT] DS người thực hiện (phòng ban + email người ký)', userTaskId: 'sid-4C906557-55A8-4022-8D36-93FB67A261E1' }]],
};
