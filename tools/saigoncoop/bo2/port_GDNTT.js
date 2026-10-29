// Giấy đề nghị thanh toán (L2) ← L1; bỏ nút xem bản in + ghi chú eContract (user chốt 28/10).
module.exports = {
  SRC: { S: '000071XrIXklTvKrv9XGoHMMdM', U: '000071mzI8SW2AkLvBOiMMvM' },
  DST: { S: '000071xnI63sEJ3Vp96pHEEME', U: '000071mzIoqIW4B35pqncMMvM' },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN'],
};
// eFlow: chép kế thừa node L1 → L2 (cặp 8 ký tự đầu sid: soạn, sửa/duyệt, eContract); form upload eContract L1 → L2.
const EC = [['000071PnI8EgiQg0w4vEWSDDPD', '000071owIE3ioe3qVPRDf44b4'], ['000071dMIK5dfzOyWX9Bkcnnan', '000071rgImNhEakBmbWmCzzNz']];
module.exports.EFLOW = { NODES: [['CA6C25B7', 'A1CA4D71'], ['3B3C3B15', 'E9FB3BFD'], ['BF37FEA5', '0F24CB35']], INHERIT: [['3B3C3B15', 'E9FB3BFD']], NOTIFY: [], TEXT: EC };
