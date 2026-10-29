// Update form vòng ký lại eContract: tiêu đề riêng → khối Người/Lý do trả về (TC, có cờ ẩn "Đã nộp lại") → form Start (ẩn tiêu đề Start).
module.exports = {
  IDS: { S: "000071ENIpKTrXAawmKRtJJ4J", U: "00007115IDdws65qb8By2t55o5", _onlyU: true },
  MV: { U: {  } },
  LAYOUT: { U: (SUB, IDS) => [["head", null, "h1", "HỢP ĐỒNG MUA BÁN"], ["child", SUB.TC, { reuse: "child_form-2" }], ["child", IDS.S, { reuse: "child_form-1", hide: ["h1-1"] }]] },
  LABELS: { U: {} },
};
