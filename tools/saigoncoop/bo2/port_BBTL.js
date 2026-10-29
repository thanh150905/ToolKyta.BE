// Biên bản thanh lý (L2) ← L1, field đúng như L1 (user chốt 28/10).
module.exports = {
  SRC: { S: '000071gbI5UgmnL2vkBIooxo', U: '000071dMId0tzdLX6wDxunnan' },
  DST: { S: '0000718DIP1h18x5D1yMtLLKL', U: '000071JlIGJc4Abk16q0iQQ1Q' },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN'],
};
// eFlow: chép kế thừa node L1 → L2 (cặp 8 ký tự đầu sid: soạn, sửa/duyệt, eContract); form upload eContract L1 → L2.
const EC = [['000071PnI8EgiQg0w4vEWSDDPD', '000071owIE3ioe3qVPRDf44b4'], ['000071dMIK5dfzOyWX9Bkcnnan', '000071rgImNhEakBmbWmCzzNz']];
module.exports.EFLOW = { NODES: [['48E5242B', 'C4CF1290'], ['42EEF74E', '8F3D1251'], ['4F0AFC58', '60E096D0']], INHERIT: [['42EEF74E', '8F3D1251']], NOTIFY: [], TEXT: EC };
