<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from './composables/useRoute'
import { useBoardStore } from './stores/board'
import BoardListView from './views/BoardListView.vue'
import BoardView from './views/BoardView.vue'

const route = useRoute()
const store = useBoardStore()

// 오류 알림은 몇 초 뒤 자동으로 사라진다.
let timer = 0
watch(
  () => store.error,
  (msg) => {
    clearTimeout(timer)
    if (msg) timer = window.setTimeout(() => store.clearError(), 4000)
  },
)

// Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (또는 Ctrl+Y): 현재 보드 undo/redo (명세 19.3)
function onKey(e: KeyboardEvent) {
  if (route.value.name !== 'edit' || !(e.ctrlKey || e.metaKey)) return
  const target = e.target as HTMLElement
  if (target.closest('input, textarea, select, [contenteditable]')) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    store.redo()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <header v-if="route.name === 'list'" class="app-bar">
    <span class="logo">뀨잇</span>
    <span class="muted">QQueue It — 순서로 관리하는 할 일</span>
  </header>

  <div class="content">
    <BoardListView v-if="route.name === 'list'" />
    <BoardView
      v-else
      :key="route.boardId"
      :board-id="route.boardId"
      :mode="route.name"
    />
  </div>

  <div v-if="store.error" class="toast" role="alert" @click="store.clearError()">{{ store.error }}</div>
</template>

<style scoped>
.app-bar {
  display: flex;
  gap: 12px;
  align-items: baseline;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.logo {
  font-size: 20px;
  font-weight: 800;
  color: var(--accent);
}
.content {
  height: 100%;
  min-height: 0;
}
.app-bar + .content {
  height: auto;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 200;
  max-width: calc(100vw - 32px);
  padding: 10px 16px;
  transform: translateX(-50%);
  border-radius: 10px;
  background: var(--danger);
  color: #fff;
  box-shadow: var(--shadow);
  cursor: pointer;
}
</style>
