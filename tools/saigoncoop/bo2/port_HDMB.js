// Hợp đồng mua bán (L2) ← L1: bỏ Phụ lục hàng hoá + ô tổng + hanghoa.js, bỏ nút xem bản in (user chốt 28/10).
// Ghép cặp field khác nhãn để giữ hashid L2.
module.exports = {
  SRC: { S: '000071ENIpKTrXAawmKRtJJ4J', U: '00007115IDdws65qb8By2t55o5' },
  DST: { S: '000071KnI6VsNvMQXoLdFKK3K', U: '000071RmIepH1VmX669wizzxz' },
  ALIAS: { S: { 'textField-17': 'textField-17', 'datepicker-7': 'datepicker-7' } },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN'],
};
// eFlow: chép kế thừa node L1 → L2 (cặp 8 ký tự đầu sid: soạn, sửa/duyệt, eContract); form upload eContract L1 → L2.
const EC = [['000071PnI8EgiQg0w4vEWSDDPD', '000071owIE3ioe3qVPRDf44b4'], ['000071dMIK5dfzOyWX9Bkcnnan', '000071rgImNhEakBmbWmCzzNz']];
module.exports.EFLOW = { NODES: [['23A1AE61', '202B8FA3'], ['D32CCB23', '25A4DD29'], ['7163E4A5', '2E81A15A']], INHERIT: [['D32CCB23', '25A4DD29']], NOTIFY: [], TEXT: EC };
