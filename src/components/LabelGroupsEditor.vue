<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import {
  addLabelGroup,
  labelGroupsOf,
  labelAngle,
  removeLabelGroup,
  updateLabelGroup,
  LABEL_SIZE,
  MAX_LABEL_GROUPS,
  NAME_LABEL_GROUP_ID,
  NAME_LABEL_GROUP_NAME,
  type BoardData,
  type GraphDirection,
  type LabelGroupPatch,
} from '../domain'
import { useBoardStore } from '../stores/board'
import { labelFontCss } from '../graph/labelFont'
import LabelFontDialog from './LabelFontDialog.vue'

// 설정 패널의 "노드 라벨" 구역: 그룹 추가·삭제, 이름, 위치(8방향), 색, 크기.
const props = defineProps<{ data: BoardData }>()
const store = useBoardStore()

const groups = computed(() => labelGroupsOf(props.data))
// 글꼴 팝업은 한 번에 한 그룹만 연다.
const fontOpenId = ref<string | null>(null)
const fontGroup = computed(() => groups.value.find((g) => g.id === fontOpenId.value))

function patch(id: string, p: LabelGroupPatch) {
  store.apply((d) => updateLabelGroup(d, id, p))
}
function rename(id: string, e: Event) {
  const input = e.target as HTMLInputElement
  const current = groups.value.find((g) => g.id === id)?.name ?? ''
  if (input.value.trim() && input.value.trim() !== current) patch(id, { name: input.value })
  else input.value = current
}

// 가운데 노브: 누른 채 돌리면 각도가 실시간으로 바뀐다.
// 돌리는 동안은 되돌리기 기록 한 칸만 쓰도록 같은 gesture 이름으로 적용한다.
function angleAt(e: PointerEvent): number {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const dx = e.clientX - (rect.left + rect.width / 2)
  const dy = e.clientY - (rect.top + rect.height / 2)
  return (Math.atan2(dx, -dy) * 180) / Math.PI
}
function turn(id: string, e: PointerEvent) {
  store.apply((d) => updateLabelGroup(d, id, { angle: angleAt(e) }), `label-angle:${id}`)
}
let turningId: string | null = null
function knobDown(id: string, e: PointerEvent) {
  try {
    // 노브 밖으로 나가도 계속 돌릴 수 있게 포인터를 붙잡는다.
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    // 붙잡지 못해도 노브 위에서는 돌릴 수 있다.
  }
  turningId = id
  turn(id, e)
}
function knobMove(id: string, e: PointerEvent) {
  if (turningId === id) turn(id, e)
}
function knobUp() {
  turningId = null
  store.endGesture()
}
function knobKey(id: string, current: number, e: KeyboardEvent) {
  const step = e.shiftKey ? 15 : 1
  const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0
  if (!delta) return
  e.preventDefault()
  patch(id, { angle: current + delta })
}
// 각도는 평소에는 글자로만 보이고, 누르면 그 자리에서 숫자 입력 칸으로 바뀐다.
const angleEditId = ref<string | null>(null)
const angleDraft = ref('')
async function startAngle(id: string, current: number) {
  angleDraft.value = String(current)
  angleEditId.value = id
  await nextTick()
  const field = document.getElementById(`angle-${id}`) as HTMLInputElement | null
  field?.focus()
  field?.select()
}
function onAngleInput(e: Event) {
  const input = e.target as HTMLInputElement
  angleDraft.value = input.value.replace(/\D/g, '').slice(0, 3)
  input.value = angleDraft.value
}
function commitAngle(id: string, current: number) {
  if (angleEditId.value !== id) return
  angleEditId.value = null
  if (angleDraft.value === '') return
  const value = Number(angleDraft.value)
  if (value !== current) patch(id, { angle: value })
}

// 3×3 위치 판: 가운데가 노드(=각도 노브)
const POSITIONS: (GraphDirection | null)[] = [
  'up-left', 'up', 'up-right',
  'left', null, 'right',
  'down-left', 'down', 'down-right',
]
const POSITION_LABEL: Record<GraphDirection, string> = {
  'up-left': '왼쪽 위',
  up: '위',
  'up-right': '오른쪽 위',
  left: '왼쪽',
  right: '오른쪽',
  'down-left': '왼쪽 아래',
  down: '아래',
  'down-right': '오른쪽 아래',
}
</script>

<template>
  <div class="groups">
    <div v-for="g in groups" :key="g.id" class="group" :class="{ off: g.visible === false }">
      <div class="row">
        <span v-if="g.id === NAME_LABEL_GROUP_ID" class="fixed-name" title="첫 그룹은 작업 이름을 표시하며 이름을 바꿀 수 없습니다">
          {{ NAME_LABEL_GROUP_NAME }}
        </span>
        <input
          v-else
          class="input name"
          :value="g.name"
          maxlength="20"
          :aria-label="`${g.name} 그룹 이름`"
          @change="rename(g.id, $event)"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        />
        <button
          type="button"
          class="btn ghost small"
          role="switch"
          :aria-checked="g.visible !== false"
          :title="g.visible === false ? '그래프에 보이기' : '그래프에서 숨기기'"
          :aria-label="`${g.name} 그래프에 표시`"
          @click="patch(g.id, { visible: g.visible === false })"
        >
          {{ g.visible === false ? '🚫' : '👁' }}
        </button>
        <span v-if="g.id === NAME_LABEL_GROUP_ID" class="muted hint">고정</span>
        <button
          v-else
          type="button"
          class="btn ghost small"
          title="그룹 삭제 (입력한 라벨도 지워집니다)"
          :aria-label="`${g.name} 그룹 삭제`"
          @click="store.apply((d) => removeLabelGroup(d, g.id))"
        >
          ✕
        </button>
      </div>

      <div class="row">
        <div class="pos-grid" role="radiogroup" :aria-label="`${g.name} 위치`">
          <template v-for="(p, i) in POSITIONS" :key="i">
            <button
              v-if="p"
              type="button"
              role="radio"
              :class="{ on: g.angle === undefined && g.position === p }"
              :aria-checked="g.angle === undefined && g.position === p"
              :title="`노드의 ${POSITION_LABEL[p]}`"
              :aria-label="`노드의 ${POSITION_LABEL[p]}`"
              @click="patch(g.id, { position: p })"
            />
            <span
              v-else
              class="knob"
              role="slider"
              tabindex="0"
              aria-valuemin="0"
              aria-valuemax="359"
              :aria-valuenow="labelAngle(g)"
              :aria-label="`${g.name} 위치 각도`"
              title="누른 채 돌려서 각도 조정 (방향키: 1°, Shift+방향키: 15°)"
              @pointerdown.prevent="knobDown(g.id, $event)"
              @pointermove="knobMove(g.id, $event)"
              @pointerup="knobUp"
              @pointercancel="knobUp"
              @keydown="knobKey(g.id, labelAngle(g), $event)"
            >
              <span class="needle" :style="{ transform: `rotate(${labelAngle(g)}deg)` }" />
            </span>
          </template>
        </div>

        <div class="side">
          <span class="angle">
            <span class="muted">각도</span>
            <input
              v-if="angleEditId === g.id"
              :id="`angle-${g.id}`"
              class="angle-field"
              inputmode="numeric"
              maxlength="3"
              :value="angleDraft"
              :aria-label="`${g.name} 위치 각도(도) 입력`"
              @input="onAngleInput"
              @keydown.enter.prevent="commitAngle(g.id, labelAngle(g))"
              @keydown.esc.prevent="angleEditId = null"
              @blur="commitAngle(g.id, labelAngle(g))"
            />
            <button
              v-else
              type="button"
              class="angle-text"
              title="눌러서 숫자로 입력"
              :aria-label="`${g.name} 위치 각도 ${labelAngle(g)}도, 눌러서 입력`"
              @click="startAngle(g.id, labelAngle(g))"
            >
              {{ labelAngle(g) }}°
            </button>
          </span>
          <button
            type="button"
            class="font-btn"
            :class="{ on: fontOpenId === g.id }"
            aria-haspopup="dialog"
            :aria-expanded="fontOpenId === g.id"
            :title="`${g.name} 글꼴·스타일·크기·색`"
            @click="fontOpenId = fontOpenId === g.id ? null : g.id"
          >
            <span
              class="sample"
              :style="{
                font: labelFontCss({ ...g, size: 14 }),
                color: g.color,
                textDecoration: g.underline ? 'underline' : undefined,
              }"
            >
              가Aa
            </span>
            <span class="muted">{{ g.size ?? LABEL_SIZE.default }}px · 글꼴…</span>
          </button>
        </div>
      </div>
    </div>

    <LabelFontDialog v-if="fontGroup" :group="fontGroup" @change="(p) => patch(fontGroup!.id, p)" @close="fontOpenId = null" />

    <button
      type="button"
      class="btn small add"
      :disabled="groups.length >= MAX_LABEL_GROUPS"
      @click="store.apply((d) => addLabelGroup(d))"
    >
      + 라벨 그룹 추가 ({{ groups.length }}/{{ MAX_LABEL_GROUPS }})
    </button>
  </div>
</template>

<style scoped>
.groups {
  display: grid;
  gap: 8px;
}
.group {
  display: grid;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.name {
  flex: 1;
  min-width: 0;
}
/* 숨긴 그룹은 흐리게 보여 준다 (보이기 버튼은 또렷하게) */
.group.off > :not(:first-child),
.group.off .name,
.group.off .fixed-name {
  opacity: 0.45;
}
.fixed-name {
  flex: 1;
  min-width: 0;
  padding: 0 4px;
  font-weight: 700;
}
.hint {
  flex: none;
  font-size: 12px;
}
.pos-grid {
  display: grid;
  flex: none;
  grid-template-columns: 20px 48px 20px;
  grid-template-rows: 20px 48px 20px;
  place-items: center;
  gap: 3px;
}
.pos-grid button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface);
}
.pos-grid button {
  cursor: pointer;
}
.pos-grid button.on {
  background: var(--accent);
  border-color: var(--accent);
}
/* 각도 노브: 가운데 원이 노드, 바늘 끝의 점이 라벨 위치 */
.knob {
  position: relative;
  width: 48px;
  height: 48px;
  border: 2px solid var(--text-dim);
  border-radius: 50%;
  background: var(--surface-2);
  cursor: grab;
  touch-action: none;
}
.knob:active {
  cursor: grabbing;
}
.knob:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.needle {
  position: absolute;
  left: 50%;
  bottom: 50%;
  width: 2px;
  height: 20px;
  margin-left: -1px;
  background: var(--accent);
  transform-origin: 50% 100%;
  pointer-events: none;
}
.needle::after {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
}
.angle {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
}
.angle-text,
.angle-field {
  width: 48px;
  padding: 1px 4px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  text-align: left;
  font-variant-numeric: tabular-nums;
}
.angle-text {
  cursor: text;
}
.angle-text:hover {
  border-color: var(--border);
}
.angle-field {
  border-color: var(--accent);
  background: var(--surface);
  outline: none;
}
.side {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 6px;
}
.size {
  display: grid;
  gap: 2px;
  font-size: 12px;
}
.size input {
  width: 100%;
}
.font-btn {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-self: start;
  max-width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-size: 12px;
  cursor: pointer;
}
.font-btn.on {
  border-color: var(--accent);
}
.font-btn .sample {
  color: var(--text);
}
.swatch {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 10px;
}
.add {
  justify-self: start;
}
</style>
