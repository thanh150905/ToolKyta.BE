<script setup lang="ts">
import { reactive } from 'vue';
import { S, api, type InboxItem } from '../store';
import { fmtTime } from '../md';

const text = reactive<Record<string, string>>({});
const expanded = reactive<Record<string, boolean>>({});
const busy = reactive<Record<string, boolean>>({});

async function decide(it: InboxItem, approved: boolean) {
  busy[it.id] = true;
  try { await api.inbox(it.id, approved, text[it.id] ?? ''); }
  finally { busy[it.id] = false; }
}
const KIND: Record<string, [string, string]> = {
  plan: ['KẾ HOẠCH', 'text-accent border-accent/40'], approval: ['CẦN DUYỆT', 'text-work border-work/40'], question: ['CÂU HỎI', 'text-purple-300 border-purple-400/40'],
};
</script>

<template>
  <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition-opacity" leave-active-class="transition-opacity">
    <div v-if="S.ui.inbox" class="fixed inset-0 z-40 bg-black/50" @click.self="S.ui.inbox = false">
      <aside class="absolute right-0 top-0 h-full w-[560px] max-w-full bg-panel border-l border-line flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-line">
          <span class="label">Inbox · {{ S.inbox.length }} đang chờ</span>
          <button class="btn" @click="S.ui.inbox = false">✕</button>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-3">
          <div v-if="!S.inbox.length" class="text-dim text-[13px] text-center py-10">Không có gì cần bạn xử lý.</div>
          <div v-for="it in S.inbox" :key="it.id" class="rounded-lg border border-line2 bg-panel2 p-3">
            <div class="flex items-center gap-2">
              <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border" :class="KIND[it.kind][1]">{{ KIND[it.kind][0] }}</span>
              <span class="font-mono text-[11px] text-mute">{{ it.agent }}</span>
              <span class="ml-auto font-mono text-[11px] text-dim">{{ fmtTime(it.ts) }}</span>
            </div>
            <div class="mt-2 text-[13px] text-white font-medium break-words" :class="it.kind === 'approval' ? 'font-mono text-[12px]' : ''">{{ it.title }}</div>

            <!-- Kế hoạch -->
            <template v-if="it.kind === 'plan'">
              <p class="text-[12.5px] text-mute mt-1">{{ it.body.summary }}</p>
              <ol class="mt-2 space-y-1.5">
                <li v-for="t in it.body.tasks" :key="t.id" class="rounded border border-line bg-bg/60 px-2.5 py-2">
                  <button class="w-full text-left flex items-center gap-2" @click="expanded[it.id + t.id] = !expanded[it.id + t.id]">
                    <span class="font-mono text-[11px] text-dim">{{ t.id }}</span>
                    <span class="chip text-ink!">{{ t.agent }}</span>
                    <span class="text-[12.5px] text-ink flex-1">{{ t.title }}</span>
                    <span v-if="t.dependsOn.length" class="font-mono text-[10px] text-dim">sau {{ t.dependsOn.join(',') }}</span>
                  </button>
                  <p v-if="expanded[it.id + t.id]" class="mt-1.5 text-[12px] text-mute whitespace-pre-wrap">{{ t.instructions }}</p>
                </li>
              </ol>
              <textarea v-model="text[it.id]" rows="2" placeholder="Góp ý nếu muốn Overseer lập lại kế hoạch…"
                        class="mt-2 w-full bg-bg border border-line2 rounded px-2 py-1.5 text-[12.5px] placeholder:text-dim focus:outline-none focus:border-accent/60"></textarea>
              <div class="flex gap-2 mt-2">
                <button class="btn bg-ok! text-black! border-ok!" :disabled="busy[it.id]" @click="text[it.id] = ''; decide(it, true)">✓ Duyệt & chạy</button>
                <button class="btn" :disabled="busy[it.id] || !text[it.id]" @click="decide(it, false)">↻ Lập lại theo góp ý</button>
                <button class="btn text-bad!" :disabled="busy[it.id]" @click="text[it.id] = ''; decide(it, false)">Huỷ</button>
              </div>
            </template>

            <!-- Duyệt lệnh -->
            <template v-else-if="it.kind === 'approval'">
              <p class="text-[12.5px] mt-1" :class="/PROD/.test(it.title) ? 'text-bad' : 'text-mute'">{{ it.body?.detail }}</p>
              <div class="flex gap-2 mt-2">
                <button class="btn bg-ok! text-black! border-ok!" :disabled="busy[it.id]" @click="decide(it, true)">✓ Duyệt</button>
                <button class="btn text-bad!" :disabled="busy[it.id]" @click="decide(it, false)">✕ Từ chối</button>
              </div>
            </template>

            <!-- Câu hỏi -->
            <template v-else>
              <p class="text-[12.5px] text-mute mt-1 whitespace-pre-wrap">{{ it.body?.question }}</p>
              <textarea v-model="text[it.id]" rows="3" placeholder="Trả lời…"
                        class="mt-2 w-full bg-bg border border-line2 rounded px-2 py-1.5 text-[12.5px] placeholder:text-dim focus:outline-none focus:border-accent/60"></textarea>
              <div class="flex gap-2 mt-2">
                <button class="btn bg-accent! text-white! border-accent!" :disabled="busy[it.id] || !text[it.id]" @click="decide(it, true)">Gửi trả lời</button>
                <button class="btn" :disabled="busy[it.id]" @click="decide(it, false)">Bỏ qua</button>
              </div>
            </template>
          </div>
        </div>
      </aside>
    </div>
  </Transition>
</template>
