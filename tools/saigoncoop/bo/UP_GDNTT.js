// Update form vòng ký lại eContract: tiêu đề riêng → khối Người/Lý do trả về (TC, có cờ ẩn "Đã nộp lại") → form Start (ẩn tiêu đề Start).
module.exports = {
  IDS: { S: "000071XrIXklTvKrv9XGoHMMdM", U: "000071mzI8SW2AkLvBOiMMvM", _onlyU: true },
  MV: { U: {  } },
  LAYOUT: { U: (SUB, IDS) => [["head", null, "h1", "GIẤY ĐỀ NGHỊ THANH TOÁN"], ["child", SUB.TC, { reuse: "child_form-2" }], ["child", IDS.S, { reuse: "child_form-1", hide: ["h1-1"] }]] },
  LABELS: { U: {} },
};
