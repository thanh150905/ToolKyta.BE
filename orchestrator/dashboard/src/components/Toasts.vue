<script setup lang="ts">
import { S, type Toast } from '../store';

const TONE: Record<Toast['tone'], string> = { info: 'bg-accent', ok: 'bg-ok', warn: 'bg-work', bad: 'bg-bad' };
function act(t: Toast) {
  if (t.action === 'inbox') S.ui.inbox = true;
  if (t.action === 'digest') { S.selected = 'overseer'; S.ui.tab = 'digests'; }
  S.toasts = S.toasts.filter((x) => x.id !== t.id);
}
</script>

<template>
  <div class="fixed top-14 right-4 z-50 flex flex-col gap-2 w-[340px] pointer-events-none">
    <TransitionGroup name="list">
      <div v-for="t in S.toasts" :key="t.id"
           class="pointer-events-auto flex items-start gap-3 rounded-2xl bg-[#1c1f25]/95 backdrop-blur-xl border border-line2 shadow-2xl shadow-black/60 px-4 py-3">
        <span class="mt-1.5 w-2 h-2 rounded-full shrink-0" :class="TONE[t.tone]"></span>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-semibold text-white">{{ t.title }}</div>
          <div class="text-[12px] text-mute truncate">{{ t.text }}</div>
        </div>
        <button v-if="t.action" @click="act(t)" class="text-[12.5px] font-medium text-ios hover:brightness-125 shrink-0 self-center">
          {{ t.action === 'inbox' ? 'Mở' : 'Xem' }}
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
