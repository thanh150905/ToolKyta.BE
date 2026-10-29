// Hợp đồng mua bán (L3) ← L1, cùng cách L2 (28/10): bỏ phụ lục hàng hoá + hanghoa.js + nút xem bản in; ghép cặp nhãn sai chính tả.
module.exports = {
  SRC: { S: '000071ENIpKTrXAawmKRtJJ4J', U: '00007115IDdws65qb8By2t55o5' },
  DST: { S: '0000719yI0dHnR6eQyzWfll5l', U: '000071nPInASbzPel6vzTWW4W' },
  ALIAS: { S: { 'textField-17': 'textField-17', 'datepicker-7': 'datepicker-7' } },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN'],
};
// eFlow L3: chép kế thừa node sửa L1 → L3 (cặp 8 ký tự đầu sid: soạn, sửa, eContract); form upload eContract L1 → L3.
const EC = [['000071PnI8EgiQg0w4vEWSDDPD', '0000713LIPPtnp8WGewAiGG0G'], ['000071dMIK5dfzOyWX9Bkcnnan', '000071KnID8tNDE9MWnxSKK3K']];
module.exports.EFLOW = { M2: '00007RmI8EU1VDa5n8q', NODES: [['23A1AE61', 'F9B2BEDA'], ['D32CCB23', '4589D94B'], ['7163E4A5', 'B4847305']], INHERIT: [['D32CCB23', '4589D94B']], NOTIFY: [], TEXT: EC };
