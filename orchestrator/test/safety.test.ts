import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { inspectCommand } from '../src/kyta/catalog.js';
import { kytaRun, clearReceipts, createReceipt, findValidReceipt, markReceiptUsed } from '../src/tools/kyta.js';
import { resolvePath, assertWritable, type ToolCtx } from '../src/tools/types.js';
import { validate, isModifyingTask } from '../src/swarm/overseer.js';
import { validateModelsConfig, config } from '../src/config.js';
import { sanitize, sanitizeObject } from '../src/sanitize.js';
import { acquirePathLock, releaseLocksForTask, clearAllLocks, isPathLocked } from '../src/tools/lock.js';
import { swarm } from '../src/swarm/swarm.js';
import { saveRun, saveTask } from '../src/swarm/store.js';
import type { Run, Task } from '../src/swarm/types.js';

// ── 1. Ma trận kiểm tra lệnh và subcommand ──
test('Ma trận phân loại lệnh: phát hiện đầy đủ read, write, local_write, high_risk và unknown', () => {
  // eform
  assert.deepEqual(inspectCommand(['eform', 'list', 'saigoncoop', 'sandbox']).impacts, ['server_read']);
  assert.deepEqual(inspectCommand(['eform', 'pull', 'saigoncoop', 'sandbox']).impacts, ['server_read', 'local_write']);
  assert.deepEqual(inspectCommand(['eform', 'push', 'workspace/saigoncoop/sandbox/eform/f1']).impacts, ['server_write']);
  assert.deepEqual(inspectCommand(['eform', 'field', 'list', 'workspace/saigoncoop/sandbox/eform/f1']).impacts, ['local_read']);
  assert.deepEqual(inspectCommand(['eform', 'field', 'set', 'workspace/saigoncoop/sandbox/eform/f1', 'key1', '--label', 'X']).impacts, ['local_write']);
  assert.deepEqual(inspectCommand(['eform', 'field', 'set', 'workspace/saigoncoop/sandbox/eform/f1', 'key1', '--label', 'X', '--push']).impacts, ['local_write', 'server_write']);
  assert.deepEqual(inspectCommand(['eform', 'field', 'add', 'workspace/saigoncoop/sandbox/eform/f1', 'text']).impacts, ['server_write', 'local_write']);
  assert.deepEqual(inspectCommand(['eform', 'field', 'group', 'workspace/saigoncoop/sandbox/eform/f1', 'k1,k2']).impacts, ['server_write', 'local_write']);
  assert.deepEqual(inspectCommand(['eform', 'field', 'move', 'workspace/saigoncoop/sandbox/eform/f1', 'k1', '--into', 'c1']).impacts, ['server_write', 'local_write']);
  assert.deepEqual(inspectCommand(['eform', 'field', 'delete', 'workspace/saigoncoop/sandbox/eform/f1', 'k1']).impacts, ['server_write', 'local_write', 'high_risk']);
  assert.deepEqual(inspectCommand(['eform', 'childform', 'list', 'workspace/saigoncoop/sandbox/eform/f1']).impacts, ['server_read']);
  assert.deepEqual(inspectCommand(['eform', 'childform', 'refresh', 'workspace/saigoncoop/sandbox/eform/f1']).impacts, ['server_write', 'local_write']);
  assert.deepEqual(inspectCommand(['eform', 'condition', 'list', 'workspace/saigoncoop/sandbox/eform/f1']).impacts, ['server_read']);
  assert.deepEqual(inspectCommand(['eform', 'condition', 'add', 'workspace/saigoncoop/sandbox/eform/f1', 'k1', 'equal', '1']).impacts, ['server_write']);
  assert.deepEqual(inspectCommand(['eform', 'condition', 'remove', 'workspace/saigoncoop/sandbox/eform/f1', 'cond1']).impacts, ['server_write', 'high_risk']);
  assert.deepEqual(inspectCommand(['eform', 'condition', 'toggle', 'workspace/saigoncoop/sandbox/eform/f1', 'cond1']).impacts, ['server_write']);
  assert.deepEqual(inspectCommand(['eform', 'registry']).impacts, ['local_read', 'local_write']);

  // eflow
  assert.deepEqual(inspectCommand(['eflow', 'list', 'saigoncoop', 'sandbox']).impacts, ['server_read']);
  assert.deepEqual(inspectCommand(['eflow', 'impl', 'workspace/f1', 'clear']).impacts, ['server_write', 'high_risk']);
  assert.deepEqual(inspectCommand(['eflow', 'notify', 'saigoncoop', 'sandbox', 'rm']).impacts, ['server_write', 'high_risk']);

  // eworkspace
  assert.deepEqual(inspectCommand(['eworkspace', 'dashboard', 'saigoncoop', 'sandbox', 'delete']).impacts, ['server_write', 'high_risk']);
  assert.deepEqual(inspectCommand(['eworkspace', 'preset', 'sandbox', 'add', 'd1']).impacts, ['local_write']);
  assert.deepEqual(inspectCommand(['eworkspace', 'preset', 'sandbox', 'reset', '--yes']).impacts, ['local_write', 'high_risk']);

  // Lệnh chưa khai báo / lệnh lạ -> valid = false
  const unk = inspectCommand(['eform', 'khong_ton_tai']);
  assert.equal(unk.valid, false);
  assert.match(unk.error ?? '', /chưa được khai báo/i);
});

// ── 2. Nhận diện PROD chuẩn xác ──
test('Nhận diện PROD từ metadata/tham số đích, không tìm chuỗi prod bừa bãi', () => {
  // Cờ --grep "product" không được coi là PROD
  const grepTest = inspectCommand(['eform', 'list', 'saigoncoop', 'sandbox', '--grep', 'product']);
  assert.equal(grepTest.target?.isProd, false);

  // Môi trường là prod thật
  const prodTest = inspectCommand(['eform', 'list', 'saigoncoop', 'prod']);
  assert.equal(prodTest.target?.isProd, true);

  // Preset prod
  const presetProd = inspectCommand(['eworkspace', 'preset', 'prod', 'list']);
  assert.equal(presetProd.target?.isProd, true);
});

// ── 3. Chặn agent read-only không được thực hiện lệnh ghi ──
test('Agent chỉ đọc (kyta: read) không được chạy lệnh ghi server', async () => {
  const readOnlyCtx: ToolCtx = {
    agent: { id: 'ba', name: 'BA', title: 'BA', model: 'fake', prompt: 'ba.md', tools: ['kyta_run'], kyta: 'read' },
    runId: 'r1',
    taskId: 't1',
    signal: new AbortController().signal,
    approve: async () => true,
    ask: async () => '',
    touched: () => {},
  };

  const res = await kytaRun.run({ args: ['eform', 'push', 'workspace/saigoncoop/sandbox/eform/f1'] }, readOnlyCtx);
  assert.match(res, /TỪ CHỐI: BA chỉ có quyền ĐỌC/);
});

// ── 4. Chặn lệnh ghi ngoài phạm vi scope và symlink escape ──
test('Chặn ghi ngoài phạm vi write scope và chặn symlink thoát khỏi repo', () => {
  const devAgent = { id: 'dev', name: 'Dev', title: 'Dev', model: 'fake', prompt: 'dev.md', tools: [], write: ['src/', 'test/'] };
  assert.throws(() => assertWritable(devAgent, 'workspace/data.json'), /Dev không được ghi "workspace\/data\.json"/);
  assert.doesNotThrow(() => assertWritable(devAgent, 'src/cli.js'));

  // Test symlink escape
  assert.throws(() => resolvePath('../../etc/passwd'), /Ngoài repo/);
  assert.throws(() => resolvePath('.git/config'), /bị chặn/);
  assert.throws(() => resolvePath('.env'), /bị chặn/);
});

// ── 5. Kill switch ALLOW_REAL_PUSH chặn ghi server thật ──
test('Kill switch ALLOW_REAL_PUSH=0 chặn toàn bộ lệnh ghi server thật', async () => {
  process.env.ALLOW_REAL_PUSH = '0';
  const configCtx: ToolCtx = {
    agent: { id: 'config', name: 'Config', title: 'Config', model: 'fake', prompt: 'config.md', tools: ['kyta_run'], kyta: 'write', write: ['workspace/'] },
    runId: 'r1',
    taskId: 't1',
    signal: new AbortController().signal,
    approve: async () => true,
    ask: async () => '',
    touched: () => {},
  };

  const res = await kytaRun.run({ args: ['eform', 'field', 'add', 'workspace/saigoncoop/sandbox/eform/f1', 'text'] }, configCtx);
  assert.match(res, /kill switch \(ALLOW_REAL_PUSH=0\)/);
});

// ── 6. Dry-run receipt lifecycle & duyệt ở backend ──
test('Dry-run receipt: từ chối khi thiếu dry-run, sai tham số, hết hạn hoặc từ chối duyệt', async () => {
  process.env.ALLOW_REAL_PUSH = '1';
  clearReceipts();

  let approveCalled = false;
  let approveDecision = true;
  const configCtx: ToolCtx = {
    agent: { id: 'config', name: 'Config', title: 'Config', model: 'fake', prompt: 'config.md', tools: ['kyta_run'], kyta: 'write', write: ['workspace/'] },
    runId: 'r1',
    taskId: 't1',
    signal: new AbortController().signal,
    approve: async () => { approveCalled = true; return approveDecision; },
    ask: async () => '',
    touched: () => {},
  };

  const writeArgs = ['eform', 'field', 'add', 'workspace/saigoncoop/sandbox/eform/f1', 'text'];

  // 1. Chưa có dry-run -> từ chối chạy thật
  const resNoDry = await kytaRun.run({ args: writeArgs }, configCtx);
  assert.match(resNoDry, /Chưa có kết quả dry-run thành công/);

  // 2. Tạo receipt giả lập
  createReceipt(writeArgs, { customer: 'saigoncoop', env: 'sandbox', resource: 'f1' }, 'diff mockup: +field text');

  // 3. Sai tham số (args khác) -> không khớp receipt
  const resMismatch = await kytaRun.run({ args: ['eform', 'field', 'add', 'workspace/saigoncoop/sandbox/eform/f1', 'number'] }, configCtx);
  assert.match(resMismatch, /Chưa có kết quả dry-run thành công/);

  // 4. Đúng tham số nhưng người dùng TỪ CHỐI duyệt
  approveDecision = false;
  const resRejected = await kytaRun.run({ args: writeArgs }, configCtx);
  assert.equal(approveCalled, true);
  assert.match(resRejected, /Người dùng TỪ CHỐI/);

  // 5. Receipt đã bị dùng -> không thể tái sử dụng
  const reused = findValidReceipt(writeArgs, { customer: 'saigoncoop', env: 'sandbox', resource: 'f1' });
  assert.equal(reused, null);

  process.env.ALLOW_REAL_PUSH = '0';
});

// ── 7. Bắt buộc kiểm chứng độc lập (QA) trong kế hoạch Overseer ──
test('Overseer validate: task sửa code/cấu hình phải có QA phụ thuộc', () => {
  const modTask = { id: 't1', agent: 'dev', title: 'Sửa code CLI', instructions: 'sửa file src/cli.js', dependsOn: [] };
  assert.equal(isModifyingTask(modTask), true);

  // Thiếu QA -> không hợp lệ
  const errNoQa = validate([modTask], new Set(), new Set());
  assert.match(errNoQa ?? '', /thiếu bước QA kiểm tra độc lập/);

  // Có QA nhưng không dependsOn -> không hợp lệ
  const qaUnlinked = { id: 't2', agent: 'qa', title: 'Kiểm thử', instructions: 'test', dependsOn: [] };
  const errQaUnlinked = validate([modTask, qaUnlinked], new Set(), new Set());
  assert.match(errQaUnlinked ?? '', /thiếu bước QA kiểm tra độc lập/);

  // Có QA phụ thuộc đúng -> hợp lệ
  const qaLinked = { id: 't2', agent: 'qa', title: 'Kiểm thử', instructions: 'test', dependsOn: ['t1'] };
  const ok = validate([modTask, qaLinked], new Set(), new Set());
  assert.equal(ok, null);
});

// ── 8. Kiểm tra cấu hình model lúc khởi động ──
test('validateModelsConfig: phát hiện agent dùng model thiếu bảng giá', () => {
  // Bình thường hợp lệ
  assert.doesNotThrow(() => validateModelsConfig());

  // Thử model lạ chưa có giá
  const originalPrices = { ...config.prices };
  delete config.prices['gemini-2.5-flash'];
  assert.throws(() => validateModelsConfig(), /chưa được khai báo trong bảng giá/);
  config.prices['gemini-2.5-flash'] = originalPrices['gemini-2.5-flash'];
});

// ── 9. Che dữ liệu nhạy cảm (sanitizer) ──
test('Sanitize che token, password và credentials khỏi log và context', () => {
  const secretStr = 'Bearer eyJhbGciOi... secret_key: "abc123456" password: "supersecretpassword" https://admin:pwd123@kyta.com';
  const cleaned = sanitize(secretStr);
  assert.doesNotMatch(cleaned, /eyJhbGciOi/);
  assert.doesNotMatch(cleaned, /supersecretpassword/);
  assert.doesNotMatch(cleaned, /pwd123/);
  assert.match(cleaned, /\[REDACTED/);
});

// ── 10. Khoá đường dẫn đồng thời (Path Lock) ──
test('Path Lock: ngăn chặn các task đồng thời sửa cùng file và tự động giải phóng khi task xong', () => {
  clearAllLocks();
  const filePath = 'workspace/saigoncoop/sandbox/eform/f1/formDef.json';

  // Task 1 khoá file thành công
  acquirePathLock(filePath, 'task-1', 'run-1', 'dev');
  assert.equal(isPathLocked(filePath), true);

  // Cùng task khoá lại không bị lỗi (re-entrant)
  assert.doesNotThrow(() => acquirePathLock(filePath, 'task-1', 'run-1', 'dev'));

  // Task 2 cố khoá cùng file → ném lỗi xung đột
  assert.throws(
    () => acquirePathLock(filePath, 'task-2', 'run-1', 'dev'),
    /đang bị khoá bởi task khác \(task-1/
  );

  // Giải phóng khoá của Task 1
  const released = releaseLocksForTask('task-1');
  assert.deepEqual(released, [filePath]);
  assert.equal(isPathLocked(filePath), false);

  // Task 2 giờ có thể khoá thành công
  assert.doesNotThrow(() => acquirePathLock(filePath, 'task-2', 'run-1', 'dev'));
  clearAllLocks();
});

// ── 11. Làm sạch dữ liệu nhạy cảm toàn diện (PII, Cookie, Object) ──
test('Sanitize PII, Cookie và object đệ quy', () => {
  const rawText = 'User email: test@fpt.com, phone: 0987654321, cccd: 001234567890, cookie: session_id=xyz123';
  const cleanedText = sanitize(rawText);
  assert.doesNotMatch(cleanedText, /test@fpt\.com/);
  assert.doesNotMatch(cleanedText, /0987654321/);
  assert.doesNotMatch(cleanedText, /001234567890/);
  assert.doesNotMatch(cleanedText, /xyz123/);
  assert.match(cleanedText, /\[REDACTED_EMAIL\]/);
  assert.match(cleanedText, /\[REDACTED_PHONE\]/);
  assert.match(cleanedText, /\[REDACTED_ID\]/);

  // Object đệ quy
  const obj = {
    user: 'admin',
    apiKey: 'sk-abcdef123456',
    meta: {
      password: 'mypassword',
      notes: 'Liên hệ email john@example.com',
    },
  };
  const cleanedObj = sanitizeObject(obj);
  assert.equal(cleanedObj.apiKey, '[REDACTED]');
  assert.equal(cleanedObj.meta.password, '[REDACTED]');
  assert.doesNotMatch(cleanedObj.meta.notes, /john@example\.com/);
});

// ── 12. Phục hồi run bị gián đoạn (resumeRun) ──
test('resumeRun: tiếp tục run bị gián đoạn từ các bước chưa xong và thêm chỉ dẫn idempotent', async () => {
  const runId = 'test-resume-run';
  const mockRun: Run = {
    id: runId,
    prompt: 'Cập nhật form f1',
    title: 'Cập nhật form f1',
    intent: 'feature',
    status: 'interrupted',
    summary: 'Bị ngắt do restart',
    digest: '',
    replans: 0,
    createdAt: Date.now(),
  };
  const taskDone: Task = {
    id: `${runId}.t1`,
    localId: 't1',
    runId,
    agent: 'ba',
    title: 'Phân tích',
    instructions: 'Đọc form f1',
    deps: [],
    status: 'done',
    result: 'STATUS: DONE',
    createdAt: Date.now(),
  };
  const taskInterrupted: Task = {
    id: `${runId}.t2`,
    localId: 't2',
    runId,
    agent: 'dev',
    title: 'Sửa field',
    instructions: 'Ghi thêm field vào form f1',
    deps: ['t1'],
    status: 'interrupted',
    result: '',
    createdAt: Date.now(),
  };

  swarm.runs.set(runId, mockRun);
  saveRun(mockRun);
  swarm.tasks.set(taskDone.id, taskDone);
  saveTask(taskDone);
  swarm.tasks.set(taskInterrupted.id, taskInterrupted);
  saveTask(taskInterrupted);

  // Tạm pause agent để không thực sự gọi LLM trong test
  const devAgent = swarm.agents.get('dev')!;
  devAgent.pause();

  const resumed = await swarm.resumeRun(runId);
  assert.equal(resumed.status, 'running');

  // Task t1 vẫn giữ nguyên 'done'
  assert.equal(swarm.tasks.get(taskDone.id)!.status, 'done');

  // Task t2 được đưa về 'pending' và bổ sung chỉ dẫn idempotent
  const t2 = swarm.tasks.get(taskInterrupted.id)!;
  assert.equal(t2.status === 'pending' || t2.status === 'queued', true);
  assert.match(t2.instructions, /\[PHỤC HỒI TỰ ĐỘNG\]/);
  assert.match(t2.instructions, /idempotent/);

  // Dọn dẹp
  devAgent.resume();
  swarm.cancelRun(runId);
});
