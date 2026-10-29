<script setup lang="ts">
import { S, api } from '../store';

async function change(agent: string, e: Event) {
  const model = (e.target as HTMLInputElement).value.trim();
  if (model) await api.model(agent, model);
}
</script>

<template>
  <div v-if="S.ui.models" class="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" @click.self="S.ui.models = false">
    <div class="panel w-[520px] max-w-[95vw] p-4">
      <div class="flex items-center justify-between mb-3">
        <span class="label">Model theo agent</span>
        <button class="btn" @click="S.ui.models = false">✕</button>
      </div>
      <p class="text-[12px] text-mute mb-3">Đổi model có hiệu lực từ lượt gọi kế tiếp (không lưu vào agents.yaml). Tên model phải có ở gateway (LiteLLM / endpoint đang cấu hình).</p>
      <datalist id="models"><option v-for="m in S.models" :key="m" :value="m" /></datalist>
      <div class="space-y-2">
        <div v-for="a in S.agents" :key="a.id" class="grid grid-cols-[120px_1fr_90px] items-center gap-2">
          <span class="text-[13px] text-ink">{{ a.name }}</span>
          <input list="models" :value="a.model" @change="change(a.id, $event)"
                 class="bg-bg border border-line2 rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-accent/60" />
          <span class="font-mono text-[11px] text-dim text-right">
            {{ (S.usage.byAgent.find((b) => b.agent === a.id)?.cost ?? 0).toFixed(4) }}$
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
