<script setup lang="ts">
import { S, api, select, stats } from '../store';

const stat = (label: string, value: string | number, tip: string, tone = '') => ({ label, value, tone, tip });
async function toggleTeam() { await api.team(S.teamPaused ? 'resume' : 'pause'); }
async function openBrowser() { await api.browser(S.browser.open ? undefined : 'https://eform.sandbox.kytaplatform.com'); }
</script>

<template>
  <header class="h-12 shrink-0 flex items-center gap-4 px-4 border-b border-line bg-panel">
    <div class="flex items-center gap-2 font-mono font-bold tracking-[0.2em] text-[13px] text-white">
      <span class="text-accent">◈</span> KYTA SWARM
    </div>

    <div class="flex items-center gap-4 font-mono text-[12px]">
      <span v-for="s in [
              stat('Agent', stats.agents, 'Số agent trong đội'),
              stat('Đang bận', stats.busy, 'Agent đang làm việc hoặc đang chờ bạn trả lời', 'work'),
              stat('Chờ xử lý', stats.queued, 'Số việc đã giao nhưng agent chưa bắt đầu (xếp hàng sau việc đang làm)'),
              stat('Sự kiện', S.eventCount, 'Số dòng nhật ký đã ghi (xem Event log bên dưới)')]"
            :key="s.label" class="text-mute cursor-help" :title="s.tip">
        {{ s.label }} <b class="ml-1 px-1.5 py-0.5 rounded border border-line2 bg-panel2"
                         :class="s.tone === 'work' && Number(s.value) > 0 ? 'text-work border-work/40' : 'text-ink'">{{ s.value }}</b>
      </span>
      <span class="text-mute cursor-help" title="Chi phí ƯỚC TÍNH 24 giờ qua theo bảng giá trong config/models.yaml">Chi phí 24h <b class="ml-1 px-1.5 py-0.5 rounded border border-line2 bg-panel2 text-ink">${{ S.usage.cost.toFixed(3) }}</b></span>
    </div>

    <div class="flex-1 flex justify-center items-center gap-3">
      <span v-for="(until, m) in S.quota" :key="m" v-show="until > S.now"
            class="font-mono text-[11px] px-2 py-1 rounded border border-bad/50 bg-bad/10 text-bad whitespace-nowrap" :title="'Chặn tới ' + new Date(until).toLocaleString('vi-VN')">
        ⛔ {{ m }} hết quota ngày
      </span>
      <button @click="select('overseer')"
              class="font-mono text-[12px] px-4 py-1.5 rounded-full border transition-all whitespace-nowrap shrink-0"
              :class="S.selected === 'overseer' ? 'border-accent text-accent shadow-[0_0_18px_-4px] shadow-accent/60 bg-accent/10' : 'border-line2 text-mute hover:text-ink'">
        ◎ Overseer
      </button>
    </div>

    <div class="flex items-center gap-2">
      <button class="btn relative" @click="S.ui.inbox = true">
        ✉ Cần bạn
        <span v-if="S.inbox.length" class="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-work text-black text-[10px] leading-4 text-center animate-pulse">{{ S.inbox.length }}</span>
      </button>
      <button class="btn" @click="S.ui.models = true">⚙ Model</button>
      <button class="btn" @click="openBrowser" :title="S.browser.url ?? 'Mở Chrome cho Recon (bạn đăng nhập 1 lần)'">
        <span :class="S.browser.open ? 'text-ok' : 'text-dim'">●</span> Browser
      </button>
      <button class="btn" :class="S.teamPaused ? 'text-work border-work/50' : ''" @click="toggleTeam">
        {{ S.teamPaused ? '▶ Resume team' : '⏸ Pause team' }}
      </button>
      <span class="font-mono text-[11px] font-bold px-2.5 py-1.5 rounded border flex items-center gap-1.5"
            :class="S.connected ? 'border-ok/40 text-ok' : 'border-bad/40 text-bad'">
        <span class="w-1.5 h-1.5 rounded-full" :class="S.connected ? 'bg-ok animate-pulse' : 'bg-bad'"></span>
        {{ S.connected ? 'LIVE' : 'OFFLINE' }}
      </span>
    </div>
  </header>
</template>
