<script lang="ts">
import { ref } from 'vue'

type SettingsTab = 'theme' | 'graph' | 'node' | 'line' | 'layout'
// 패널을 닫았다 열어도 마지막에 보던 탭에서 이어지도록 컴포넌트 밖에 둔다.
const tab = ref<SettingsTab>('theme')
</script>

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
import { DOCK_LAYOUTS, FULL_LAYOUTS, defaultLayout, type EditLayout } from '../composables/editLayout'
import { useBoardStore } from '../stores/board'
import AlignControls from './AlignControls.vue'
import ColorPicker from './ColorPicker.vue'
import LabelGroupsEditor from './LabelGroupsEditor.vue'

// 보드의 모든 표시 설정. 범위별로 탭을 나눈다: 테마 / 그래프(표시·정렬) / 노드 / 라인.
// 바꾸는 즉시 반영되고 되돌리기(Ctrl+Z) 대상이다.
// layout: 수정 화면의 배치(이 기기에만 기억되는 값이라 보드 데이터가 아니다).
const props = defineProps<{ data: BoardData; layout: EditLayout }>()
const emit = defineEmits<{ close: []; aligned: []; 'update:layout': [value: EditLayout] }>()

const TABS: { id: SettingsTab; label: string; hint: string }[] = [
  { id: 'theme', label: '테마', hint: '보기 모드의 테마와 방식' },
  { id: 'graph', label: '그래프', hint: '그래프 표시 속성과 정렬' },
  { id: 'node', label: '노드', hint: '노드 크기·라벨·완료 표시' },
  { id: 'line', label: '라인', hint: '연결 화살표' },
  { id: 'layout', label: '레이아웃', hint: '수정 화면의 그래프·카드 배치' },
]
const LAYOUT_GROUPS = [
  { title: '그래프 위치', items: DOCK_LAYOUTS },
  { title: '한쪽만 보기', items: FULL_LAYOUTS },
]

// 탭마다 왼쪽 아래에 놓는 "기본값으로": 지금 탭의 내용만 되돌린다.
const RESET_HINT: Record<SettingsTab, string> = {
  theme: '테마, 방식, 표시 속성을 되돌립니다',
  graph: '배경 색, 보드 이름 표시, 간격을 되돌립니다. 정렬 방향은 그대로 둡니다',
  node: '노드 크기, 진행률 표시, 완료 색·표시를 되돌립니다. 노드 라벨은 그대로 둡니다',
  line: '연결 화살표의 색, 끝 모양, 끝 크기, 선 두께를 되돌립니다',
  layout: '화면 크기에 맞는 기본 배치로 되돌립니다',
}
function resetTab() {
  if (tab.value === 'theme') setList({ skin: undefined, flat: undefined, attrs: undefined })
  else if (tab.value === 'graph') {
    set({ background: undefined, showBoardName: undefined, slotGap: undefined, laneGap: undefined })
    emit('aligned')
  } else if (tab.value === 'node') set({ nodeSize: undefined, showProgress: undefined, doneColor: undefined, doneMark: undefined })
  else if (tab.value === 'line') set({ edgeColor: undefined, edgeHead: undefined, edgeHeadSize: undefined, edgeWidth: undefined })
  else emit('update:layout', defaultLayout())
}
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

      <div class="tabs" role="tablist" aria-label="설정 분류">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          role="tab"
          :class="{ on: tab === t.id }"
          :aria-selected="tab === t.id"
          :title="t.hint"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- 테마: 보기 모드 리스트의 테마와 방식 -->
      <div v-if="tab === 'theme'" role="tabpanel">
        <p class="muted intro">보기 모드의 리스트가 어떻게 보일지 정합니다.</p>
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
      </div>

      <!-- 그래프: 표시 속성과 정렬 -->
      <div v-else-if="tab === 'graph'" role="tabpanel">
        <h3>표시</h3>
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

        <section>
          <h3>정렬</h3>
          <AlignControls :data="data" @aligned="emit('aligned')" />
        </section>

      </div>

      <!-- 노드: 크기, 진행률, 라벨, 완료 표시 -->
      <div v-else-if="tab === 'node'" role="tabpanel">
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

      </div>

      <!-- 라인: 연결 화살표 -->
      <div v-else-if="tab === 'line'" role="tabpanel">
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

      </div>

      <!-- 레이아웃: 수정 화면에서 그래프와 카드를 놓는 방식 -->
      <div v-else role="tabpanel">
        <p class="muted intro">수정 화면에서 그래프와 카드를 어떻게 놓을지 고릅니다. 이 기기에 기억됩니다.</p>
        <div v-for="group in LAYOUT_GROUPS" :key="group.title" class="field">
          <span class="label">{{ group.title }}</span>
          <div class="slots" role="radiogroup" :aria-label="group.title">
            <button
              v-for="l in group.items"
              :key="l.value"
              type="button"
              role="radio"
              class="slot lay-slot"
              :class="{ on: layout === l.value }"
              :aria-checked="layout === l.value"
              :title="l.label"
              :aria-label="l.label"
              @click="emit('update:layout', l.value)"
            >
              <svg class="lay" viewBox="0 0 18 14" aria-hidden="true">
                <rect x="1" y="1" width="16" height="12" rx="2.5" />
                <rect v-if="l.fill" class="fill" v-bind="{ x: l.fill.x, y: l.fill.y, width: l.fill.w, height: l.fill.h }" rx="1" />
                <path v-else class="lines" d="M4.5 4.5h9M4.5 7h9M4.5 9.5h9" />
              </svg>
            </button>
          </div>
        </div>
        <p class="muted intro">그래프와 카드를 같이 볼 때는 둘 사이의 경계선을 끌어 크기를 바꿀 수 있습니다.</p>
      </div>

      <div class="actions">
        <button type="button" class="btn" :title="RESET_HINT[tab]" @click="resetTab">기본값으로</button>
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
/* 범위별 탭 */
.tabs {
  display: grid;
  grid-template-columns: repeat(5, auto);
  margin-bottom: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.tabs button {
  padding: 6px 4px;
  font-size: 13px;
  white-space: nowrap;
  border: 0;
  background: var(--surface);
  cursor: pointer;
}
.tabs button + button {
  border-left: 1px solid var(--border);
}
.tabs button.on {
  background: var(--accent);
  color: #fff;
  font-weight: 700;
}
.intro {
  margin: 0 0 12px;
  font-size: 12px;
}
/* 레이아웃 아이콘: 테두리 안에 그래프가 붙는 쪽을 칠해 보여 준다 */
.lay-slot {
  width: 44px;
  color: var(--text);
}
.lay-slot.on {
  color: var(--accent);
}
.lay {
  width: 24px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.lay .fill {
  fill: currentColor;
  stroke: none;
}
.lay .lines {
  stroke-width: 1.2;
  stroke-linecap: round;
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
