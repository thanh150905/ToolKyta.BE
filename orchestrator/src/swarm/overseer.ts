import { z } from 'zod';
import { config } from '../config.js';
import { chat, type Msg } from '../llm.js';
import { projectMap } from '../kyta/catalog.js';
import type { Plan, PlanTask, Run, Task } from './types.js';

const WORKERS = config.agents.filter((a) => a.id !== 'overseer');
const OVERSEER = config.agents.find((a) => a.id === 'overseer')!;
/** Model Overseer đang dùng — swarm gán lại khi người đổi ở nút Model. */
export const overseerModel = { current: OVERSEER.model };

const roster = () => WORKERS.map((a) =>
  `- ${a.id} — ${a.title}. Tool: ${a.tools.join(', ')}. ${a.write ? `Được ghi: ${a.write.join(', ')}.` : 'Không ghi file.'}` +
  `${a.kyta === 'write' ? ' Được chạy lệnh kyta GHI (qua dry-run/duyệt).' : a.kyta ? ' Chỉ lệnh kyta ĐỌC.' : ''}`).join('\n');

const TaskZ = z.object({
  id: z.string().min(1),
  agent: z.string(),
  title: z.string().min(1),
  instructions: z.string().min(1),
  dependsOn: z.array(z.string()).default([]),
});
const PlanZ = z.object({
  intent: z.string().default('config'),
  title: z.string().default('Yêu cầu'),
  summary: z.string().default(''),
  answer: z.string().optional(),
  tasks: z.array(TaskZ).default([]),
});

export function isModifyingTask(t: PlanTask): boolean {
  if (t.agent !== 'dev' && t.agent !== 'config') return false;
  const text = `${t.title} ${t.instructions}`.toLowerCase();
  const MODIFY_KEYWORDS = [
    'sửa', 'sua', 'viết', 'viet', 'tạo', 'tao', 'xoá', 'xoa', 'xóa',
    'cập nhật', 'cap nhat', 'thêm', 'them', 'push', 'set', 'add', 'rm',
    'delete', 'edit', 'write', 'thay đổi', 'thay doi', 'patch', 'modify',
    'refactor', 'refresh', 'group', 'move', 'toggle', 'clone', 'apply',
  ];
  return MODIFY_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * knownIds: id đã tồn tại (không được trùng). depOk: id cũ ĐƯỢC phép làm phụ thuộc (chỉ bước DONE).
 * Phụ thuộc chỉ được trỏ lên trên (id khai trước) → không thể tạo vòng.
 */
export function validate(tasks: PlanTask[], knownIds: Set<string>, depOk: Set<string>): string | null {
  const ids = new Set(knownIds);
  const deps = new Set(depOk);
  if (tasks.length > 8) return 'tối đa 8 bước mỗi lần.';
  for (const t of tasks) {
    if (!WORKERS.some((a) => a.id === t.agent)) return `agent "${t.agent}" không tồn tại (chỉ có: ${WORKERS.map((a) => a.id).join(', ')}).`;
    if (ids.has(t.id)) return `id "${t.id}" bị trùng.`;
    for (const d of t.dependsOn) {
      if (!deps.has(d)) return ids.has(d) ? `task ${t.id} phụ thuộc "${d}" — bước đó chưa DONE, không được làm phụ thuộc.` : `task ${t.id} phụ thuộc "${d}" chưa được khai báo trước nó.`;
    }
    ids.add(t.id);
    deps.add(t.id);
  }

  // Bắt buộc có kiểm chứng độc lập: Tác vụ sửa code hoặc cấu hình phải có QA phụ thuộc vào tác vụ đã sửa
  for (const t of tasks) {
    if (isModifyingTask(t)) {
      const hasQa = tasks.some((q) => q.agent === 'qa' && q.dependsOn.includes(t.id));
      if (!hasQa) {
        return `tác vụ "${t.id}" (${t.agent}: ${t.title}) sửa code/cấu hình nhưng thiếu bước QA kiểm tra độc lập phụ thuộc vào nó (yêu cầu một task qa có dependsOn: ["${t.id}"]).`;
      }
    }
  }

  return null;
}


async function askJson(messages: Msg[], knownIds: Set<string>, depOk: Set<string>, runId: string): Promise<Plan> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const out = await chat({ agent: 'overseer', model: overseerModel.current, messages, json: true, runId });
    const raw = out.message.content ?? '';
    let err: string | null;
    try {
      const plan = PlanZ.parse(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')));
      err = validate(plan.tasks, knownIds, depOk);
      if (!err) return plan;
    } catch (e) {
      err = `JSON không hợp lệ: ${(e as Error).message.slice(0, 300)}`;
    }
    messages.push({ role: 'assistant', content: raw }, { role: 'user', content: `Kế hoạch chưa hợp lệ: ${err}. Trả lại JSON đã sửa.` });
  }
  throw new Error('Overseer không lập được kế hoạch hợp lệ sau 3 lần.');
}

const system = () => [config.prompt(OVERSEER.prompt), '## Đội của bạn', roster(), projectMap()].join('\n\n');

export async function makePlan(prompt: string, feedback: string | undefined, previous: Plan | undefined, history: string, runId: string): Promise<Plan> {
  const hist = history ? `Việc đội đã làm gần đây (tham khảo để nối tiếp, không làm lại cái đã xong):\n${history}\n\n` : '';
  const msgs: Msg[] = [{ role: 'system', content: system() }, { role: 'user', content: `${hist}Yêu cầu của người dùng:\n${prompt}` }];
  if (previous && feedback) {
    msgs.push({ role: 'assistant', content: JSON.stringify(previous) },
      { role: 'user', content: `Người dùng KHÔNG duyệt kế hoạch trên, góp ý: "${feedback}". Lập lại kế hoạch đầy đủ theo góp ý.` });
  }
  return askJson(msgs, new Set(), new Set(), runId);
}

const brief = (t: Task) => `- ${t.localId} [${t.agent}] ${t.title} → ${t.status.toUpperCase()}` +
  (t.result ? `\n  kết quả: ${t.result.slice(-1200).replace(/\n/g, '\n  ')}` : '');

/** Có bước thất bại → Overseer quyết định bước tiếp (sửa code → Dev, sai nghiệp vụ → BA…). */
export async function replan(run: Run, tasks: Task[]): Promise<Plan> {
  const msgs: Msg[] = [
    { role: 'system', content: system() },
    { role: 'user', content: `Yêu cầu gốc:\n${run.prompt}\n\nKế hoạch "${run.title}" đang chạy, trạng thái các bước:\n${tasks.map(brief).join('\n')}\n\n` +
      'Có bước THẤT BẠI. Hãy phân tích nguyên nhân rồi trả JSON cùng schema, trong đó "tasks" CHỈ gồm các bước MỚI cần thêm ' +
      'GIỮ NGUYÊN mọi ràng buộc của yêu cầu gốc (vd "không push thật", phạm vi form/env). ' +
      '(id mới, không trùng id cũ; dependsOn được trỏ tới id cũ đã DONE). Lỗi code → giao dev/config sửa rồi qa kiểm lại; ' +
      'hiểu sai yêu cầu → giao ba làm rõ trước. Nếu không thể khắc phục tự động, trả "tasks": [] và giải thích trong "summary".' },
  ];
  return askJson(msgs, new Set(tasks.map((t) => t.localId)), new Set(tasks.filter((t) => t.status === 'done').map((t) => t.localId)), run.id);
}

export async function digest(run: Run, tasks: Task[]): Promise<string> {
  const out = await chat({
    agent: 'overseer', model: overseerModel.current, runId: run.id,
    messages: [
      { role: 'system', content: 'Bạn là Overseer. Viết báo cáo tổng kết ngắn (markdown, tiếng Việt) cho người dùng: kết quả chính, file/cấu hình đã đổi, việc còn tồn đọng hoặc cần người làm tiếp. Tối đa 12 dòng.' },
      { role: 'user', content: `Yêu cầu: ${run.prompt}\nTrạng thái run: ${run.status}\nCác bước:\n${tasks.map(brief).join('\n')}` },
    ],
  });
  return out.message.content ?? '';
}
