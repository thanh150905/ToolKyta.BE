// Tờ trình mua sắm (L3) ← clone Tờ trình kế hoạch mua sắm L1 (user chốt 28/10, thay nội dung riêng L3). Bỏ nút xem bản in Duyệt (L3 chưa có bản in).
module.exports = {
  SRC: { S: '0000710eIm3i2QNgRxJgF44n4', D: '000071lKI4NC0lO3A4KJHqqgq', U: '000071RmIDMt1pOgz6Aaizzxz' },
  DST: { S: '000071rgIp2HEwPLL0DlUzzNz', D: '0000718DIVzs185XJ51lSLLKL', U: '00007123IreFoXmQrE6DcppJp' },
  SID: { 'sid-2F4F3C02-8612-4C65-BD84-C4B1D4107AC8': 'sid-E8DBB1C2-7337-462C-B20C-8DC88AC31727' },
  TEXT: [['Trên 500tr Đấu thầu', '10-50tr Khảo sát giá & Mua trực tiếp']],
  SKIP: { D: ['view_ewriter-2'] },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN', '00007MgI0IRA5p44L'],
};
// eFlow L3: node 3 Duyệt ← L1 node 2, node 3.1 Update ← L1 node 2.1; eNotify quanh bộ tờ trình y như L1 (user chốt 28/10); nguồn Start L1 = node 2 soạn tờ trình L3.
module.exports.EFLOW = { M2: '00007RmI8EU1VDa5n8q', START_AS: 'sid-BE3A1E5E-333A-4FA5-B9C3-0CBAC4A78633', NODES: [['2F4F3C02', 'E8DBB1C2'], ['2323957E', 'BA08B8A3'], ['AD07029D', 'D4AAC553'], ['247CDF93', 'BEBA4F68'], ['27654F6A', '532C124D'], ['21102E80', '6D021A8F']], INHERIT: [['2F4F3C02', 'E8DBB1C2'], ['2323957E', 'BA08B8A3']],
  NOTIFY: [['AD07029D', 'D4AAC553'], ['247CDF93', 'BEBA4F68'], ['27654F6A', '532C124D'], ['21102E80', '6D021A8F']], TEXT: [['Trên 500tr_Tờ trình kế hoạch mua sắm_', '3_Tờ trình mua sắm_']] };
