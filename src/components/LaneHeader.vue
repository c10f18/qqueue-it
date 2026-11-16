<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { Lane } from '../domain'
import ColorPicker from './ColorPicker.vue'

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
  color: [value: string | undefined]
  dragStart: [e: PointerEvent]
}>()

const editing = ref(!!props.startEditing)
const draftName = ref(props.lane.name)
const input = ref<HTMLInputElement | null>(null)
const menuOpen = ref(false)
const colorOpen = ref(false)
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
  if (root.value?.contains(e.target as Node)) return
  menuOpen.value = false
  colorOpen.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocDown, true)
  if (editing.value) void beginEdit()
})
onUnmounted(() => document.removeEventListener('pointerdown', onDocDown, true))
</script>

<template>
  <div ref="root" class="head" :class="{ dragging }">
    <span class="grip" title="끌어서 열 순서 변경" @pointerdown="emit('dragStart', $event)"><AppIcon name="grip" /></span>

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
    <span v-else class="name" :title="`${lane.name} (클릭하여 이름 수정)`" @click="beginEdit">{{ lane.name }}</span>

    <button class="icon-btn sm" :title="lane.active ? '숨기기' : '보이기'" :aria-label="lane.active ? '숨기기' : '보이기'" @click="emit('toggle')">
      <AppIcon :name="lane.active ? 'eye' : 'eye-off'" />
    </button>
    <button
      class="icon-btn sm"
      title="카테고리 메뉴"
      aria-label="카테고리 메뉴"
      :aria-expanded="menuOpen"
      @click="((colorOpen = false), (menuOpen = !menuOpen))"
    >
      <AppIcon name="more" />
    </button>

    <div v-if="menuOpen" class="menu dropdown" role="menu">
      <button role="menuitem" @click="((menuOpen = false), (colorOpen = true))"><AppIcon name="palette" /> 색 변경</button>
      <button
        role="menuitem"
        @click="((menuOpen = false), emit('resetProgress'))"
      >
        <AppIcon name="reset" /> 진행도 리셋
      </button>
      <button
        role="menuitem"
        class="danger"
        :disabled="!canDelete"
        :title="canDelete ? '' : '마지막 카테고리는 삭제할 수 없습니다'"
        @click="((menuOpen = false), emit('remove'))"
      >
        <AppIcon name="trash" /> 삭제
      </button>
    </div>

    <div v-if="colorOpen" class="dropdown color-pop">
      <ColorPicker :model-value="lane.color" default-label="기본 색" @update:model-value="(c) => emit('color', c)" />
      <button class="btn small" @click="colorOpen = false">닫기</button>
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
  cursor: text;
}
.name-input {
  flex: 1;
  min-width: 0;
  padding: 1px 6px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--surface);
}
/* 메뉴와 색 선택 칸의 위치 (메뉴 모양은 공통 .menu) */
.dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 20;
  margin-top: 4px;
}
.danger {
  color: var(--danger);
}
.color-pop {
  display: grid;
  gap: 8px;
  width: 250px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.color-pop .btn {
  justify-self: end;
}
</style>
