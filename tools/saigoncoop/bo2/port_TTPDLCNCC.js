// Tờ trình phê duyệt lựa chọn NCC (L2) ← clone nội dung Tờ trình phê duyệt trúng thầu (L1), user chốt 28/10.
// Giữ tiêu đề L2; bỏ nút xem bản in Duyệt (trỏ tài liệu eWriter L1 — L2 chưa có bản in).
module.exports = {
  SRC: { S: '00007115IDNLS65mMp63dH55o5', D: '000071QwILlQhn3RbL9M5UDDGD', U: '000071arIn6aS5V6KeOqaillpl' },
  DST: { S: '000071mzIE3UW4BxN38QUMMvM', D: '000071WBIAATaQkm6yz1S66G6', U: '000071VoIl0twgJ4o0PXI99V9' },
  SID: { 'sid-7D1FAF2B-3297-4105-B482-832DC6E445AB': 'sid-9FA47E2A-BF4B-4F9E-A31B-858B6D90B12E' },
  TEXT: [['TỜ TRÌNH PHÊ DUYỆT KẾT QUẢ TRÚNG ĐẤU THẦU VÀ KÝ HỢP ĐỒNG', 'TỜ TRÌNH PHÊ DUYỆT LỰA CHỌN NCC']],
  SKIP: { D: ['view_ewriter-1'] },
  KNOWN: ['000071JlI0Df4KBJ05JPsQQ1Q', '0000714XIkQtdLArKXAdcPPOP', '000071gbIlXigNQmyqJmHooxo', '000071w9IROCEaVw1d4ktzzpz', '0000710eIRqU2vxQM2EVH44n4', '000071dMIKAuzRaONEP3unnan', '00007123ImKho9AXnXAGtppJp', '00007AeIyUp5oRnwN'],
};
// eFlow: chép kế thừa node L1 → L2 (cặp 8 ký tự đầu sid: soạn, sửa/duyệt, eContract); form upload eContract L1 → L2.
module.exports.EFLOW = { NODES: [['E31AD611', '4C906557'], ['7D1FAF2B', '9FA47E2A'], ['3A916F9D', '6CDFF2BB']], INHERIT: [['E31AD611', '4C906557'], ['7D1FAF2B', '9FA47E2A'], ['3A916F9D', '6CDFF2BB']], NOTIFY: [] };
