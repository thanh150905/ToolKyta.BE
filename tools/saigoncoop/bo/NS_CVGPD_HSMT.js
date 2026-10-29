// Công văn gửi và phúc đáp: khối người thực hiện (chỉ đọc) → E readonly; 2 bảng công văn giữ, đặt tên.
const { E_MV } = require("./_common");
module.exports = {
  IDS: { S: "000071MgINgTlgLNJnpLHzzwz" }, MV: { S: { ...E_MV } },
  LAYOUT: { S: SUB => ["h1-1", "h2-1", "radio_button-1", ["child", SUB.E, { readonly: true }], "textArea-1", "h2-2", "table_advance-1", "h2-3", "table_advance-2", ["splitter", "splitter-1", ["upload_file-1"]]] },
  LABELS: { S: { "table_advance-1": "Bảng công văn đề nghị làm rõ (của nhà thầu)", "table_advance-2": "Bảng công văn phúc đáp (của chủ đầu tư)", "upload_file-1": "[HT] Upload file" } },
};
