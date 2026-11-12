<script setup lang="ts">
import { computed } from 'vue'
import {
  setGraphStyle,
  type BoardData,
  type DoneMark,
  type EdgeHead,
  type GraphDirection,
  type GraphStyle,
} from '../domain'
import { useBoardStore } from '../stores/board'
import ColorPicker from './ColorPicker.vue'

// 그래프 전체에 적용되는 표시 설정. 바꾸는 즉시 그래프에 반영되고 되돌리기(Ctrl+Z) 대상이다.
const props = defineProps<{ data: BoardData }>()
const emit = defineEmits<{ close: [] }>()
const store = useBoardStore()

const style = computed<GraphStyle>(() => props.data.board.settings.graph ?? {})
function set(patch: GraphStyle) {
  store.apply((d) => setGraphStyle(d, patch))
}

// 3×3 방향 판: 가운데는 비워 둔다.
const DIRECTION_GRID: ({ dir: GraphDirection; arrow: string; label: string } | null)[] = [
  { dir: 'up-left', arrow: '↖', label: '왼쪽 위로' },
  { dir: 'up', arrow: '↑', label: '위로' },
  { dir: 'up-right', arrow: '↗', label: '오른쪽 위로' },
  { dir: 'left', arrow: '←', label: '왼쪽으로' },
  null,
  { dir: 'right', arrow: '→', label: '오른쪽으로' },
  { dir: 'down-left', arrow: '↙', label: '왼쪽 아래로' },
  { dir: 'down', arrow: '↓', label: '아래로' },
  { dir: 'down-right', arrow: '↘', label: '오른쪽 아래로' },
]
const direction = computed(() => style.value.direction ?? 'down')

const MARKS: { value: DoneMark; label: string }[] = [
  { value: 'check', label: '✓ 체크' },
  { value: 'x', label: '✕ 엑스' },
  { value: 'star', label: '★ 별' },
  { value: 'dot', label: '● 점' },
  { value: 'none', label: '표시 없음' },
]
const HEADS: { value: EdgeHead; label: string }[] = [
  { value: 'arrow', label: '▶ 채운 화살표' },
  { value: 'open', label: '＞ 열린 화살표' },
  { value: 'dot', label: '● 점' },
  { value: 'none', label: '없음 (선만)' },
]
</script>

<template>
  <div class="overlay" @pointerdown.self="emit('close')">
    <div class="dialog" role="dialog" aria-label="그래프 설정">
      <h2>그래프 설정</h2>

      <div class="field">
        <span class="label">진행 방향 (슬롯이 이어지는 방향)</span>
        <div class="dir-grid">
          <template v-for="(d, i) in DIRECTION_GRID" :key="i">
            <button
              v-if="d"
              type="button"
              :class="{ on: direction === d.dir }"
              :title="d.label"
              :aria-label="d.label"
              @click="set({ direction: d.dir })"
            >
              {{ d.arrow }}
            </button>
            <span v-else class="center">●</span>
          </template>
        </div>
      </div>

      <div class="field">
        <span class="label">전체 배경 색</span>
        <ColorPicker :model-value="style.background" default-label="기본 배경" @update:model-value="(v) => set({ background: v })" />
      </div>

      <h3>완료된 노드</h3>
      <div class="field">
        <span class="label">색</span>
        <ColorPicker :model-value="style.doneColor" default-label="기본 초록" @update:model-value="(v) => set({ doneColor: v })" />
      </div>
      <div class="field">
        <label for="g-mark">표시 아이콘</label>
        <select
          id="g-mark"
          class="input"
          :value="style.doneMark ?? 'check'"
          @change="set({ doneMark: ($event.target as HTMLSelectElement).value as DoneMark })"
        >
          <option v-for="m in MARKS" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>

      <label class="check-row">
        <input
          type="checkbox"
          :checked="style.showProgress ?? true"
          @change="set({ showProgress: ($event.target as HTMLInputElement).checked })"
        />
        노드에 진행률 표시
      </label>

      <h3>연결 화살표</h3>
      <div class="field">
        <span class="label">색</span>
        <ColorPicker :model-value="style.edgeColor" default-label="기본 회색" @update:model-value="(v) => set({ edgeColor: v })" />
      </div>
      <div class="two">
        <div class="field">
          <label for="g-head">화살표 끝 모양</label>
          <select
            id="g-head"
            class="input"
            :value="style.edgeHead ?? 'arrow'"
            @change="set({ edgeHead: ($event.target as HTMLSelectElement).value as EdgeHead })"
          >
            <option v-for="h in HEADS" :key="h.value" :value="h.value">{{ h.label }}</option>
          </select>
        </div>
        <div class="field">
          <label for="g-width">선 두께 {{ style.edgeWidth ?? 1.5 }}</label>
          <input
            id="g-width"
            type="range"
            min="0.5"
            max="8"
            step="0.5"
            :value="style.edgeWidth ?? 1.5"
            @change="set({ edgeWidth: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
      </div>

      <div class="actions">
        <button
          type="button"
          class="btn"
          @click="
            set({
              direction: undefined,
              background: undefined,
              doneColor: undefined,
              doneMark: undefined,
              showProgress: undefined,
              edgeColor: undefined,
              edgeHead: undefined,
              edgeWidth: undefined,
            })
          "
        >
          기본값으로
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
h3 {
  margin: 16px 0 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  font-size: 14px;
}
.dir-grid {
  display: grid;
  grid-template-columns: repeat(3, 40px);
  gap: 4px;
}
.dir-grid button,
.dir-grid .center {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-size: 18px;
}
.dir-grid button {
  cursor: pointer;
}
.dir-grid button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.dir-grid .center {
  border-color: transparent;
  color: var(--text-dim);
  font-size: 10px;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.check-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  cursor: pointer;
}
</style>
