<script setup lang="ts">
import { computed } from 'vue';
import { S } from '../store';

const rows = computed(() => S.agents.filter((a) => a.id !== 'overseer').map((a) => ({ ...a, load: a.queue + (a.current ? 1 : 0) })));
const max = computed(() => Math.max(1, ...rows.value.map((r) => r.load)));
</script>

<template>
  <section class="panel">
    <div class="flex items-center justify-between px-3 py-2 border-b border-line">
      <span class="label">Task queues</span>
      <span class="font-mono text-[11px] text-mute">{{ rows.filter((r) => r.current).length }} working</span>
    </div>
    <div class="px-3 py-2 space-y-1.5 font-mono text-[12px]">
      <div v-for="r in rows" :key="r.id" class="grid grid-cols-[64px_1fr_18px_58px] items-center gap-2">
        <span class="text-mute truncate">{{ r.id }}</span>
        <div class="h-1.5 bg-line rounded overflow-hidden">
          <div class="h-full rounded transition-all duration-500" :class="r.current ? 'bg-ink' : 'bg-line2'" :style="{ width: `${(r.load / max) * 100}%` }"></div>
        </div>
        <span class="text-right" :class="r.load ? 'text-ink' : 'text-dim'">{{ r.load }}</span>
        <span class="text-[11px]" :class="r.status === 'blocked' ? 'text-bad' : r.current ? 'text-work' : 'text-dim'">{{ r.status === 'blocked' ? 'blocked' : r.current ? 'working' : '' }}</span>
      </div>
    </div>
  </section>
</template>
