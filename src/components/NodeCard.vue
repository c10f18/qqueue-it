<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { isCompleted, type LabelGroup, type TaskNode } from '../domain'
import ProgressControl from './ProgressControl.vue'

const props = defineProps<{
  node: TaskNode
  /** 이름 외에 추가한 라벨 그룹. 그룹마다 입력 줄이 하나씩 생긴다. */
  labelGroups: LabelGroup[]
  editing: boolean
  dragging: boolean
}>()

const emit = defineEmits<{
  open: []
  menu: [e: MouseEvent]
  addBelow: []
  rename: [name: string]
  /** 라벨 입력 중: 글자를 칠 때마다 보낸다 (그래프에 바로 반영) */
  label: [groupId: string, text: string]
  /** 라벨 입력을 마침 (포커스가 빠짐) */
  labelEnd: []
  stopEdit: []
  toggleDone: []
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

// 입력 중인 라벨 줄은 저장된 값(앞뒤 공백을 뗀 값)으로 덮어쓰지 않도록 따로 들고 있는다.
const labelFocus = ref<string | null>(null)
const labelDraft = ref('')
function labelValue(groupId: string): string {
  return labelFocus.value === groupId ? labelDraft.value : (props.node.labels?.[groupId] ?? '')
}
function onLabelFocus(groupId: string) {
  labelDraft.value = props.node.labels?.[groupId] ?? ''
  labelFocus.value = groupId
}
function onLabelInput(groupId: string, e: Event) {
  labelDraft.value = (e.target as HTMLInputElement).value
  emit('label', groupId, labelDraft.value)
}
function onLabelBlur() {
  labelFocus.value = null
  emit('labelEnd')
}

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
      <span
        v-if="node.image || node.color"
        class="thumb"
        :style="{ background: node.color, backgroundImage: node.image ? `url(${node.image})` : undefined }"
      />
      <span v-if="node.icon && !node.image" class="icon">{{ node.icon }}</span>
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

    <input
      v-for="g in labelGroups"
      :key="g.id"
      class="label-input"
      :class="{ off: g.visible === false }"
      maxlength="40"
      :value="labelValue(g.id)"
      :placeholder="g.name"
      :title="g.visible === false ? `${g.name} (숨긴 그룹: 그래프에 표시되지 않음)` : `${g.name} (그래프에서 노드 옆에 표시)`"
      :aria-label="g.name"
      @click.stop
      @focus="onLabelFocus(g.id)"
      @input="onLabelInput(g.id, $event)"
      @blur="onLabelBlur"
      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
    />

    <div class="row meta">
      <ProgressControl :node-id="node.id" :progress="node.progress" />
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
.thumb {
  flex: none;
  width: 22px;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background-size: cover;
  background-position: center;
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
.label-input {
  min-width: 0;
  padding: 1px 6px;
  border: 1px solid transparent;
  border-bottom-color: var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  user-select: text;
}
.label-input.off {
  opacity: 0.5;
  font-style: italic;
}
.label-input:focus {
  border-color: var(--accent);
  background: var(--surface);
  outline: none;
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
