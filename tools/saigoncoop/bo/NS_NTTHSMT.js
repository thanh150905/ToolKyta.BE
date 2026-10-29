// Nhận thông tin HSMT: khối người thực hiện → E; bảng danh sách nhà thầu + hàng nút + checkbox/text ẩn (dùng bởi điều kiện) → giữ chỗ.
const c = require("./_common").uploadForm("00007163IdbTv8e19GqosVVeV", { table: "keep" });
c.LAYOUT.S = SUB => ["h1-1", "h2-1", ["child", SUB.E], "h2-2", "text-1", "columns-3", "table_advance-1", "check_box-1", "text-2", ["splitter", "splitter-1", ["upload_file-1"]]];
module.exports = c;
