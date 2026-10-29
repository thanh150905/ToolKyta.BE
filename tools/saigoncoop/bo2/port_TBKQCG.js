// Thông báo kết quả chào giá (L2) ← clone nội dung Thông báo kết quả đấu thầu (L1), user chốt 28/10. Giữ tiêu đề L2, bỏ Preview.
module.exports = {
  SRC: { S: '000071OWI4q6FJr84lbQXcKKOK', U: '000071N1IEPKuNWzD0EmKHJJGJ' },
  DST: { S: '000071ENIVyHrQoPPJ80iJJ4J', U: '000071pyIO6IE2dq8GmPIQQKQ' },
  TEXT: [['THÔNG BÁO KẾT QUẢ LỰA CHỌN NHÀ THẦU', 'THÔNG BÁO KẾT QUẢ CHÀO GIÁ']],
  SKIP: { S: ['view_ewriter-1'] },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN'],
};
// eFlow: chép kế thừa node L1 → L2 (cặp 8 ký tự đầu sid: soạn, sửa/duyệt, eContract); form upload eContract L1 → L2.
const EC = [['000071PnI8EgiQg0w4vEWSDDPD', '000071owIE3ioe3qVPRDf44b4'], ['000071dMIK5dfzOyWX9Bkcnnan', '000071rgImNhEakBmbWmCzzNz']];
module.exports.EFLOW = { NODES: [['0F7C20D5', '8B09B8C3'], ['1A1D9C6A', '8CED9048'], ['C7D9287E', '3F8BDC30']], INHERIT: [['1A1D9C6A', '8CED9048']], NOTIFY: [], TEXT: EC };
