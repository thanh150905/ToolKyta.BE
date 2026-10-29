// Luồng 4 (Chỉ định thầu) — Tờ trình mua sắm ← Tờ trình kế hoạch mua sắm L1 (user chốt 28/10). Bỏ nút xem bản in ở Duyệt (L4 chưa có bản in eWriter).
module.exports = {
  SRC: { S: '0000710eIm3i2QNgRxJgF44n4', D: '000071lKI4NC0lO3A4KJHqqgq', U: '000071RmIDMt1pOgz6Aaizzxz' },
  DST: { S: '000071lKI6DH0Q0JmyO8cqqgq', D: '000071GyIk9Ckvk3yoEvI99P9', U: '000071WBI9pHaWa3KXbkI66G6' },
  SID: { 'sid-2F4F3C02-8612-4C65-BD84-C4B1D4107AC8': 'sid-173B7D87-30EC-49FA-A350-69DA9B6BC9AE' },
  TEXT: [['Trên 500tr Đấu thầu', 'Chỉ định thầu']],
  SKIP: { D: ['view_ewriter-2'] },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN', '00007MgI0IRA5p44L'],
};
// eFlow L4 (Chỉ định thầu): chép từ node L1 tương ứng (cặp 8 ký tự đầu sid, ghép theo vị trí trên sơ đồ 28/10).
module.exports.EFLOW = {
  M2: '00007KnIxQsND4RPgd0',
  TEXT: [['Trên 500tr_Tờ trình kế hoạch mua sắm_', '4_Tờ trình mua sắm_']],
  NODES: [['2F4F3C02', '173B7D87'], ['2323957E', '56F0CD3E'], ['AD07029D', '827CC917'], ['247CDF93', '0EC0F85A'], ['27654F6A', '80CB5778'], ['21102E80', 'FD656252']],
  INHERIT: [['2F4F3C02', '173B7D87'], ['2323957E', '56F0CD3E']],
  NOTIFY: [['AD07029D', '827CC917'], ['247CDF93', '0EC0F85A'], ['27654F6A', '80CB5778'], ['21102E80', 'FD656252']],
  IMPL_FORM: [['173B7D87', { formId: '000071lKI6DH0Q0JmyO8cqqgq', fieldId: '0000714XIkQtdLArKXAdcPPOP_dropdown-1', hashid: 'y9s7bz520', label: '[HT] DS người thực hiện (phòng ban + email người ký)' }]],
};
