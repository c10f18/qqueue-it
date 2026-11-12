<script setup lang="ts">
import { computed } from 'vue'
import {
  GRAPH_RANGES,
  setGraphStyle,
  setListStyle,
  type BoardData,
  type DoneMark,
  type EdgeHead,
  type GraphNumberKey,
  type GraphStyle,
  type ListStyle,
} from '../domain'
import { ATTR_KEYS, ATTR_LABELS, resolveAttrs, type AttrKey } from '../composables/useNodeDisplay'
import { SKIN_MODULES } from './skins'
import { useBoardStore } from '../stores/board'
import ColorPicker from './ColorPicker.vue'
import LabelGroupsEditor from './LabelGroupsEditor.vue'

// 그래프 전체에 적용되는 표시 설정. 바꾸는 즉시 그래프에 반영되고 되돌리기(Ctrl+Z) 대상이다.
// 방향·간격은 여기가 아니라 "정렬" 패널(AlignDialog)에서 다룬다.
const props = defineProps<{ data: BoardData }>()
const emit = defineEmits<{ close: [] }>()
const store = useBoardStore()

const style = computed<GraphStyle>(() => props.data.board.settings.graph ?? {})
function set(patch: GraphStyle) {
  store.apply((d) => setGraphStyle(d, patch))
}
// 보기 모드 리스트의 테마(스킨)·방식·표시 속성
const list = computed<ListStyle>(() => props.data.board.settings.list ?? {})
const listAttrs = computed(() => resolveAttrs(list.value.attrs))
function setList(patch: ListStyle) {
  store.apply((d) => setListStyle(d, patch))
}
function toggleAttr(key: AttrKey) {
  const next = listAttrs.value.includes(key) ? listAttrs.value.filter((k) => k !== key) : [...listAttrs.value, key]
  setList({ attrs: next })
}

function num(key: GraphNumberKey): number {
  return style.value[key] ?? GRAPH_RANGES[key].default
}
function setNum(key: GraphNumberKey, e: Event) {
  set({ [key]: Number((e.target as HTMLInputElement).value) })
}

const MARKS: { value: DoneMark; glyph: string; label: string }[] = [
  { value: 'check', glyph: '✓', label: '체크' },
  { value: 'x', glyph: '✕', label: '엑스' },
  { value: 'star', glyph: '★', label: '별' },
  { value: 'dot', glyph: '●', label: '점' },
  { value: 'none', glyph: '', label: '표시 없음' },
]
const HEADS: { value: EdgeHead; glyph: string; label: string }[] = [
  { value: 'arrow', glyph: '▶', label: '채운 화살표' },
  { value: 'open', glyph: '＞', label: '열린 화살표' },
  { value: 'dot', glyph: '●', label: '점' },
  { value: 'none', glyph: '—', label: '없음 (선만)' },
]
</script>

<template>
  <div class="overlay side-panel">
    <div class="dialog" role="dialog" aria-label="설정">
      <h2>설정</h2>

      <section class="first">
        <h3>보기 모드 테마 (리스트)</h3>
        <div class="field">
          <label for="l-skin">테마</label>
          <select id="l-skin" class="input" :value="list.skin ?? 'simple'" @change="setList({ skin: ($event.target as HTMLSelectElement).value })">
            <option v-for="(m, id) in SKIN_MODULES" :key="id" :value="id">{{ m.label }}</option>
          </select>
        </div>
        <div class="field">
          <span class="label">방식</span>
          <div class="seg" role="radiogroup" aria-label="목록 방식">
            <button type="button" role="radio" :aria-checked="!list.flat" :class="{ on: !list.flat }" @click="setList({ flat: undefined })">
              레이어별
            </button>
            <button type="button" role="radio" :aria-checked="!!list.flat" :class="{ on: list.flat }" @click="setList({ flat: true })">
              플랫
            </button>
          </div>
        </div>
        <div class="field">
          <span class="label">표시 속성</span>
          <div class="attrs">
            <label v-for="k in ATTR_KEYS" :key="k">
              <input type="checkbox" :checked="listAttrs.includes(k)" @change="toggleAttr(k)" /> {{ ATTR_LABELS[k] }}
            </label>
          </div>
        </div>
      </section>

      <section>
        <h3>그래프</h3>

      <div class="field">
        <span class="label">전체 배경 색</span>
        <ColorPicker :model-value="style.background" default-label="기본 배경" @update:model-value="(v) => set({ background: v })" />
      </div>

      <label class="switch-row">
        <span>그래프 위에 보드 이름 표시</span>
        <input
          type="checkbox"
          class="switch"
          role="switch"
          :checked="style.showBoardName ?? false"
          @change="set({ showBoardName: ($event.target as HTMLInputElement).checked })"
        />
      </label>
      </section>

      <section>
        <h3>노드</h3>
        <div class="field">
          <label for="g-node">크기 {{ num('nodeSize') }}</label>
          <input
            id="g-node"
            type="range"
            :min="GRAPH_RANGES.nodeSize.min"
            :max="GRAPH_RANGES.nodeSize.max"
            :step="GRAPH_RANGES.nodeSize.step"
            :value="num('nodeSize')"
            @change="setNum('nodeSize', $event)"
          />
        </div>
        <label class="switch-row">
          <span>진행률 표시</span>
          <input
            type="checkbox"
            class="switch"
            role="switch"
            :checked="style.showProgress ?? true"
            @change="set({ showProgress: ($event.target as HTMLInputElement).checked })"
          />
        </label>
      </section>

      <section>
        <h3>노드 라벨</h3>
        <LabelGroupsEditor :data="data" />
      </section>

      <section>
        <h3>완료된 노드</h3>
        <div class="field">
          <span class="label">색</span>
          <ColorPicker :model-value="style.doneColor" default-label="기본 초록" @update:model-value="(v) => set({ doneColor: v })" />
        </div>
        <div class="field">
          <span class="label">표시</span>
          <div class="slots" role="radiogroup" aria-label="완료 표시">
            <button
              v-for="m in MARKS"
              :key="m.value"
              type="button"
              role="radio"
              class="slot"
              :class="{ on: (style.doneMark ?? 'check') === m.value }"
              :aria-checked="(style.doneMark ?? 'check') === m.value"
              :title="m.label"
              :aria-label="m.label"
              @click="set({ doneMark: m.value })"
            >
              <span class="done-dot">{{ m.glyph }}</span>
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3>연결 화살표</h3>
        <div class="field">
          <span class="label">색</span>
          <ColorPicker :model-value="style.edgeColor" default-label="기본 회색" @update:model-value="(v) => set({ edgeColor: v })" />
        </div>
        <div class="field">
          <span class="label">끝 모양</span>
          <div class="slots" role="radiogroup" aria-label="화살표 끝 모양">
            <button
              v-for="h in HEADS"
              :key="h.value"
              type="button"
              role="radio"
              class="slot"
              :class="{ on: (style.edgeHead ?? 'arrow') === h.value }"
              :aria-checked="(style.edgeHead ?? 'arrow') === h.value"
              :title="h.label"
              :aria-label="h.label"
              @click="set({ edgeHead: h.value })"
            >
              {{ h.glyph }}
            </button>
          </div>
        </div>
        <div class="two">
          <div class="field">
            <label for="g-head-size">끝 크기 ×{{ num('edgeHeadSize') }}</label>
            <input
              id="g-head-size"
              type="range"
              :min="GRAPH_RANGES.edgeHeadSize.min"
              :max="GRAPH_RANGES.edgeHeadSize.max"
              :step="GRAPH_RANGES.edgeHeadSize.step"
              :value="num('edgeHeadSize')"
              :disabled="(style.edgeHead ?? 'arrow') === 'none'"
              @change="setNum('edgeHeadSize', $event)"
            />
          </div>
          <div class="field">
            <label for="g-width">선 두께 {{ num('edgeWidth') }}</label>
            <input
              id="g-width"
              type="range"
              :min="GRAPH_RANGES.edgeWidth.min"
              :max="GRAPH_RANGES.edgeWidth.max"
              :step="GRAPH_RANGES.edgeWidth.step"
              :value="num('edgeWidth')"
              @change="setNum('edgeWidth', $event)"
            />
          </div>
        </div>
      </section>

      <div class="actions">
        <button
          type="button"
          class="btn"
          title="그래프의 색·크기·표시만 되돌립니다. 정렬(방향·간격), 노드 라벨, 보기 모드 테마는 그대로 둡니다"
          @click="
            set({
              background: undefined,
              showBoardName: undefined,
              nodeSize: undefined,
              doneColor: undefined,
              doneMark: undefined,
              showProgress: undefined,
              edgeColor: undefined,
              edgeHead: undefined,
              edgeHeadSize: undefined,
              edgeWidth: undefined,
            })
          "
        >
          그래프 기본값으로
        </button>
        <span style="flex: 1" />
        <button type="button" class="btn primary" @click="emit('close')">닫기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  /* 설정을 바꾸며 그래프를 볼 수 있게 화면을 가리지 않고 오른쪽에 붙인다 */
  place-items: start end;
  /* 작업 편집창 같은 모달보다는 아래에 둔다 */
  z-index: 40;
  background: transparent;
  pointer-events: none;
}
.dialog {
  width: min(340px, 100%);
  border: 1px solid var(--border);
  pointer-events: auto;
}
section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
section.first {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}
h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.seg {
  display: inline-flex;
  justify-self: start;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.seg button {
  padding: 5px 14px;
  border: 0;
  background: var(--surface);
  cursor: pointer;
}
.seg button.on {
  background: var(--accent);
  color: #fff;
}
.attrs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}
.attrs label {
  display: flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
input[type='range'] {
  width: 100%;
}
/* 색 슬롯과 같은 모양의 선택 칸 */
.slots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.slot {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-size: 15px;
  cursor: pointer;
}
.slot.on {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.done-dot {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: v-bind("style.doneColor ?? 'var(--ok)'");
  color: #fff;
  font-size: 13px;
  line-height: 1;
}
/* 켜고 끄는 슬라이드 토글 */
.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}
.switch {
  position: relative;
  flex: none;
  width: 40px;
  height: 22px;
  margin: 0;
  border-radius: 11px;
  background: var(--border);
  appearance: none;
  cursor: pointer;
  transition: background 0.15s;
}
.switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
  transition: transform 0.15s;
}
.switch:checked {
  background: var(--accent);
}
.switch:checked::after {
  transform: translateX(18px);
}
.switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
