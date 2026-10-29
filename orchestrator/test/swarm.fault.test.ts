// Test tiêm lỗi cho vòng lặp swarm — dùng LLM GIẢ (không tốn quota, không gọi mạng thật).
// Chạy: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, type Server } from 'node:http';

// ── LLM giả: phát lần lượt các phản hồi trong `script` ──
type Reply =
  | { content?: string; tools?: { name: string; args: unknown }[]; finish?: string; tokens?: number }
  | { status: number; body: string };
let script: Reply[] = [];
let calls = 0;
let llm: Server;

function completion(r: Exclude<Reply, { status: number }>) {
  const tool_calls = r.tools?.map((t, i) => ({ id: `call_${calls}_${i}`, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.args) } }));
  return {
    id: `c${calls}`, object: 'chat.completion', created: 0, model: 'fake',
    choices: [{ index: 0, message: { role: 'assistant', content: r.content ?? null, ...(tool_calls ? { tool_calls } : {}) }, finish_reason: r.finish ?? (tool_calls ? 'tool_calls' : 'stop') }],
    usage: { prompt_tokens: r.tokens ?? 100, completion_tokens: 10, total_tokens: (r.tokens ?? 100) + 10 },
  };
}

const plan = (tasks: unknown[], extra: Record<string, unknown> = {}) =>
  ({ content: JSON.stringify({ intent: 'config', title: 'T', summary: 's', tasks, ...extra }) });
const task = (id: string, agent: string, dependsOn: string[] = []) => ({ id, agent, title: `${agent} ${id}`, instructions: 'làm', dependsOn });
const done = (msg = 'xong') => ({ content: `${msg}\nSTATUS: DONE` });
const failed = (msg = 'hỏng') => ({ content: `${msg}\nSTATUS: FAILED — lỗi code` });

// Module swarm phải nạp SAU khi đặt biến môi trường (singleton tạo lúc import).
let swarm: typeof import('../src/swarm/swarm.js').swarm;
let inbox: typeof import('../src/swarm/inbox.js').inbox;
let bus: typeof import('../src/bus.js').bus;
let config: typeof import('../src/config.js').config;
let autoApprove = true;

before(async () => {
  llm = createServer((req, res) => {
    let b = '';
    req.on('data', (d) => (b += d)).on('end', () => {
      calls++;
      const r = script.shift() ?? { content: 'kịch bản đã hết\nSTATUS: FAILED — test' };
      if ('status' in r) { res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(r.body); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(completion(r)));
    });
  });
  await new Promise<void>((r) => llm.listen(0, '127.0.0.1', () => r()));
  const port = (llm.address() as { port: number }).port;
  process.env.LITELLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.LITELLM_MASTER_KEY = 'test';
  process.env.SWARM_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-test-'));
  process.env.SWARM_BACKOFF_MS = '20';
  process.env.SWARM_PLAN_APPROVAL = '1';

  ({ swarm } = await import('../src/swarm/swarm.js'));
  ({ inbox } = await import('../src/swarm/inbox.js'));
  ({ bus } = await import('../src/bus.js'));
  ({ config } = await import('../src/config.js'));
  for (const id of swarm.agents.keys()) swarm.setModel(id, 'fake-model');   // model không có rpm → không bị giãn cách
  bus.on('evt', (e: { type: string; item?: { id: string; kind: string; status: string } }) => {
    if (e.type === 'inbox' && e.item?.status === 'pending' && autoApprove) {
      setImmediate(() => inbox.resolve(e.item!.id, { approved: true, answer: '' }));
    }
  });
});
after(() => { llm.close(); });

async function finished(runId: string, ms = 8000) {
  const t0 = Date.now();
  for (;;) {
    const r = swarm.runs.get(runId)!;
    const busy = [...swarm.agents.values()].some((a) => a.current || a.queue.length);
    if (['done', 'failed', 'cancelled'].includes(r.status) && !busy && swarm.agents.get('overseer')!.status === 'idle') return r;
    if (Date.now() - t0 > ms) assert.fail(`run ${runId} kẹt ở trạng thái ${r.status} · tasks=${tasksOf(runId).map((t) => `${t.localId}:${t.agent}:${t.status}`).join(',')} · agents=${[...swarm.agents.values()].map((a) => `${a.def.id}:${a.status}:${a.queue.length}:${a.current?.localId ?? '-'}`).join(' ')} · script còn ${script.length}`);
    await new Promise((res) => setTimeout(res, 15));
  }
}
const tasksOf = (runId: string) => [...swarm.tasks.values()].filter((t) => t.runId === runId);

test('câu hỏi thuần → trả lời thẳng, không gọi đội', async () => {
  script = [{ content: JSON.stringify({ intent: 'answer', title: 'Hỏi', summary: 's', answer: 'Có 6 phân hệ.', tasks: [] }) }];
  const run = await swarm.submit('có mấy phân hệ?');
  const r = await finished(run.id);
  assert.equal(r.status, 'done');
  assert.equal(r.digest, 'Có 6 phân hệ.');
});

test('kế hoạch JSON hỏng + agent không tồn tại → Overseer tự sửa, không sập', async () => {
  script = [{ content: 'đây không phải JSON' }, plan([task('t1', 'hacker')]), plan([task('t1', 'config')]), done()];
  const r = await finished((await swarm.submit('x')).id);
  assert.equal(r.status, 'done');
  assert.equal(tasksOf(r.id).length, 1);
});

test('Overseer hỏng 3 lần liên tiếp → run FAILED có lý do (không treo)', async () => {
  script = [{ content: 'rác' }, { content: 'rác' }, { content: 'rác' }];
  const r = await finished((await swarm.submit('x')).id);
  assert.equal(r.status, 'failed');
  assert.match(r.summary, /không lập được kế hoạch/i);
});

test('agent trả rỗng / bị cắt / thiếu STATUS → được nhắc, không bị coi là xong', async () => {
  script = [plan([task('t1', 'config')]), { content: '' }, { content: 'báo cáo dài…', finish: 'length' }, done()];
  const r = await finished((await swarm.submit('x')).id);
  assert.equal(r.status, 'done');
  script = [plan([task('t1', 'config')]), { content: 'xong rồi nhé' }, { content: 'vẫn quên' }, { content: 'lần 3 vẫn quên' }];
  const r2 = await finished((await swarm.submit('y')).id);
  const t = tasksOf(r2.id)[0];
  assert.equal(t.status, 'failed', 'im lặng không có STATUS: DONE thì KHÔNG được tính là thành công');
});

test('gọi tool y hệt lần 3 → không chạy lại, agent bị buộc đổi hướng', async () => {
  const same = { tools: [{ name: 'list_dir', args: { path: 'docs' } }] };
  script = [plan([task('t1', 'config')]), same, same, same, done()];
  const r = await finished((await swarm.submit('x')).id);
  assert.equal(r.status, 'done');
});

test('tool lỗi (đường dẫn bí mật, ngoài phạm vi ghi) → trả lỗi cho agent, không sập', async () => {
  script = [plan([task('t1', 'config')]),
    { tools: [{ name: 'read_file', args: { path: 'config/credentials.local.json' } }, { name: 'write_file', args: { path: 'src/cli.js', content: 'x' } },
      { name: 'kyta_run', args: { args: ['login'] } }, { name: 'khong_co_tool', args: {} }, { name: 'read_file', args: { path: '../../etc/passwd' } }] },
    done()];
  const before = fs.readFileSync(path.resolve('..', 'src', 'cli.js'), 'utf8');
  const r = await finished((await swarm.submit('x')).id);
  assert.equal(r.status, 'done');
  assert.equal(fs.readFileSync(path.resolve('..', 'src', 'cli.js'), 'utf8'), before, 'config không được ghi vào src/');
});

test('500 thoáng qua → tự thử lại rồi chạy tiếp', async () => {
  script = [plan([task('t1', 'config')]), { status: 500, body: '{"error":"boom"}' }, done()];
  const r = await finished((await swarm.submit('x')).id);
  assert.equal(r.status, 'done');
});

test('bước FAILED → replan; replan trỏ vào bước hỏng bị từ chối rồi sửa lại', async () => {
  script = [
    plan([task('t1', 'config'), task('t2', 'qa', ['t1'])]),
    done('config ok'),
    failed('qa thấy lỗi'),
    plan([task('t3', 'config', ['t2'])]),          // sai: t2 đã FAILED
    plan([task('t3', 'config', ['t1']), task('t4', 'qa', ['t3'])]),
    done('đã sửa'), done('qa đạt'),
    { content: 'Tổng kết.' },
  ];
  const r = await finished((await swarm.submit('x')).id);
  assert.equal(r.replans, 1);
  assert.equal(r.status, 'done');
  assert.deepEqual(tasksOf(r.id).map((t) => `${t.localId}:${t.status}`).sort(), ['t1:done', 't2:failed', 't3:done', 't4:done']);
});

test('429 hết quota NGÀY → dừng ngay, KHÔNG replan', async () => {
  const perDay = '[{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}]';
  script = [plan([task('t1', 'config')]), { status: 429, body: perDay }];
  const r = await finished((await swarm.submit('x')).id);
  assert.equal(r.status, 'failed');
  assert.equal(r.replans, 0);
  assert.match(tasksOf(r.id)[0].result, /HẾT QUOTA NGÀY/);
  swarm.setModel('overseer', 'fake-model-2');                       // model khác không bị chặn
  for (const id of swarm.agents.keys()) swarm.setModel(id, 'fake-model-2');
});

test('huỷ run khi đang chờ duyệt kế hoạch → không "sống lại"', async () => {
  autoApprove = false;
  script = [plan([task('t1', 'config')])];
  const run = await swarm.submit('x');
  for (let i = 0; i < 200 && swarm.runs.get(run.id)!.status !== 'awaiting_plan'; i++) await new Promise((r) => setTimeout(r, 10));
  swarm.cancelRun(run.id);
  await new Promise((r) => setTimeout(r, 100));
  autoApprove = true;
  assert.equal(swarm.runs.get(run.id)!.status, 'cancelled');
  assert.equal(tasksOf(run.id).length, 0);
});

test('vượt trần ngân sách run → dừng, không replan', async () => {
  config.prices['fake-model-2'] = { input: 1_000_000, output: 0, context: 1_000_000 };   // 1$ / token
  config.swarm.maxCostPerRun = 0.5;
  script = [plan([task('t1', 'config')]), { tools: [{ name: 'list_dir', args: { path: 'docs' } }], tokens: 5 }, done()];
  const r = await finished((await swarm.submit('x')).id);
  config.swarm.maxCostPerRun = 0;
  script = [];
  assert.equal(r.status, 'failed');
  assert.equal(r.replans, 0);
  assert.match(tasksOf(r.id)[0].result, /trần/);
});
