<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { updateNode } from '../domain'
import { useBoardStore } from '../stores/board'

// 진행도 조절: 슬라이더를 끌어 1% 단위로 바꾸거나, % 숫자를 눌러 직접 입력한다.
// 수정 모드와 보기 모드 양쪽에서 쓴다.
const props = defineProps<{ nodeId: string; progress: number; compact?: boolean }>()
const store = useBoardStore()

// 끄는 동안은 되돌리기 기록 한 칸으로 묶는다.
function slide(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  store.apply((d) => updateNode(d, props.nodeId, { progress: value }), `progress:${props.nodeId}`)
}

const typing = ref(false)
const draft = ref('')
const field = ref<HTMLInputElement | null>(null)
async function startTyping() {
  draft.value = String(props.progress)
  typing.value = true
  await nextTick()
  field.value?.focus()
  field.value?.select()
}
function onType(e: Event) {
  // 숫자만 받는다.
  const input = e.target as HTMLInputElement
  draft.value = input.value.replace(/\D/g, '').slice(0, 3)
  input.value = draft.value
}
function commitTyping() {
  if (!typing.value) return
  typing.value = false
  if (draft.value === '') return
  const value = Math.min(100, Number(draft.value))
  if (value !== props.progress) store.apply((d) => updateNode(d, props.nodeId, { progress: value }))
}
</script>

<template>
  <span class="pc" :class="{ compact, done: progress === 100 }" @click.stop>
    <input
      class="slider"
      type="range"
      min="0"
      max="100"
      step="1"
      :value="progress"
      :style="{ '--p': progress + '%' }"
      aria-label="진행도"
      @input="slide"
      @change="store.endGesture()"
    />
    <input
      v-if="typing"
      ref="field"
      class="num"
      inputmode="numeric"
      maxlength="3"
      :value="draft"
      aria-label="진행도(%) 입력"
      @input="onType"
      @keydown.enter.prevent="commitTyping"
      @keydown.esc.prevent="typing = false"
      @blur="commitTyping"
    />
    <button v-else type="button" class="pct" title="눌러서 숫자로 입력" @click="startTyping">{{ progress }}%</button>
  </span>
</template>

<style scoped>
.pc {
  display: flex;
  flex: 1;
  gap: 6px;
  align-items: center;
  min-width: 0;
}
.pc.compact {
  display: inline-flex;
  flex: none;
}
/* 채워진 만큼 레인 색으로 칠한 막대 + 끌 수 있는 손잡이 */
.slider {
  flex: 1;
  min-width: 0;
  height: 16px;
  margin: 0;
  background: transparent;
  appearance: none;
  cursor: pointer;
  touch-action: pan-y;
}
.compact .slider {
  flex: none;
  width: 64px;
}
.slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, var(--bar) var(--p), var(--surface-2) var(--p));
}
.slider::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, var(--bar) var(--p), var(--surface-2) var(--p));
}
.slider::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  margin-top: -4px;
  border: 2px solid var(--bar);
  border-radius: 50%;
  background: var(--surface);
  appearance: none;
}
.slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 2px solid var(--bar);
  border-radius: 50%;
  background: var(--surface);
}
.pc {
  --bar: var(--lane, var(--accent));
}
.pc.done {
  --bar: var(--ok);
}
.pct,
.num {
  flex: none;
  width: 44px;
  padding: 1px 4px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pct {
  cursor: text;
}
.pct:hover {
  border-color: var(--border);
  color: var(--text);
}
.num {
  border-color: var(--accent);
  background: var(--surface);
  color: var(--text);
  outline: none;
}
</style>
