// Thông báo kết quả đấu thầu (Start + Update). Update: dropdown "Yêu cầu chỉnh sửa" di sản → bỏ, thêm form con TC.
module.exports = {
  IDS: { S: '000071OWI4q6FJr84lbQXcKKOK', U: '000071N1IEPKuNWzD0EmKHJJGJ' },
  MV: { S: { 'table_advance-2': 'F.table_advance-1' }, U: { 'dropdown-2': 'DROP', 'textField-22': 'DROP', 'textField-23': 'DROP', 'textArea-1': 'DROP' } },
  LAYOUT: {
    S: SUB => ['h1-1', ['cols', 'textField-1', 'datepicker-1'], 'textField-2', 'h2-1', ['cols', 'textField-3', 'number-1'], 'textField-4',
      'h2-2', 'table_advance-1', 'upload_file-1', 'h2-3', 'text-1', ['child', SUB.F], 'view_ewriter-1',
      ['splitter', 'splitter-1', ['dropdown-1', 'textField-19', 'textField-20', 'textField-21']]],
    // Update: tiêu đề riêng → khối Người/Lý do trả về (TC, có cờ ẩn "Đã nộp lại") → form Start (ẩn tiêu đề Start để không lặp)
    U: (SUB, IDS) => [['head', null, 'h1', 'THÔNG BÁO KẾT QUẢ LỰA CHỌN NHÀ THẦU'], ['child', SUB.TC, { reuse: 'child_form-2' }], ['child', IDS.S, { reuse: 'child_form-1', hide: ['h1-1'] }]],
  },
  LABELS: { S: { 'dropdown-1': '[HT] DS người thực hiện (phòng ban + email người ký)', 'textField-19': '[HT] Ngày hiện tại', 'textField-20': '[HT] Tháng hiện tại', 'textField-21': '[HT] Năm hiện tại' }, U: {} },
};
