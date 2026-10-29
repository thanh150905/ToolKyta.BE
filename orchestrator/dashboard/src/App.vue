<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { S } from './store';

// Esc đóng lớp phủ đang mở (Inbox, chọn model).
const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { S.ui.inbox = false; S.ui.models = false; } };
onMounted(() => window.addEventListener('keydown', onEsc));
onBeforeUnmount(() => window.removeEventListener('keydown', onEsc));
import TopBar from './components/TopBar.vue';
import AgentsPanel from './components/AgentsPanel.vue';
import WorkspacePanel from './components/WorkspacePanel.vue';
import QueuesPanel from './components/QueuesPanel.vue';
import SwarmGraph from './components/SwarmGraph.vue';
import MessagesPanel from './components/MessagesPanel.vue';
import EventLog from './components/EventLog.vue';
import InboxDrawer from './components/InboxDrawer.vue';
import ModelModal from './components/ModelModal.vue';
import Toasts from './components/Toasts.vue';
</script>

<template>
  <div class="h-full flex flex-col">
    <TopBar />
    <div v-if="!S.loaded" class="flex-1 flex items-center justify-center font-mono text-mute text-[13px]">
      Đang kết nối backend Kyta Swarm (:5178)…
    </div>
    <main v-else class="flex-1 min-h-0 grid grid-cols-[300px_minmax(0,1fr)_430px]">
      <aside class="min-h-0 flex flex-col gap-3 p-3 border-r border-line">
        <AgentsPanel class="flex-[3]" />
        <WorkspacePanel class="flex-[2]" />
        <QueuesPanel />
      </aside>
      <section class="min-h-0 min-w-0 flex flex-col">
        <SwarmGraph />
        <EventLog />
      </section>
      <aside class="min-h-0 p-3 border-l border-line">
        <MessagesPanel />
      </aside>
    </main>
    <InboxDrawer />
    <ModelModal />
    <Toasts />
  </div>
</template>
