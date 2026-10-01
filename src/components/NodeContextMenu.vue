<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Lane, TaskNode } from '../domain'

// FR-21: 위에 추가 / 아래에 추가 / 삭제 / 링크 필터(하위 메뉴: 카테고리 체크박스 + 전체 선택/해제)
const props = defineProps<{
  node: TaskNode
  lanes: Lane[]
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  addAbove: []
  addBelow: []
  duplicate: []
  remove: []
  linkFilter: [excludedLaneIds: string[]]
}>()

const submenu = ref(false)
const el = ref<HTMLElement | null>(null)

// 화면 밖으로 나가지 않도록 위치를 보정한다.
const pos = computed(() => ({
  left: Math.min(props.x, window.innerWidth - 220) + 'px',
  top: Math.min(props.y, window.innerHeight - 230) + 'px',
}))

const excluded = computed(() => new Set(props.node.linkFilter.excludedLaneIds))

function toggleLane(laneId: string) {
  const next = new Set(excluded.value)
  if (next.has(laneId)) next.delete(laneId)
  else next.add(laneId)
  emit('linkFilter', [...next])
}

function onDocDown(e: PointerEvent) {
  if (!el.value?.contains(e.target as Node)) emit('close')
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocDown, true)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocDown, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="el" class="menu" :style="pos" role="menu" @contextmenu.prevent>
    <button role="menuitem" @click="emit('addAbove')">⬆ 위에 추가</button>
    <button role="menuitem" @click="emit('addBelow')">⬇ 아래에 추가</button>
    <button role="menuitem" @click="emit('duplicate')">⧉ 복제</button>
    <button role="menuitem" class="danger" @click="emit('remove')">🗑 삭제</button>
    <hr />
    <button role="menuitem" class="has-sub" @click="submenu = !submenu">
      🔗 링크 필터 <span class="arrow">{{ submenu ? '▾' : '▸' }}</span>
    </button>
    <div v-if="submenu" class="sub">
      <p class="muted hint">체크한 카테고리의 다음 노드에 연결</p>
      <label v-for="l in lanes" :key="l.id">
        <input type="checkbox" :checked="!excluded.has(l.id)" @change="toggleLane(l.id)" />
        {{ l.name }}
      </label>
      <div class="all">
        <button class="btn small" @click="emit('linkFilter', [])">전체 선택</button>
        <button class="btn small" @click="emit('linkFilter', lanes.map((l) => l.id))">전체 해제</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu {
  position: fixed;
  z-index: 60;
  width: 210px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.menu > button {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.menu > button:hover {
  background: var(--surface-2);
}
.danger {
  color: var(--danger);
}
hr {
  margin: 4px 0;
  border: 0;
  border-top: 1px solid var(--border);
}
.sub {
  display: grid;
  gap: 2px;
  padding: 4px 10px 8px;
}
.sub label {
  display: flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
}
.hint {
  margin: 0 0 2px;
  font-size: 11px;
}
.all {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
</style>
