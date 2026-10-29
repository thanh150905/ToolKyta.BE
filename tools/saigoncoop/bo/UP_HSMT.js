// Update form vòng ký lại eContract: tiêu đề riêng → khối Người/Lý do trả về (TC, có cờ ẩn "Đã nộp lại") → form Start (ẩn tiêu đề Start).
module.exports = {
  IDS: { S: "00007115I3Dc65GR43G3c55o5", U: "0000719yI3A6UnDQzeAvVull5l", _onlyU: true },
  MV: { U: { "dropdown-4": "DROP" } },
  LAYOUT: { U: (SUB, IDS) => [["head", null, "h1", "HỒ SƠ MỜI THẦU"], ["child", SUB.TC], ["child", IDS.S, { reuse: "child_form-1", hide: ["h1-1"] }]] },
  LABELS: { U: {} },
};
