<script setup lang="ts">
import { S } from '../store';
import { fmtSize } from '../md';
</script>

<template>
  <section class="panel flex flex-col min-h-0">
    <div class="flex items-center justify-between px-3 py-2 border-b border-line">
      <span class="label">Workspace</span>
      <span class="font-mono text-[11px] text-mute">{{ S.files.filter((f) => f.op === 'write').length }} ghi · {{ S.files.length }} file</span>
    </div>
    <div class="overflow-y-auto py-1 font-mono text-[12px]">
      <div v-if="!S.files.length" class="px-3 py-2 text-dim">Chưa có file nào được chạm tới.</div>
      <div v-for="f in S.files" :key="f.path" :title="`${f.path} · ${f.agent}`"
           class="flex items-center gap-2 px-3 py-1 hover:bg-panel2">
        <span :class="f.op === 'write' ? 'text-work' : 'text-dim'">{{ f.op === 'write' ? '✎' : '›_' }}</span>
        <!-- rtl + bdi: cắt phần ĐẦU đường dẫn, giữ tên file ở cuối -->
        <span class="truncate text-left flex-1" :class="f.op === 'write' ? 'text-ink' : 'text-mute'" style="direction: rtl"><bdi>{{ f.path }}</bdi></span>
        <span class="text-dim shrink-0">{{ fmtSize(f.size) }}</span>
      </div>
    </div>
  </section>
</template>
