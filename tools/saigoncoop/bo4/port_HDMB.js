// Luồng 4 (Chỉ định thầu) — Hợp đồng mua bán ← L1 (28/10).
module.exports = {
  SRC: { S: '000071ENIpKTrXAawmKRtJJ4J', U: '00007115IDdws65qb8By2t55o5' },
  DST: { S: '000071dMIGpCzRzpQGDwcnnan', U: '000071LEIBAcGkGgq8pnHxxPx' },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN', '00007MgI0IRA5p44L'],
};
// eFlow L4 (Chỉ định thầu): chép từ node L1 tương ứng (kể cả node Tổng hợp sau eContract) (cặp 8 ký tự đầu sid, ghép theo vị trí trên sơ đồ 28/10).
module.exports.EFLOW = { M2: '00007KnIxQsND4RPgd0', NODES: [['5D18F724', '48BB817F'], ['23A1AE61', 'D2CDEEB1'], ['D32CCB23', '792C8FE3'], ['7163E4A5', 'D94A8C0B']], INHERIT: [['5D18F724', '48BB817F'], ['D32CCB23', '792C8FE3'], ['7163E4A5', 'D94A8C0B']], NOTIFY: [], TEXT: [['000071PnI8EgiQg0w4vEWSDDPD', '000071XrIqdcv1v9A18zSMMdM'], ['000071zKIXqcpee0rgrdS6616', '000071N1IM4CNKN9OVM9cJJGJ']] };
