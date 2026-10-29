// Giấy đề nghị thanh toán (L3) ← L1 (28/10); «Tài ngân hàng» → nhãn L1 «Tại ngân hàng», giữ hashid L3.
module.exports = {
  SRC: { S: '000071XrIXklTvKrv9XGoHMMdM', U: '000071mzI8SW2AkLvBOiMMvM' },
  DST: { S: '000071MgIz4ilgG3n4ePHzzwz', U: '000071OWIv0cJm9WMr3qiKKOK' },
  ALIAS: { S: { 'textField-4': 'textField-4' } },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN'],
};
// eFlow L3: chép kế thừa node sửa L1 → L3 (cặp 8 ký tự đầu sid: soạn, sửa, eContract); form upload eContract L1 → L3.
const EC = [['000071PnI8EgiQg0w4vEWSDDPD', '0000713LIPPtnp8WGewAiGG0G'], ['000071dMIK5dfzOyWX9Bkcnnan', '000071KnID8tNDE9MWnxSKK3K']];
module.exports.EFLOW = { M2: '00007RmI8EU1VDa5n8q', NODES: [['CA6C25B7', '2CF2A3BF'], ['3B3C3B15', 'AF3D31B0'], ['BF37FEA5', '869E01DB']], INHERIT: [['3B3C3B15', 'AF3D31B0']], NOTIFY: [], TEXT: EC };
