// Update form vòng ký lại eContract: tiêu đề riêng → khối Người/Lý do trả về (TC, có cờ ẩn "Đã nộp lại") → form Start (ẩn tiêu đề Start).
module.exports = {
  IDS: { S: "000071mzIDJUW2zVzgMRUMMvM", U: "000071eMIl1aiW8r5aAd5t55p5", _onlyU: true },
  MV: { U: { "dropdown-2": "DROP" } },
  LAYOUT: { U: (SUB, IDS) => [["head", null, "h1", "HỢP ĐỒNG THUÊ ĐƠN VỊ TƯ VẤN"], ["child", SUB.TC], ["child", IDS.S, { reuse: "child_form-1", hide: ["h1-1"] }]] },
  LABELS: { U: {} },
};
