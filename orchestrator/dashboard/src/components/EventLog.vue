<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { S } from '../store';
import { fmtTime } from '../md';

const box = ref<HTMLElement | null>(null);
watch(() => [S.events.length, S.ui.log], async () => {
  await nextTick();
  if (box.value) box.value.scrollTop = box.value.scrollHeight;
});
</script>

<template>
  <section class="panel mx-3 mb-3 shrink-0">
    <button class="w-full flex items-center justify-between px-3 py-2" @click="S.ui.log = !S.ui.log">
      <span class="label">›_ Event log <span class="text-dim normal-case tracking-normal font-normal ml-1">{{ S.eventCount }}</span></span>
      <span class="text-mute font-mono text-[12px]">{{ S.ui.log ? '▾' : '›' }}</span>
    </button>
    <div v-if="S.ui.log" ref="box" class="h-36 overflow-y-auto border-t border-line px-3 py-1.5 font-mono text-[11.5px] space-y-0.5">
      <div v-for="(e, i) in S.events" :key="i" class="flex gap-2">
        <span class="text-dim shrink-0">{{ fmtTime(e.ts) }}</span>
        <span class="shrink-0 w-16 truncate text-mute">{{ e.agent ?? 'swarm' }}</span>
        <span class="text-ink/90 truncate" :title="e.text">{{ e.text }}</span>
      </div>
    </div>
  </section>
</template>
