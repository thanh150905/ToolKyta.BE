<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { S, agentById, flashing, planAgents, type AgentView } from '../store';

// Node tự đọc trạng thái từ store theo id — mảng node của Vue Flow không phải dựng lại khi trạng thái đổi.
defineOptions({ inheritAttrs: false });
const props = defineProps<{ id: string }>();
const a = computed(() => agentById(props.id) as AgentView);
const data = computed(() => ({
  selected: S.selected === props.id, inPlan: planAgents.value.has(props.id), replan: flashing('replan'),
  justDone: flashing(`done:${props.id}`), justFailed: flashing(`fail:${props.id}`),
}));
const isOverseer = computed(() => a.value.id === 'overseer');
/** Trạng thái bằng lời — người mới nhìn cũng hiểu. */
const state = computed(() => {
  if (a.value.status === 'working') return { text: isOverseer.value ? 'Đang điều phối' : 'Đang làm', tone: 'text-work', ring: 'border-work' };
  if (a.value.status === 'blocked') return { text: 'Chờ bạn', tone: 'text-bad', ring: 'border-bad' };
  if (a.value.status === 'paused') return { text: 'Tạm dừng', tone: 'text-mute', ring: 'border-mute' };
  return { text: data.value.inPlan ? 'Sẵn sàng' : 'Rảnh', tone: data.value.inPlan ? 'text-ok' : 'text-dim', ring: '' };
});
const border = computed(() => {
  if (isOverseer.value) return 'border-accent/80 border-dashed bg-accent/[0.06]';
  if (a.value.status === 'working') return 'border-work bg-work/[0.08]';
  if (a.value.status === 'blocked') return 'border-bad bg-bad/[0.08]';
  return data.value.inPlan ? 'border-ok/60 bg-ok/[0.04]' : 'border-line2 bg-panel';
});
const load = computed(() => a.value.queue + (a.value.current ? 1 : 0));
</script>

<template>
  <div v-if="a" class="relative w-[176px]" :class="data.justFailed ? 'animate-shake' : ''">
    <!-- vòng lan toả khi đang làm / chờ người -->
    <span v-if="a.status === 'working' || a.status === 'blocked'"
          class="absolute inset-0 rounded-2xl border-2 animate-ring pointer-events-none" :class="state.ring"></span>
    <div class="relative rounded-2xl border-2 px-3 py-2.5 text-center transition-colors duration-500"
         :class="[border, data.selected ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-bg' : '', data.replan && isOverseer ? 'animate-pulse' : '']">
      <Handle type="target" :position="Position.Top" />
      <Handle type="source" :position="Position.Bottom" />
      <div class="text-[13.5px] font-semibold truncate" :class="isOverseer ? 'text-accent' : 'text-white'">{{ a.name }}</div>
      <div class="text-[11px] text-mute truncate">{{ a.title }}</div>
      <div class="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-medium" :class="state.tone">
        <svg v-if="a.status === 'working'" class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity=".25" stroke-width="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        <span v-else class="w-1.5 h-1.5 rounded-full bg-current"></span>
        {{ state.text }}<span v-if="load" class="text-dim font-mono">· {{ load }} việc</span>
      </div>
    </div>
    <!-- dấu kết quả bật lên khi vừa xong / vừa hỏng -->
    <span v-if="data.justDone" class="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-ok text-black text-[13px] font-bold flex items-center justify-center animate-pop shadow-lg shadow-ok/30">✓</span>
    <span v-if="data.justFailed" class="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-bad text-white text-[13px] font-bold flex items-center justify-center animate-pop shadow-lg shadow-bad/30">!</span>
  </div>
</template>
