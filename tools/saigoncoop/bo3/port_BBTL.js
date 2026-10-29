// Biên bản thanh lý (L3) ← L1, field đúng như L1 (28/10).
module.exports = {
  SRC: { S: '000071gbI5UgmnL2vkBIooxo', U: '000071dMId0tzdLX6wDxunnan' },
  DST: { S: '000071BXIPBCgxGBD3ylIOOJO', U: '000071yMIrlC5gk2x8NyiAAbA' },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN'],
};
// eFlow L3: chép kế thừa node sửa L1 → L3 (cặp 8 ký tự đầu sid: soạn, sửa, eContract); form upload eContract L1 → L3.
const EC = [['000071PnI8EgiQg0w4vEWSDDPD', '0000713LIPPtnp8WGewAiGG0G'], ['000071dMIK5dfzOyWX9Bkcnnan', '000071KnID8tNDE9MWnxSKK3K']];
module.exports.EFLOW = { M2: '00007RmI8EU1VDa5n8q', NODES: [['48E5242B', '8FAE1194'], ['42EEF74E', 'F2BC7CEB'], ['4F0AFC58', '871024B3']], INHERIT: [['42EEF74E', 'F2BC7CEB']], NOTIFY: [], TEXT: EC };
