// Biên bản nghiệm thu (L2) ← L1, field đúng như L1 (user chốt 28/10).
module.exports = {
  SRC: { S: '000071KnIxfNayOV0NRTKK3K', U: '000071qOI9snOMQaVeGt99Q9' },
  DST: { S: '000071mzIe2UW4Bwe6eyFMMvM', U: '000071gbIlxsgyD35l3GTooxo' },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN'],
};
// eFlow: chép kế thừa node L1 → L2 (cặp 8 ký tự đầu sid: soạn, sửa/duyệt, eContract); form upload eContract L1 → L2.
const EC = [['000071PnI8EgiQg0w4vEWSDDPD', '000071owIE3ioe3qVPRDf44b4'], ['000071dMIK5dfzOyWX9Bkcnnan', '000071rgImNhEakBmbWmCzzNz']];
module.exports.EFLOW = { NODES: [['E7F075F9', '038E140F'], ['B0C53F77', '6E168AE0'], ['62AF1E22', '31CB7740']], INHERIT: [['B0C53F77', '6E168AE0']], NOTIFY: [], TEXT: EC };
