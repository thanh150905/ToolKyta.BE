<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { VueFlow, MarkerType, type Edge, type Node, type VueFlowStore } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import * as dagre from '@dagrejs/dagre';
import { S, api, planEdges, runTasks, select, viewRun } from '../store';
import SwarmNode from './SwarmNode.vue';
import FlowEdge from './FlowEdge.vue';

const W = 176, H = 76;
// Lấy đúng instance của <VueFlow> qua @pane-ready (useVueFlow() gọi trong chính component này trỏ nhầm store).
let flow: VueFlowStore | null = null;
const onReady = (f: VueFlowStore) => { flow = f; refitSoon(); };
const wrap = ref<HTMLElement | null>(null);
const refit = () => { void flow?.fitView({ padding: 0.12, maxZoom: 1.05, duration: 300 }); };
let ro: ResizeObserver | null = null;
let refitTimer: ReturnType<typeof setTimeout> | undefined;
const refitSoon = () => { clearTimeout(refitTimer); refitTimer = setTimeout(refit, 140); };
onMounted(() => { ro = new ResizeObserver(refitSoon); if (wrap.value) ro.observe(wrap.value); });
onBeforeUnmount(() => ro?.disconnect());

const agentIds = computed(() => S.agents.map((a) => a.id).join(','));
const topoKey = computed(() => agentIds.value + '|' + planEdges.value.map((e) => e.key).join(','));
const positions = shallowRef<Record<string, { x: number; y: number }>>({});

watch(topoKey, () => {
  const ids = agentIds.value.split(',').filter(Boolean);
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 26, ranksep: 70, marginx: 10, marginy: 10 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) g.setNode(id, { width: W, height: H });
  for (const id of ids) if (id !== 'overseer') g.setEdge('overseer', id);
  for (const e of planEdges.value) g.setEdge(e.from, e.to);
  dagre.layout(g);
  const p: Record<string, { x: number; y: number }> = {};
  for (const id of ids) { const n = g.node(id); if (n) p[id] = { x: n.x - W / 2, y: n.y - H / 2 }; }
  positions.value = p;
  void nextTick(refitSoon);
}, { immediate: true });

// ⚠ Chỉ phụ thuộc CẤU TRÚC (id + vị trí). Trạng thái/hiệu ứng do SwarmNode/FlowEdge tự đọc từ store —
// nếu đưa S.now/trạng thái vào đây, Vue Flow dựng lại cả đồ thị mỗi 400ms, không đo được node và fitView hỏng.
const nodes = computed<Node[]>(() => agentIds.value.split(',').filter(Boolean).map((id) => ({
  id, type: 'swarm', position: positions.value[id] ?? { x: 0, y: 0 }, data: { id },
})));

const edges = computed<Edge[]>(() => [
  ...agentIds.value.split(',').filter((id) => id && id !== 'overseer').map((id) => ({
    id: `sup-${id}`, source: 'overseer', target: id, type: 'flow', data: { kind: 'sup' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 14, height: 14 },
  })),
  ...planEdges.value.map((e) => ({
    id: `h-${e.key}`, source: e.from, target: e.to, type: 'flow', data: { kind: 'hand' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8a93a3', width: 14, height: 14 },
  })),
]);

const STATUS_CLS: Record<string, string> = {
  done: 'border-ok/50 text-ok', failed: 'border-bad/60 text-bad', working: 'border-work/60 text-work', blocked: 'border-bad/60 text-bad',
  queued: 'border-accent/50 text-accent', pending: 'border-line2 text-dim', cancelled: 'border-line2 text-dim line-through', interrupted: 'border-line2 text-dim',
};
const RUN_CLS: Record<string, string> = {
  running: 'text-work', planning: 'text-accent', awaiting_plan: 'text-work', done: 'text-ok', failed: 'text-bad', cancelled: 'text-dim', interrupted: 'text-dim',
};
const active = computed(() => viewRun.value && ['planning', 'awaiting_plan', 'running'].includes(viewRun.value.status));
</script>

<template>
  <!-- Kế hoạch của run đang xem -->
    <div v-if="viewRun" class="shrink-0 flex flex-col gap-2 px-3 pt-3">
      <div class="flex items-center gap-2 panel px-3 py-2 w-fit max-w-full">
        <select v-model="S.viewRunId" class="bg-panel2 border border-line2 rounded font-mono text-[11px] px-1.5 py-1 text-mute">
          <option v-for="r in S.runs.slice(0, 12)" :key="r.id" :value="r.id">{{ r.id }} · {{ r.title.slice(0, 34) }}</option>
        </select>
        <span class="text-[13px] text-white font-medium truncate">{{ viewRun.title }}</span>
        <span class="font-mono text-[11px] font-bold uppercase" :class="RUN_CLS[viewRun.status]">{{ viewRun.status }}</span>
        <span v-if="viewRun.replans" class="chip text-work border-work/40">replan ×{{ viewRun.replans }}</span>
        <button v-if="active" class="btn py-1!" @click="api.cancelRun(viewRun.id)">✕ Huỷ</button>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button v-for="t in runTasks(viewRun.id)" :key="t.id" @click="select(t.agent)" :title="t.title"
                class="font-mono text-[11px] px-2 py-1 rounded border bg-panel/90 backdrop-blur transition-colors"
                :class="STATUS_CLS[t.status] ?? 'border-line2 text-mute'">
          {{ t.localId }} · {{ t.agent }} · {{ t.title.slice(0, 28) }}{{ t.title.length > 28 ? '…' : '' }}
        </button>
      </div>
    </div>
  <div ref="wrap" class="relative flex-1 min-h-0">
    <VueFlow id="swarm" :nodes="nodes" :edges="edges" :nodes-draggable="false" :min-zoom="0.3" :max-zoom="1.8"
             :default-edge-options="{ type: 'default' }" @node-click="(e) => select(e.node.id)" @nodes-initialized="refitSoon" @pane-ready="onReady">
      <template #node-swarm="p"><SwarmNode v-bind="p" /></template>
      <template #edge-flow="p"><FlowEdge v-bind="p" /></template>
      <Background pattern-color="#1a1e25" :gap="22" :size="1.2" />
      <Controls position="bottom-right" :show-interactive="false" />
    </VueFlow>

    <!-- Màn trống: chỉ đường cho người mới -->
    <div v-if="!S.runs.length" class="absolute inset-x-0 top-6 flex justify-center pointer-events-none">
      <div class="panel px-5 py-4 text-center max-w-md animate-rise">
        <div class="text-[15px] font-semibold text-white">Bắt đầu bằng một yêu cầu</div>
        <p class="text-[13px] text-mute mt-1">Gõ việc bạn muốn vào khung chat bên phải. Overseer sẽ tự chọn người làm và vẽ luồng ngay tại đây.</p>
      </div>
    </div>

    <div class="absolute bottom-3 left-3 flex items-center gap-4 text-[11.5px] text-mute pointer-events-none bg-bg/70 backdrop-blur px-2.5 py-1.5 rounded-lg">
      <span class="flex items-center gap-1.5"><svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="5 4" /></svg>Overseer giao việc</span>
      <span class="flex items-center gap-1.5"><svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="#566070" stroke-width="2" /></svg>chuyển kết quả</span>
      <span class="flex items-center gap-1.5"><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#f5b53d" stroke-width="2" /><circle cx="15" cy="4" r="3" fill="#f5b53d" /></svg>đang chạy</span>
    </div>
  </div>
</template>
