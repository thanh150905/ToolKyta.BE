<script setup lang="ts">
import { S, api, select, type AgentView } from '../store';

const STATUS: Record<string, [string, string]> = {
  working: ['ĐANG LÀM', 'text-work'], blocked: ['CHỜ BẠN', 'text-bad'], paused: ['TẠM DỪNG', 'text-mute'], idle: ['RẢNH', 'text-dim'],
};
const dot = (a: AgentView) => ({ working: 'bg-work animate-pulse', blocked: 'bg-bad animate-pulse', paused: 'bg-mute', idle: 'bg-ok' })[a.status];
const pct = (a: AgentView) => `${(a.ctxPct * 100).toFixed(a.ctxPct < 0.1 ? 1 : 0)}%`;
</script>

<template>
  <section class="panel flex flex-col min-h-0">
    <div class="flex items-center justify-between px-3 py-2 border-b border-line">
      <span class="label">Agents</span>
      <button class="btn px-2! py-1!" @click="S.ui.compact = !S.ui.compact">{{ S.ui.compact ? 'Full' : 'Compact' }}</button>
    </div>
    <div class="overflow-y-auto p-2 space-y-2">
      <div v-for="a in S.agents" :key="a.id" @click="select(a.id)"
           class="rounded-md border p-2.5 cursor-pointer transition-all"
           :class="[S.selected === a.id ? 'border-ink/60 bg-panel2' : 'border-line hover:border-line2',
                    a.status === 'working' ? 'animate-glow' : '']">
        <div class="flex items-center gap-2">
          <span class="text-[13px] font-semibold text-white truncate">{{ a.name }}</span>
          <span class="text-[11px] text-mute truncate">({{ a.title }})</span>
          <span class="ml-auto font-mono text-[10px] font-bold" :class="STATUS[a.status][1]">{{ STATUS[a.status][0] }}</span>
          <span class="font-mono text-[11px] min-w-5 text-center px-1 rounded border border-line2">{{ a.queue + (a.current ? 1 : 0) }}</span>
        </div>
        <template v-if="!S.ui.compact">
          <div class="flex flex-wrap gap-1 mt-2">
            <span class="chip">{{ a.model }}</span>
            <span class="chip" :class="a.ctxPct > 0.5 ? 'text-work border-work/40' : ''">ctx {{ pct(a) }}</span>
            <span class="chip">🔗 {{ a.tools.length }}</span>
          </div>
          <div class="flex items-center gap-1.5 mt-2 text-[12px] text-mute min-w-0">
            <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="dot(a)"></span>
            <span class="truncate" :title="a.activity">{{ a.current ? a.current.title : a.activity }}</span>
          </div>
          <div class="h-0.5 mt-2 bg-line rounded overflow-hidden">
            <div class="h-full bg-ok transition-all duration-500" :style="{ width: `${Math.max(a.ctxPct * 100, a.status === 'working' ? 3 : 0)}%` }"></div>
          </div>
        </template>
        <div v-if="S.selected === a.id && a.id !== 'overseer'" class="flex gap-1.5 mt-2.5">
          <button class="btn bg-bad/90! border-bad! text-white!" :disabled="!a.current && !a.queue" @click.stop="api.agent(a.id, 'stop')">■ Stop</button>
          <button class="btn" @click.stop="api.agent(a.id, a.status === 'paused' ? 'resume' : 'pause')">{{ a.status === 'paused' ? '▶ Resume' : '⏸ Pause' }}</button>
          <button class="btn" @click.stop="S.ui.models = true">⚙</button>
        </div>
      </div>
    </div>
  </section>
</template>
