<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { Lane } from '../domain'

const props = defineProps<{
  lane: Lane
  canDelete: boolean
  dragging: boolean
  startEditing?: boolean
}>()

const emit = defineEmits<{
  rename: [name: string]
  toggle: []
  remove: []
  resetProgress: []
  dragStart: [e: PointerEvent]
}>()

const editing = ref(!!props.startEditing)
const draftName = ref(props.lane.name)
const input = ref<HTMLInputElement | null>(null)
const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)

async function beginEdit() {
  menuOpen.value = false
  draftName.value = props.lane.name
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

function commit() {
  if (!editing.value) return
  editing.value = false
  const name = draftName.value.trim()
  if (name && name !== props.lane.name) emit('rename', name)
}

function onDocDown(e: PointerEvent) {
  if (menuOpen.value && !root.value?.contains(e.target as Node)) menuOpen.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocDown, true)
  if (editing.value) void beginEdit()
})
onUnmounted(() => document.removeEventListener('pointerdown', onDocDown, true))
</script>

<template>
  <div ref="root" class="head" :class="{ dragging }">
    <span class="grip" title="끌어서 열 순서 변경" @pointerdown="emit('dragStart', $event)">⠿</span>

    <input
      v-if="editing"
      ref="input"
      v-model="draftName"
      class="name-input"
      maxlength="30"
      @keydown.enter.prevent="commit"
      @keydown.esc.prevent="editing = false"
      @blur="commit"
    />
    <span v-else class="name" :title="`${lane.name} (더블클릭으로 이름 수정)`" @dblclick="beginEdit">{{ lane.name }}</span>

    <button class="icon-btn" :title="lane.active ? '숨기기' : '보이기'" @click="emit('toggle')">
      {{ lane.active ? '👁' : '🚫' }}
    </button>
    <button class="icon-btn" aria-label="카테고리 메뉴" @click="menuOpen = !menuOpen">⋯</button>

    <div v-if="menuOpen" class="dropdown" role="menu">
      <button role="menuitem" @click="beginEdit">✏ 이름 수정</button>
      <button
        role="menuitem"
        @click="((menuOpen = false), emit('resetProgress'))"
      >
        ↺ 진행도 리셋
      </button>
      <button
        role="menuitem"
        class="danger"
        :disabled="!canDelete"
        :title="canDelete ? '' : '마지막 카테고리는 삭제할 수 없습니다'"
        @click="((menuOpen = false), emit('remove'))"
      >
        🗑 삭제
      </button>
    </div>
  </div>
</template>

<style scoped>
.head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: 3px solid var(--lane, var(--accent));
}
.head.dragging {
  opacity: 0.4;
}
.grip {
  flex: none;
  color: var(--text-dim);
  cursor: grab;
  touch-action: none;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}
.name-input {
  flex: 1;
  min-width: 0;
  padding: 1px 6px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--surface);
}
.icon-btn {
  flex: none;
  padding: 0 4px;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 20;
  min-width: 150px;
  margin-top: 4px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.dropdown button {
  display: block;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.dropdown button:hover:not(:disabled) {
  background: var(--surface-2);
}
.dropdown button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.danger {
  color: var(--danger);
}
</style>
