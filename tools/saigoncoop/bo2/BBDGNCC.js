// Biên bản đánh giá NCC (L2) ← khung ký Biên bản họp hội đồng thầu (L1). Không có bản in → bỏ field ngày/tháng/năm.
// Giữ code nghiệp vụ L2: tổng Giá đề xuất → number-1 (cổng so sánh 300tr), tổng điểm bảng kết quả đánh giá.
const L2S = '0000718DILvh18xJgQOWCLLKL';
const BBDG = `// bbdg.js — nghiệp vụ Biên bản đánh giá NCC (giữ từ form cũ luồng 2).
//   (1) Tổng cột "Giá đề xuất" bảng đề xuất → number-1 ẩn (cổng so sánh trên/dưới 300 triệu đọc field này).
//   (2) Tổng điểm = điểm kỹ thuật + điểm thương mại trong bảng kết quả đánh giá.
(function () {
  var TBL_DE_XUAT = "{{${L2S}_table_advance-2}}";
  var NUM_TONG_GIA = "{{${L2S}_number-1}}";
  var TBL_DANH_GIA = "{{${L2S}_table_advance-4}}";
  var COL_GIA = 1, COL_KT = 3, COL_TM = 4, COL_TONG = 5;

  function layO(row, idx) {
    if (Array.isArray(row)) return row[idx];
    if (row && typeof row === "object") return Object.values(row)[idx];
    return undefined;
  }
  // Bỏ mọi ký tự phân tách → nhận cả "1,000,000" lẫn "1.000.000".
  function parseTien(raw) {
    var n = parseInt(String(raw == null ? "" : raw).replace(/[^\\d-]/g, ""), 10);
    return isFinite(n) ? n : 0;
  }
  function parseDiem(raw) { return parseFloat(String(raw == null ? "" : raw).replace(/,/g, "")) || 0; }

  // number-1 là field số → ghi số (không format) để cổng so sánh được.
  function tinhTongGia() {
    var rows = getFieldValue(TBL_DE_XUAT);
    if (!Array.isArray(rows)) return;
    changeFieldValue(NUM_TONG_GIA, rows.reduce(function (acc, row) { return acc + parseTien(layO(row, COL_GIA)); }, 0));
  }

  var dangGhi = false;   // chặn vòng lặp do changeFieldValue kích hoạt lại sự kiện bảng
  function tinhTongDiem() {
    if (dangGhi) return;
    var rows = getFieldValue(TBL_DANH_GIA);
    if (!Array.isArray(rows)) return;
    var doi = false;
    var moi = rows.map(function (row) {
      if (!Array.isArray(row) || row.length <= COL_TONG || String(row[0]).trim() === "Nhà cung cấp") return row;
      var tong = String(parseDiem(row[COL_KT]) + parseDiem(row[COL_TM]));
      if (String(row[COL_TONG]) === tong) return row;
      var r = row.slice(); r[COL_TONG] = tong; doi = true; return r;
    });
    if (!doi) return;
    dangGhi = true;
    changeFieldValue(TBL_DANH_GIA, moi);
    setTimeout(function () { dangGhi = false; }, 200);
  }

  bindFieldChangeEvent(TBL_DE_XUAT, tinhTongGia);
  bindFieldChangeEvent(TBL_DANH_GIA, tinhTongDiem);
  tinhTongGia();
  tinhTongDiem();
})();
`;
const CONTENT = ['h1-1', 'h2-1', 'dropdown-3', ['cols', 'textField-1', 'textField-2'], 'h2-2', 'table_advance-1', 'h2-6', 'textArea-1',
  'h2-3', 'table_advance-4', 'h2-4', 'table_advance-2'];
const ATT = { cols: [[0, 'Loại tài liệu']], label: 'Bảng tài liệu đính kèm' };
module.exports = {
  L1: { S: '000071owIPz0UoG8LGGE8t44b4', D: '000071VoIPz2IwlReM2WaI99V9', U: '0000718DIPGqt16DW9WQVSLLKL' },
  L2: { S: L2S, D: '000071xnIb1HEJ3M0g33TEEME', U: '000071BXIg8fgx6M9lMAsOOJO' },
  SID: { 'sid-4E9FBC2B-7633-497C-9D37-10130D7A69D6': 'sid-D646A325-825B-4421-9F1F-F179EE256752' },
  CODEMAP: {
    '000071owIPz0UoG8LGGE8t44b4_table_advance-1': `${L2S}___TABLE_STT_1__`,
    '000071owIPz0UoG8LGGE8t44b4_table_advance-2': `${L2S}___TABLE_STT_2__`,
    '000071owIPz0UoG8LGGE8t44b4_table_advance-3': `${L2S}___TABLE_STT_3__`,
    '000071owIPz0UoG8LGGE8t44b4_table_advance-7': `${L2S}_table_advance-3`,
  },
  LAYOUT: {
    S: [['child', 'L1:child_form-2'], ...CONTENT, ['L1', 'upload_file-2'], 'h2-5', 'text-1', 'table_advance-3', ['child', 'L1:child_form-1'], ['splitter', 'splitter-1', ['number-1']]],
    D: [['child', 'L1:child_form-3'], ...CONTENT, ['L1', 'upload_file-1'], 'h2-5', 'text-1', 'table_advance-3', ['child', 'L1:child_form-1'], ['child', 'L1:child_form-2'],
      ['splitter', 'splitter-1', [['L1', 'textField_ticketName-1'], ['L1', 'textField-29'], ['L1', 'textField-28'], ['L1', 'textField-30'], ['L1', 'rich_text_advance-1'], ['L1', 'rich_text_advance-2']]]],
    U: [['child', 'L1:child_form-3'], ['child', 'L1:child_form-2', { readonly: true }], ['own', 'S', { reuse: 'child_form-1' }]],
  },
  LABELS: { S: { 'table_advance-3': ATT }, D: { 'table_advance-3': ATT } },
  EXTRA_CODE: { S: { bbdg: BBDG }, U: { bbdg: BBDG } },
  INH: { soan: 'sid-B8E502E3-63BB-4ADF-A478-F4F43B22AE79', duyet: 'sid-D646A325-825B-4421-9F1F-F179EE256752', update: 'sid-87FC230F-C255-4483-9445-41E26B4F8BF9' },
};
module.exports.SRC = module.exports.L1; module.exports.DST = module.exports.L2;
module.exports.EFLOW = {
  TEXT: [['Trên 500tr_Biên bản họp hội đồng thầu_', 'Dưới 500tr_Biên bản đánh giá NCC_']],
  NODES: [['AADDE8D5', 'B8E502E3'], ['4B48F1EC', '87FC230F'], ['1FB01E8B', '10D76A26'], ['69B7AAE4', '307360B5'], ['67375179', '5A1E4A78'], ['AA710328', '9C486095']],
  INHERIT: [],
  NOTIFY: [['1FB01E8B', '10D76A26'], ['69B7AAE4', '307360B5'], ['67375179', '5A1E4A78'], ['AA710328', '9C486095']],
  IMPL_FORM: [['D646A325', { formId: L2S, fieldId: '0000714XIkQtdLArKXAdcPPOP_dropdown-1', hashid: 'y9s7bz520', label: '[HT] DS người thực hiện (phòng ban + email người ký)', userTaskId: 'sid-B8E502E3-63BB-4ADF-A478-F4F43B22AE79' }]],
};
