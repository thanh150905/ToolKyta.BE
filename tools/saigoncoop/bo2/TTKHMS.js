// Tờ trình kế hoạch mua sắm: luồng 1 → luồng 2. Field theo đúng L1 (28/10 user chốt bỏ datepicker-11 «Thời gian thực hiện gói thầu» của L2).
module.exports = {
  SRC: { S: '0000710eIm3i2QNgRxJgF44n4', D: '000071lKI4NC0lO3A4KJHqqgq', U: '000071RmIDMt1pOgz6Aaizzxz' },
  DST: { S: '000071XrIxCvVMNz13oTMMdM', D: '00007123I9FoXWbXdvKUppJp', U: '000071LEIetGJl6kvDXtxxPx' },
  SID: { 'sid-2F4F3C02-8612-4C65-BD84-C4B1D4107AC8': 'sid-C86D612A-0EF5-497C-928B-D87989F6EEA1' },
  TEXT: [['Trên 500tr Đấu thầu', 'Dưới 500tr Chào giá cạnh tranh']],
  DOC: { '0000718DIzpvc16DxM9rJ': '000071dMIK0Szdzeo4B1' },
  MAIL: {},
  EFLOW: {
    TEXT: [['Trên 500tr_Tờ trình kế hoạch mua sắm_', 'Dưới 500tr_Tờ trình kế hoạch mua sắm_']],
    // cặp node [L1, L2] (8 ký tự đầu sid): node bộ + eNotify quanh node Duyệt
    NODES: [['2323957E', '7278F84E'], ['AD07029D', '197E2D17'], ['27654F6A', '10F9E03F'], ['21102E80', 'EFEAC0D4'], ['247CDF93', 'A8F6A2B0']],
    INHERIT: [['2F4F3C02', 'C86D612A'], ['2323957E', '7278F84E']],
    NOTIFY: [['AD07029D', '197E2D17'], ['27654F6A', '10F9E03F'], ['21102E80', 'EFEAC0D4'], ['247CDF93', 'A8F6A2B0']],
    IMPL_FORM: [['C86D612A', { formId: '000071XrIxCvVMNz13oTMMdM', fieldId: '0000714XIkQtdLArKXAdcPPOP_dropdown-1', hashid: 'y9s7bz520', label: '[HT] DS người thực hiện (phòng ban + email người ký)' }]],
  },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '00007MgI0IRA5p44L'],
};
