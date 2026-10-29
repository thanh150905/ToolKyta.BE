<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { S, api, agentById, type MessageRow } from '../store';
import { fmtTime, md } from '../md';

const agent = computed(() => agentById(S.selected));
const msgs = computed(() => S.messages[S.selected] ?? []);
const live = computed(() => S.live[S.selected] ?? []);
const digests = computed(() => S.runs.filter((r) => r.digest));
const draft = ref('');
const sending = ref(false);
const err = ref('');
const box = ref<HTMLElement | null>(null);
const input = ref<HTMLTextAreaElement | null>(null);
const open = reactive<Record<string, boolean>>({});

const TABS = [{ id: 'history', label: 'Trò chuyện' }, { id: 'live', label: 'Đang làm' }, { id: 'digests', label: 'Tổng kết' }] as const;
const tabIdx = computed(() => TABS.findIndex((t) => t.id === S.ui.tab));

// ── Tên công cụ dễ hiểu ──
const TOOL: Record<string, string> = {
  list_dir: 'Xem thư mục', read_file: 'Đọc file', search: 'Tìm trong code', write_file: 'Ghi file', edit_file: 'Sửa file',
  kyta_run: 'Chạy kyta', find_local: 'Tìm trên máy', check_js: 'Kiểm cú pháp', git_diff: 'Xem thay đổi', run_tests: 'Chạy test',
  platform_get: 'Đọc API', browser_open: 'Mở trang', browser_network: 'Đọc network', ask_human: 'Hỏi bạn',
};
function toolLabel(raw: string): { name: string; label: string; detail: string } {
  const name = raw.slice(0, raw.indexOf('(')) || raw;
  const body = raw.slice(raw.indexOf('(') + 1, raw.lastIndexOf(')'));
  let detail = body;
  try {
    const a = JSON.parse(body);
    detail = Array.isArray(a.args) ? a.args.join(' ') : a.path ?? a.name ?? a.pattern ?? a.url ?? a.file ?? a.question ?? '';
  } catch { /* args bị cắt ngắn — hiện thô */ }
  return { name, label: TOOL[name] ?? name, detail: String(detail) };
}

// ── Gom tin nhắn thành khối hiển thị: gom các lần dùng công cụ liên tiếp, chèn mốc giờ ──
type Item =
  | { kind: 'time'; key: string; ts: number }
  | { kind: 'tools'; key: string; list: MessageRow[] }
  | { kind: 'msg'; key: string; m: MessageRow };
const items = computed<Item[]>(() => {
  const out: Item[] = [];
  let lastTs = 0;
  for (const m of msgs.value) {
    if (m.ts - lastTs > 5 * 60_000) out.push({ kind: 'time', key: `t${m.id}`, ts: m.ts });
    lastTs = m.ts;
    const prev = out[out.length - 1];
    if (m.role === 'tool') {
      if (prev?.kind === 'tools') prev.list.push(m);
      else out.push({ kind: 'tools', key: `g${m.id}`, list: [m] });
    } else out.push({ kind: 'msg', key: `m${m.id}`, m });
  }
  return out;
});
const typing = computed(() => agent.value?.status === 'working' && S.ui.tab === 'history');
const statusLine = computed(() => {
  const a = agent.value;
  if (!a) return '';
  if (a.status === 'working') return a.activity;
  if (a.status === 'blocked') return 'Đang chờ bạn trả lời ở Inbox';
  if (a.status === 'paused') return 'Đã tạm dừng';
  return 'Rảnh';
});
const initials = (n?: string) => (n ?? '?').slice(0, 2).toUpperCase();

const SUGGEST = [
  'Hệ thống kyta đang hỗ trợ những phân hệ nào?',
  'Liệt kê các form eForm của saigoncoop sandbox có chữ "thầu"',
  'Thêm lệnh import excel cho eCatalog',
];

async function send() {
  const text = draft.value.trim();
  if (!text || sending.value) return;
  sending.value = true; err.value = '';
  try {
    if (S.selected === 'overseer') await api.prompt(text); else await api.message(S.selected, text);
    draft.value = '';
    S.ui.tab = 'history';
    await nextTick(); grow();
  } catch (e) { err.value = (e as Error).message; }
  finally { sending.value = false; }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void send(); }
}
function grow() {
  const el = input.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}
function pick(s: string) { draft.value = s; void nextTick(() => { grow(); input.value?.focus(); }); }

watch(() => [msgs.value.length, live.value.length, S.ui.tab, S.selected, typing.value], async () => {
  await nextTick();
  box.value?.scrollTo({ top: box.value.scrollHeight, behavior: 'smooth' });
});
</script>

<template>
  <section class="panel flex flex-col min-h-0 h-full overflow-hidden">
    <!-- Đầu: ai đang nói chuyện -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-line">
      <div class="relative w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0"
           :class="S.selected === 'overseer' ? 'bg-accent text-white' : 'bg-bubble text-ink'">
        {{ initials(agent?.name) }}
        <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-panel"
              :class="{ working: 'bg-work', blocked: 'bg-bad', paused: 'bg-mute', idle: 'bg-ok' }[agent?.status ?? 'idle']"></span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[14px] font-semibold text-white truncate">{{ agent?.name }} <span class="font-normal text-mute">· {{ agent?.title }}</span></div>
        <div class="text-[12px] truncate" :class="agent?.status === 'working' ? 'text-work' : agent?.status === 'blocked' ? 'text-bad' : 'text-mute'">{{ statusLine }}</div>
      </div>
    </div>

    <!-- Segmented control -->
    <div class="px-4 pt-3">
      <div class="relative grid grid-cols-3 p-0.5 rounded-lg bg-panel2 border border-line">
        <span class="absolute top-0.5 bottom-0.5 rounded-md bg-[#2a2e36] shadow transition-all duration-300 ease-out"
              :style="{ width: 'calc((100% - 4px) / 3)', left: `calc(2px + ${tabIdx} * (100% - 4px) / 3)` }"></span>
        <button v-for="t in TABS" :key="t.id" @click="S.ui.tab = t.id"
                class="relative z-10 py-1.5 text-[12.5px] font-medium transition-colors flex items-center justify-center gap-1.5"
                :class="S.ui.tab === t.id ? 'text-white' : 'text-mute hover:text-ink'">
          <span v-if="t.id === 'live' && agent?.status === 'working'" class="w-1.5 h-1.5 rounded-full bg-work animate-pulse"></span>
          {{ t.label }}
        </button>
      </div>
    </div>

    <div ref="box" class="flex-1 min-h-0 overflow-y-auto px-4 py-3">
      <!-- ── TRÒ CHUYỆN ── -->
      <template v-if="S.ui.tab === 'history'">
        <div v-if="!msgs.length" class="h-full flex flex-col items-center justify-center text-center gap-3 animate-rise">
          <div class="w-12 h-12 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[20px]">◎</div>
          <div class="text-[14px] text-white font-medium">{{ S.selected === 'overseer' ? 'Bạn muốn đội làm gì?' : `Chưa có trao đổi với ${agent?.name}` }}</div>
          <p class="text-[12.5px] text-mute max-w-xs">{{ S.selected === 'overseer' ? 'Mô tả bằng lời thường. Overseer tự lập kế hoạch và gọi đúng người.' : 'Tin nhắn gửi ở đây thành một việc riêng cho agent này.' }}</p>
          <div v-if="S.selected === 'overseer'" class="flex flex-col gap-1.5 w-full max-w-xs mt-1">
            <button v-for="s in SUGGEST" :key="s" @click="pick(s)"
                    class="text-left text-[12.5px] px-3 py-2 rounded-xl bg-panel2 border border-line hover:border-accent/50 hover:text-white text-ink transition-colors">{{ s }}</button>
          </div>
        </div>

        <TransitionGroup :key="S.selected" name="list" tag="div" class="space-y-2">
          <div v-for="it in items" :key="it.key">
            <div v-if="it.kind === 'time'" class="text-center text-[11px] text-dim py-1">{{ fmtTime(it.ts) }}</div>

            <!-- Công cụ: gom thành 1 dòng, bấm để xem -->
            <div v-else-if="it.kind === 'tools'" class="flex justify-center">
              <div class="max-w-[92%] w-full">
                <button @click="open[it.key] = !open[it.key]"
                        class="mx-auto flex items-center gap-1.5 text-[11.5px] text-mute hover:text-ink px-3 py-1 rounded-full bg-panel2 border border-line transition-colors">
                  <span>⚙︎</span>
                  <span v-if="it.list.length === 1">{{ toolLabel(it.list[0].content).label }} <span class="text-dim">{{ toolLabel(it.list[0].content).detail.slice(0, 40) }}</span></span>
                  <span v-else>Đã dùng {{ it.list.length }} công cụ</span>
                  <span class="text-dim">{{ open[it.key] ? '▴' : '▾' }}</span>
                </button>
                <div v-if="open[it.key]" class="mt-2 space-y-1.5 animate-rise">
                  <details v-for="t in it.list" :key="t.id" class="rounded-lg bg-bg border border-line">
                    <summary class="cursor-pointer px-3 py-1.5 text-[12px] flex gap-2 min-w-0">
                      <span class="text-work shrink-0">{{ toolLabel(t.content).label }}</span>
                      <span class="text-mute truncate font-mono text-[11px]">{{ toolLabel(t.content).detail }}</span>
                    </summary>
                    <pre class="px-3 pb-2 font-mono text-[11px] text-mute whitespace-pre-wrap max-h-60 overflow-auto">{{ t.meta?.result }}</pre>
                  </details>
                </div>
              </div>
            </div>

            <template v-else>
              <!-- Người dùng: bên phải, xanh -->
              <div v-if="it.m.role === 'user'" class="flex justify-end">
                <div class="max-w-[82%] rounded-[18px] rounded-br-md bg-ios text-white px-3.5 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap">{{ it.m.content }}</div>
              </div>

              <!-- Việc được giao -->
              <div v-else-if="it.m.role === 'task'" class="rounded-xl border border-line bg-panel2/60 px-3.5 py-2.5">
                <div class="text-[11px] text-mute mb-0.5">Việc được giao · {{ it.m.runId }}</div>
                <button class="text-left w-full" @click="open[it.key] = !open[it.key]">
                  <div class="text-[13px] text-white font-medium">{{ it.m.content.split('\n')[0] }}</div>
                  <div class="text-[12.5px] text-mute mt-1 whitespace-pre-wrap" :class="open[it.key] ? '' : 'line-clamp-2'">{{ it.m.content.split('\n').slice(2).join('\n') }}</div>
                </button>
              </div>

              <!-- Tổng kết -->
              <div v-else-if="it.m.role === 'digest'" class="rounded-xl border border-work/30 bg-work/[0.05] px-3.5 py-2.5">
                <div class="text-[11px] text-work font-medium mb-1">Tổng kết</div>
                <div class="md" v-html="md(it.m.content)"></div>
              </div>

              <!-- Lỗi hệ thống -->
              <div v-else-if="it.m.role === 'system'" class="flex justify-center">
                <div class="max-w-[92%] text-[12px] text-bad bg-bad/10 border border-bad/30 rounded-xl px-3 py-1.5">{{ it.m.content }}</div>
              </div>

              <!-- Agent: bên trái, xám -->
              <div v-else class="flex justify-start">
                <div class="max-w-[88%]">
                  <div class="rounded-[18px] rounded-bl-md bg-bubble px-3.5 py-2 md" v-html="md(it.m.content.replace(/\n?STATUS:.*$/s, ''))"></div>
                  <div v-if="it.m.meta?.final" class="mt-1 ml-2 text-[11px] font-medium" :class="it.m.meta.ok ? 'text-ok' : 'text-bad'">
                    {{ it.m.meta.ok ? '✓ Hoàn thành' : '✕ Chưa hoàn thành' }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </TransitionGroup>

        <!-- đang gõ -->
        <div v-if="typing" class="flex justify-start mt-2">
          <div class="rounded-[18px] rounded-bl-md bg-bubble px-4 py-3 flex gap-1">
            <span v-for="i in 3" :key="i" class="w-1.5 h-1.5 rounded-full bg-mute animate-dot" :style="{ animationDelay: `${(i - 1) * 0.15}s` }"></span>
          </div>
        </div>
      </template>

      <!-- ── ĐANG LÀM: dòng thời gian ── -->
      <template v-else-if="S.ui.tab === 'live'">
        <div v-if="!live.length" class="h-full flex items-center justify-center text-[13px] text-dim">Chưa có hoạt động trong phiên này.</div>
        <ol class="relative ml-2 border-l border-line space-y-3">
          <li v-for="(l, i) in live" :key="i" class="relative pl-5 animate-rise">
            <span class="absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full border-2 border-panel flex items-center justify-center"
                  :class="{ start: 'bg-accent', think: 'bg-line2', call: 'bg-work', result: 'bg-line2', end: l.text === 'DONE' ? 'bg-ok' : 'bg-bad' }[l.kind]">
              <span v-if="l.kind === 'call' && i === live.length - 1 && agent?.status === 'working'" class="absolute inset-0 rounded-full bg-work animate-ping"></span>
            </span>
            <div class="flex items-baseline gap-2">
              <span class="text-[12.5px]" :class="l.kind === 'end' ? (l.text === 'DONE' ? 'text-ok font-medium' : 'text-bad font-medium') : l.kind === 'start' ? 'text-white font-medium' : 'text-ink'">
                {{ l.kind === 'start' ? `Bắt đầu: ${l.text}` : l.kind === 'end' ? (l.text === 'DONE' ? 'Hoàn thành' : 'Chưa hoàn thành') : l.kind === 'think' ? 'Suy nghĩ' : l.kind === 'call' ? (TOOL[l.name ?? ''] ?? l.name) : 'Kết quả' }}
              </span>
              <span class="ml-auto text-[11px] text-dim shrink-0">{{ fmtTime(l.ts) }}</span>
            </div>
            <p v-if="l.kind === 'think'" class="text-[12px] text-mute mt-0.5 line-clamp-3">{{ l.text }}</p>
            <p v-else-if="l.kind === 'call'" class="font-mono text-[11px] text-mute mt-0.5 break-all line-clamp-2">{{ l.text }}</p>
            <details v-else-if="l.kind === 'result'" class="mt-0.5">
              <summary class="cursor-pointer text-[11.5px] text-dim hover:text-mute">xem kết quả</summary>
              <pre class="mt-1 font-mono text-[11px] text-mute whitespace-pre-wrap max-h-56 overflow-auto bg-bg border border-line rounded-lg p-2">{{ l.text }}</pre>
            </details>
          </li>
        </ol>
      </template>

      <!-- ── TỔNG KẾT ── -->
      <template v-else>
        <div v-if="!digests.length" class="h-full flex items-center justify-center text-[13px] text-dim">Chưa có tổng kết nào.</div>
        <div class="space-y-3">
          <div v-for="r in digests" :key="r.id" class="rounded-xl border border-line bg-panel2/50 p-3.5 animate-rise">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" :class="r.status === 'done' ? 'bg-ok' : r.status === 'failed' ? 'bg-bad' : 'bg-mute'"></span>
              <span class="text-[13.5px] font-medium text-white truncate">{{ r.title }}</span>
              <span class="ml-auto text-[11px] text-dim shrink-0">{{ fmtTime(r.createdAt) }}</span>
            </div>
            <div class="text-[11.5px] text-mute mt-0.5 ml-4">{{ r.status === 'done' ? 'Hoàn thành' : r.status === 'failed' ? 'Không hoàn thành' : r.status }}{{ r.replans ? ` · lập lại kế hoạch ${r.replans} lần` : '' }}</div>
            <div class="md mt-2" v-html="md(r.digest)"></div>
          </div>
        </div>
      </template>
    </div>

    <!-- Ô nhập kiểu iMessage -->
    <div class="px-3 pb-3 pt-2 border-t border-line">
      <div v-if="err" class="text-bad text-[12px] mb-1.5 px-1">{{ err }}</div>
      <div class="flex items-end gap-2 rounded-[22px] bg-panel2 border border-line2 focus-within:border-accent/60 transition-colors pl-4 pr-1.5 py-1.5">
        <textarea ref="input" v-model="draft" @keydown="onKey" @input="grow" rows="1"
                  :placeholder="S.selected === 'overseer' ? 'Nhắn cho Overseer…' : `Nhắn cho ${agent?.name}…`"
                  class="flex-1 resize-none bg-transparent text-[13.5px] leading-6 py-1 placeholder:text-dim focus:outline-none max-h-36"></textarea>
        <button :disabled="sending || !draft.trim()" @click="send" title="Gửi (Enter)"
                class="w-8 h-8 shrink-0 rounded-full bg-ios text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:scale-90 hover:brightness-110 active:scale-95">
          <svg v-if="!sending" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          <svg v-else class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity=".3" stroke-width="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" /></svg>
        </button>
      </div>
      <div class="text-[10.5px] text-dim mt-1 px-2">Enter để gửi · Shift+Enter xuống dòng</div>
    </div>
  </section>
</template>
