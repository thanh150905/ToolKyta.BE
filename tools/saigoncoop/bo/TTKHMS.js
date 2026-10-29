// Tờ trình kế hoạch mua sắm — bảng tài liệu đính kèm (table_advance-4/-5) là biến thể riêng → giữ trong form, không dùng F.
// Không đổi label: field docx (Start textField-18/19/20, number-*, ...; Duyệt rich_text 1/2) + Ticket Name Start (mail eNotify).
const IDS = { S: '0000710eIm3i2QNgRxJgF44n4', D: '000071lKI4NC0lO3A4KJHqqgq', U: '000071RmIDMt1pOgz6Aaizzxz' };
const top = [
  'h1-1', 'text-1', 'h1-2', 'textField-16',
  ['cols', 'textField-1', 'datepicker-1'], ['cols', 'textField-14', 'textField-15'],
  ['cols', 'number-9', 'number-10'], 'datepicker-11',
  'h1-3', 'h1-4', 'h2-2', 'table_advance-1', 'number-8', 'h2-3', 'table_advance-3',
  'h2-5', 'textField-17', 'h3-3',
  ['cols', 'number-1', 'number-2'], ['cols', 'number-3', 'number-4'], ['cols', 'number-5', 'number-6'], 'number-7',
];
module.exports = {
  IDS,
  LAYOUT: {
    S: SUB => [...top, 'upload_file-2', 'h3-2', 'table_advance-4', 'text-2', 'view_ewriter-1', ['child', SUB.GS],
      ['splitter', 'splitter-1', ['datepicker-12', 'textField_ticketName-1', 'upload_file-1', 'textField-18', 'textField-19', 'textField-20', 'textField-21', 'textField-22']]],
    D: SUB => [...top, 'upload_file-1', 'h2-4', 'table_advance-5', 'text-2', 'view_ewriter-2', ['child', SUB.GD], ['child', SUB.B],
      ['splitter', 'splitter-1', ['textField-59', 'textField-60', 'textField-61', 'textField-62', 'upload_file-2', 'textField-18', 'textField-19', 'textField-20',
        'textField-63', 'table_advance-7', 'rich_text_advance-1', 'rich_text_advance-2']]],
    U: (SUB, IDS) => [['child', SUB.A, { readonly: true }], ['child', IDS.S, { reuse: 'child_form-1' }]],
  },
  LABELS: {
    S: { 'datepicker-12': '[HT] Ngày giờ hiện tại', 'upload_file-1': '[HT] Upload lưu tài liệu tham chiếu',
      'textField-21': '[HT] Ngày giờ đã chuẩn hoá (Convert date)', 'textField-22': '[HT] Ngày giờ dạng chuỗi (nguồn chuẩn hoá)' },
    D: { 'textField-59': '[MAIL] Ticket Name', 'textField-60': '[MAIL] Tiêu đề mail', 'textField-61': '[MAIL] Họ tên người nhận (người ký kế tiếp)',
      'textField-62': '[MAIL] DS họ tên người đã ký (báo YCCS)', 'upload_file-2': '[HT] Upload lưu tài liệu tham chiếu',
      'textField-18': '[HT] Ngày hiện tại', 'textField-19': '[HT] Tháng hiện tại', 'textField-20': '[HT] Năm hiện tại',
      'textField-63': '[HT] BASE_URL', 'table_advance-7': '[KÝ] Bảng chữ ký hiển thị (chưa dùng)' },
    U: {},
  },
};
