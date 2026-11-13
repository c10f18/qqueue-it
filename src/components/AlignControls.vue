<script setup lang="ts">
import { computed } from 'vue'
import { GRAPH_RANGES, setGraphStyle, type BoardData, type GraphDirection, type GraphStyle } from '../domain'
import { useBoardStore } from '../stores/board'

// 정렬(설정 패널의 "그래프" 탭 안): 방향 칸을 누르면 그 방향으로 노드를 한 번 정렬하고
// (화면 이동·회전·확대도 초기화) 간격을 조정한다.
const props = defineProps<{ data: BoardData }>()
const emit = defineEmits<{ aligned: [] }>()
const store = useBoardStore()

const style = computed<GraphStyle>(() => props.data.board.settings.graph ?? {})
const direction = computed(() => style.value.direction ?? 'down')
const slotGap = computed(() => style.value.slotGap ?? GRAPH_RANGES.slotGap.default)
const laneGap = computed(() => style.value.laneGap ?? GRAPH_RANGES.laneGap.default)

// 3×3 방향 판: 가운데는 노드 자리(누르는 칸이 아니다).
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
const currentArrow = computed(() => DIRECTION_GRID.find((d) => d?.dir === direction.value)?.arrow)

function align(dir: GraphDirection) {
  // 같은 방향이면 데이터는 그대로 두고(되돌리기 기록을 늘리지 않는다) 화면만 다시 맞춘다.
  if (dir !== direction.value) store.apply((d) => setGraphStyle(d, { direction: dir }))
  emit('aligned')
}
function setGap(key: 'slotGap' | 'laneGap', e: Event) {
  store.apply((d) => setGraphStyle(d, { [key]: Number((e.target as HTMLInputElement).value) }))
}
function resetGaps() {
  store.apply((d) => setGraphStyle(d, { slotGap: undefined, laneGap: undefined }))
  emit('aligned')
}
</script>

<template>
  <div class="align">
    <div class="top">
      <div class="dir-grid">
        <template v-for="(d, i) in DIRECTION_GRID" :key="i">
          <button
            v-if="d"
            type="button"
            :class="{ on: direction === d.dir }"
            :title="`${d.label} 정렬`"
            :aria-label="`${d.label} 정렬`"
            @click="align(d.dir)"
          >
            {{ d.arrow }}
          </button>
          <span v-else class="center" aria-hidden="true" />
        </template>
      </div>
      <div class="side">
        <span class="muted">방향을 누르면 그 방향으로 정렬하고 화면에 맞춥니다.</span>
        <button type="button" class="btn small" @click="align(direction)">{{ currentArrow }} 다시 정렬</button>
      </div>
    </div>

    <div class="field">
      <label for="a-slot">노드 간 간격 {{ slotGap }}</label>
      <input
        id="a-slot"
        type="range"
        :min="GRAPH_RANGES.slotGap.min"
        :max="GRAPH_RANGES.slotGap.max"
        :step="GRAPH_RANGES.slotGap.step"
        :value="slotGap"
        @change="setGap('slotGap', $event)"
      />
    </div>
    <div class="field">
      <label for="a-lane">레인 간 간격 {{ laneGap }}</label>
      <input
        id="a-lane"
        type="range"
        :min="GRAPH_RANGES.laneGap.min"
        :max="GRAPH_RANGES.laneGap.max"
        :step="GRAPH_RANGES.laneGap.step"
        :value="laneGap"
        @change="setGap('laneGap', $event)"
      />
    </div>
    <button type="button" class="btn small" @click="resetGaps">간격 기본값</button>
  </div>
</template>

<style scoped>
.top {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}
.side {
  display: grid;
  gap: 8px;
  justify-items: start;
  font-size: 12px;
}
input[type='range'] {
  width: 100%;
}
.dir-grid {
  display: grid;
  flex: none;
  grid-template-columns: repeat(3, 40px);
  gap: 4px;
}
.dir-grid button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-size: 18px;
  cursor: pointer;
}
.dir-grid button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
/* 가운데: 출발점 노드를 나타내는 동그라미 */
.dir-grid .center {
  place-self: center;
  width: 16px;
  height: 16px;
  border: 2px solid var(--text-dim);
  border-radius: 50%;
}
</style>
