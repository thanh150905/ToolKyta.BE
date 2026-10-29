<script setup lang="ts">
import { computed } from 'vue';
import { BaseEdge, getBezierPath, type EdgeProps } from '@vue-flow/core';
import { edgeHot, planAgents } from '../store';

// Cạnh có "gói việc" chạy dọc dây khi đang bàn giao — nhìn là biết việc đang đi từ ai sang ai.
const props = defineProps<EdgeProps<{ kind: 'sup' | 'hand' }>>();
const path = computed(() => getBezierPath(props)[0]);
// Tự tính trạng thái từ store (xem ghi chú ở SwarmGraph).
const d = computed(() => {
  const hot = edgeHot(props.source, props.target);
  const sup = props.data.kind === 'sup';
  return { hot, dashed: sup, faint: sup && !planAgents.value.has(props.target), color: sup ? '#3b82f6' : hot ? '#f5b53d' : '#566070' };
});
</script>

<template>
  <BaseEdge :id="id" :path="path" :marker-end="markerEnd"
            :style="{ stroke: d.color, strokeWidth: d.hot ? 2.2 : 1.3, strokeDasharray: d.dashed ? '6 6' : undefined, opacity: d.hot ? 1 : d.faint ? 0.18 : 0.55 }" />
  <template v-if="d.hot">
    <circle r="7" :fill="d.color" opacity="0.18">
      <animateMotion :path="path" dur="1.5s" repeatCount="indefinite" />
    </circle>
    <circle r="3.6" :fill="d.color">
      <animateMotion :path="path" dur="1.5s" repeatCount="indefinite" />
    </circle>
  </template>
</template>
