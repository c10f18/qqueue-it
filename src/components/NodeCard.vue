<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { isCompleted, type TaskNode } from '../domain'

const props = defineProps<{
  node: TaskNode
  editing: boolean
  dragging: boolean
}>()

const emit = defineEmits<{
  open: []
  menu: [e: MouseEvent]
  addBelow: []
  rename: [name: string]
  stopEdit: []
  toggleDone: []
  count: [delta: number]
  dragStart: [e: PointerEvent]
}>()

const input = ref<HTMLInputElement | null>(null)
const draftName = ref(props.node.name)

watch(
  () => props.editing,
  async (on) => {
    if (!on) return
    draftName.value = props.node.name
    await nextTick()
    input.value?.focus()
    input.value?.select()
  },
  { immediate: true },
)

function commit() {
  if (!props.editing) return
  const name = draftName.value.trim()
  if (name && name !== props.node.name) emit('rename', name)
  emit('stopEdit')
}

function onPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (target.closest('button, input')) return
  // 터치는 스크롤과 구분하기 위해 손잡이에서만 드래그를 시작한다.
  if (e.pointerType === 'touch' && !target.closest('.grip')) return
  emit('dragStart', e)
}
</script>

<template>
  <div
    class="card"
    :class="{ done: isCompleted(node), hidden: !node.visible, dragging }"
    @pointerdown="onPointerDown"
    @click="!editing && emit('open')"
    @contextmenu.prevent="emit('menu', $event)"
  >
    <div class="row">
      <span class="grip" title="끌어서 이동" aria-hidden="true">⠿</span>
      <span v-if="node.icon" class="icon">{{ node.icon }}</span>
      <input
        v-if="editing"
        ref="input"
        v-model="draftName"
        class="name-input"
        maxlength="80"
        @click.stop
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent="emit('stopEdit')"
        @blur="commit"
      />
      <span v-else class="name" :title="node.name">{{ node.name }}</span>
      <span v-if="!node.visible" class="muted" title="뷰·export에서 숨김">🙈</span>
      <button
        class="check"
        :class="{ on: isCompleted(node) }"
        :title="isCompleted(node) ? '완료 취소 (0%)' : '완료 (100%)'"
        @click.stop="emit('toggleDone')"
      >
        ✓
      </button>
    </div>

    <div class="row meta">
      <div class="bar" :title="`${node.progress}%`">
        <div class="fill" :style="{ width: node.progress + '%' }" />
      </div>
      <span class="pct">{{ node.progress }}%</span>
      <span class="counter" title="횟수">
        <button @click.stop="emit('count', -1)" :disabled="node.count <= 0" aria-label="횟수 감소">−</button>
        <b>{{ node.count }}</b>
        <button @click.stop="emit('count', 1)" aria-label="횟수 증가">+</button>
      </span>
    </div>

    <div v-if="node.tags.length" class="tags">
      <span v-for="t in node.tags" :key="t" class="chip">#{{ t }}</span>
    </div>

    <button class="add-below" title="아래에 새 슬롯 추가" @click.stop="emit('addBelow')">+</button>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  display: grid;
  gap: 4px;
  min-height: 56px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--lane, var(--accent));
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
  user-select: none;
  touch-action: pan-y pan-x;
}
.card:hover {
  box-shadow: 0 1px 8px rgb(0 0 0 / 0.12);
}
.card.dragging {
  opacity: 0.35;
}
.card.hidden {
  opacity: 0.6;
  border-style: dashed;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.grip {
  flex: none;
  color: var(--text-dim);
  cursor: grab;
  touch-action: none;
  padding: 0 2px;
}
.icon {
  flex: none;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.done .name {
  text-decoration: line-through;
  color: var(--text-dim);
}
.name-input {
  flex: 1;
  min-width: 0;
  padding: 1px 6px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--surface);
}
.check {
  flex: none;
  width: 22px;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  cursor: pointer;
  line-height: 1;
}
.check:hover {
  color: var(--text-dim);
}
.check.on {
  background: var(--ok);
  border-color: var(--ok);
  color: #fff;
}
.meta {
  font-size: 12px;
  color: var(--text-dim);
}
.bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--surface-2);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--lane, var(--accent));
  transition: width 0.15s;
}
.done .fill {
  background: var(--ok);
}
.pct {
  min-width: 32px;
  text-align: right;
}
.counter {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.counter button {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  line-height: 1;
}
.counter button:disabled {
  opacity: 0.35;
  cursor: default;
}
.counter b {
  min-width: 16px;
  text-align: center;
  color: var(--text);
}
.tags {
  display: flex;
  gap: 4px;
  overflow: hidden;
  flex-wrap: wrap;
}
.add-below {
  position: absolute;
  left: 50%;
  bottom: -11px;
  z-index: 3;
  display: none;
  width: 22px;
  height: 22px;
  padding: 0;
  transform: translateX(-50%);
  border: 1px solid var(--accent);
  border-radius: 50%;
  background: var(--surface);
  color: var(--accent);
  cursor: pointer;
  line-height: 1;
}
.card:hover .add-below {
  display: block;
}
@media (hover: none) {
  .add-below {
    display: block;
  }
}
</style>
