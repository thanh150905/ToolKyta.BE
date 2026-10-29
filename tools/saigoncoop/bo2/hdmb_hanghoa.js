// ============================================================
// CONFIG
// ============================================================
const CONFIG = Object.freeze({
  // TODO: dán ID thật của table "Bảng danh sách hàng hóa"
  TABLE_ID: "{{000071KnI6VsNvMQXoLdFKK3K_table_advance-1}}",

  // COL: index cột trong mảng row (0-based), KHÔNG phải column ID.
  // Đếm theo thứ tự cột hiển thị trên form:
  // STT | Mô tả | Đơn vị | Số lượng | Đơn giá | TT chưa thuế | VAT | TT có thuế
  // ENV-DIFF: nếu chèn/xóa cột, phải cập nhật lại toàn bộ index bên dưới.
  COL: Object.freeze({
    STT:           0,
    MO_TA:         1,
    DON_VI:        2,
    SO_LUONG:      3,
    DON_GIA:       4,
    THANH_TIEN_CT: 5,   // = Số lượng × Đơn giá
    VAT:           6,    // dropdown "10%" / "30%"
    THANH_TIEN_BT: 7,   // = chưa thuế × (1 + VAT)
  }),

  // 3 ô inputtext tổng — nằm NGOÀI table.
  TOTAL: Object.freeze({
    TRUOC_THUE: "{{000071KnI6VsNvMQXoLdFKK3K_number-6}}",
    VAT:        "{{000071KnI6VsNvMQXoLdFKK3K_number-7}}",
    SAU_THUE:   "{{000071KnI6VsNvMQXoLdFKK3K_number-8}}",
  }),
});

// ============================================================
// UTILITIES
// ============================================================

/**
 * Chuẩn hóa về number. Ô nhập tay có thể kèm dấu phân cách nghìn (".")
 * hoặc thập phân (","), tính thẳng trên chuỗi sẽ ra NaN.
 */
function toNumber(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;
  const cleaned = String(raw)
    .replace(/[^\d,.\-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // "." phân cách nghìn -> bỏ
    .replace(/,/g, ".");               // "," thập phân -> "."
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** VAT "10%" -> 0.1. FIXME: xác nhận value option là "10%"/"10"/0.1. */
function parseVatRate(rawVat) {
  return toNumber(rawVat) / 100;
}

// ============================================================
// BUSINESS LOGIC
// ============================================================

let isRecalculating = false; // chặn loop khi changeFieldValue kích lại change event

function recalcTable() {
  if (isRecalculating) return;

  const rows = getFieldValue(CONFIG.TABLE_ID);
  if (!Array.isArray(rows)) return;

  isRecalculating = true;
  try {
    let tongTruocThue = 0;
    let tongSauThue = 0;
    let isChanged = false;

    const newRows = rows.map(function (row, index) {
      // Clone để không mutate mảng gốc trước khi so sánh isChanged.
      const newRow = Array.isArray(row) ? row.slice() : [];

      // 1. STT tự tăng theo vị trí dòng.
      newRow[CONFIG.COL.STT] = index + 1;

      const soLuong = toNumber(newRow[CONFIG.COL.SO_LUONG]);
      const donGia  = toNumber(newRow[CONFIG.COL.DON_GIA]);
      const vatRate = parseVatRate(newRow[CONFIG.COL.VAT]);

      // 2 & 3. Làm tròn về đồng — VND không có đơn vị lẻ.
      const thanhTienCT = Math.round(soLuong * donGia);
      const thanhTienBT = Math.round(thanhTienCT * (1 + vatRate));

      newRow[CONFIG.COL.THANH_TIEN_CT] = thanhTienCT;
      newRow[CONFIG.COL.THANH_TIEN_BT] = thanhTienBT;

      tongTruocThue += thanhTienCT;
      tongSauThue   += thanhTienBT;

      // Chỉ đánh dấu changed nếu 3 ô dẫn xuất khác giá trị cũ.
      if (row[CONFIG.COL.STT] !== newRow[CONFIG.COL.STT] ||
          row[CONFIG.COL.THANH_TIEN_CT] !== thanhTienCT ||
          row[CONFIG.COL.THANH_TIEN_BT] !== thanhTienBT) {
        isChanged = true;
      }
      return newRow;
    });

    // Chỉ ghi lại table khi thật sự có thay đổi -> giảm nguy cơ re-trigger.
    if (isChanged) changeFieldValue(CONFIG.TABLE_ID, newRows);

    // 4 & 6. Hai tổng cộng dồn từ vòng lặp.
    changeFieldValue(CONFIG.TOTAL.TRUOC_THUE, tongTruocThue);
    changeFieldValue(CONFIG.TOTAL.SAU_THUE, tongSauThue);

    // 5. Tổng VAT = sau thuế − trước thuế (đúng công thức yêu cầu).
    changeFieldValue(CONFIG.TOTAL.VAT, tongSauThue - tongTruocThue);
  } finally {
    isRecalculating = false;
  }
}

// ============================================================
// EVENTS BINDING & INIT
// ============================================================

// Debounce: gom nhiều change liên tiếp (gõ nhanh, thêm/xóa dồn) thành 1 lần tính.
let debounceTimer = null;
function handler() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(recalcTable, 100);
}

// Bind ở cấp TABLE — vì cột không có ID riêng, không bind theo cột được.
// Mọi thay đổi ô trong table đều đi qua change event của table.
bindFieldChangeEvent(CONFIG.TABLE_ID, handler);
bindFieldAction("addRowTable", CONFIG.TABLE_ID, handler);
bindFieldAction("deleteRowTable", CONFIG.TABLE_ID, handler);

// Tính lần đầu khi mở form.
bindFieldAction("onInitData", CONFIG.TABLE_ID, recalcTable);

