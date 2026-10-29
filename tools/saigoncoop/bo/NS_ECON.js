// Form upload file-econtract: chỉ gắn [HT] cho 2 field ẩn (giữ `code` status/reason_reject). Label "File econtract" chờ user xác nhận.
module.exports = {
  IDS: { S: '000071PnI8EgiQg0w4vEWSDDPD' }, MV: { S: {} },
  LAYOUT: { S: () => ['h1-1', 'h2-2', 'upload_file-1', 'text-1', 'text-2', ['splitter', 'splitter-1', ['dropdown-1', 'textField-4']]] },
  LABELS: { S: { 'dropdown-1': '[HT] Trạng thái eContract', 'textField-4': '[HT] Lý do từ chối ký' } },
};
