<script setup lang="ts">
import { computed, ref } from 'vue'
import { isCompleted, sortedLanes, type BoardData, type TaskNode } from '../domain'
import { ATTR_LABELS, DEFAULT_ATTRS, type AttrKey } from '../composables/useNodeDisplay'
import { laneColor } from '../composables/laneColor'
import { SKIN_MODULES, type SkinId } from './skins'

const props = defineProps<{ data: BoardData }>()

const flat = ref(false)
const skin = ref<SkinId>('simple')
const attrs = ref<AttrKey[]>([...DEFAULT_ATTRS])
const attrKeys = Object.keys(ATTR_LABELS) as AttrKey[]

const skinModule = computed(() => SKIN_MODULES[skin.value])
// 선택 순서와 상관없이 항상 같은 순서로 표시한다.
const orderedAttrs = computed(() => attrKeys.filter((k) => attrs.value.includes(k)))

const allLanes = computed(() => sortedLanes(props.data))
const lanes = computed(() => allLanes.value.filter((l) => l.active))
const laneIds = computed(() => new Set(lanes.value.map((l) => l.id)))
function laneStyle(laneId: string) {
  return { '--lane': laneColor(allLanes.value.findIndex((l) => l.id === laneId)) }
}

type Row =
  | { type: 'slot'; slotId: string; number: number; nodes: TaskNode[] }
  | { type: 'fold'; key: string; count: number }

// FR-79: 비활성 카테고리·비표시 노드는 숨기고, 숨겨진 셀만 남은 슬롯은 접어서 표시한다.
const rows = computed<Row[]>(() => {
  const result: Row[] = []
  props.data.board.slotOrder.forEach((slotId, i) => {
    const inSlot = props.data.nodes.filter((n) => n.slotId === slotId)
    const shown = inSlot.filter((n) => n.visible && laneIds.value.has(n.laneId))
    if (shown.length > 0) {
      result.push({ type: 'slot', slotId, number: i + 1, nodes: shown })
    } else if (inSlot.length > 0) {
      const last = result.at(-1)
      if (last?.type === 'fold') last.count++
      else result.push({ type: 'fold', key: slotId, count: 1 })
    }
  })
  return result
})

const shownNodes = computed(() => props.data.nodes.filter((n) => n.visible && laneIds.value.has(n.laneId)))
const doneCount = computed(() => shownNodes.value.filter(isCompleted).length)

function nodeIn(row: Extract<Row, { type: 'slot' }>, laneId: string) {
  return row.nodes.find((n) => n.laneId === laneId)
}
const gridStyle = computed(() => ({
  gridTemplateColumns: `36px repeat(${Math.max(lanes.value.length, 1)}, minmax(160px, 1fr))`,
}))
const showNumbers = computed(() => props.data.board.settings.showSlotNumbers)
</script>

<template>
  <div class="list-view">
    <div class="controls">
      <div class="seg-toggle" role="group" aria-label="목록 방식">
        <button :class="{ on: !flat }" @click="flat = false">레이어별</button>
        <button :class="{ on: flat }" @click="flat = true">플랫</button>
      </div>

      <label class="skin">
        스킨
        <select v-model="skin" class="input">
          <option v-for="(m, id) in SKIN_MODULES" :key="id" :value="id">{{ m.label }}</option>
        </select>
      </label>

      <details class="attr-picker">
        <summary class="btn">표시 속성 ({{ attrs.length }})</summary>
        <div class="attr-list">
          <label v-for="k in attrKeys" :key="k">
            <input v-model="attrs" type="checkbox" :value="k" /> {{ ATTR_LABELS[k] }}
          </label>
        </div>
      </details>

      <span class="muted summary">{{ doneCount }} / {{ shownNodes.length }} 완료</span>
    </div>

    <p v-if="rows.length === 0" class="empty muted">표시할 작업이 없습니다. 수정 모드에서 작업을 추가해 보세요.</p>

    <!-- 레이어별: 슬롯 × 레인 그리드 -->
    <div v-else-if="!flat" class="scroll">
      <div class="grid head" :style="gridStyle">
        <div />
        <div v-for="l in lanes" :key="l.id" class="lane-title" :style="laneStyle(l.id)">{{ l.name }}</div>
      </div>
      <template v-for="row in rows" :key="row.type === 'slot' ? row.slotId : row.key">
        <div v-if="row.type === 'slot'" class="grid" :style="gridStyle">
          <div class="num">{{ showNumbers ? row.number : '' }}</div>
          <div v-for="l in lanes" :key="l.id" class="cell" :style="laneStyle(l.id)">
            <component
              :is="skinModule.Cell"
              v-if="nodeIn(row, l.id)"
              :node="nodeIn(row, l.id)!"
              :visible-attrs="orderedAttrs"
            />
          </div>
        </div>
        <div v-else class="fold">⋯ 숨겨진 슬롯 {{ row.count }}개</div>
      </template>
    </div>

    <!-- 플랫: 슬롯당 한 행, 노드는 칩으로 병합 -->
    <ol v-else class="flat">
      <template v-for="row in rows" :key="row.type === 'slot' ? row.slotId : row.key">
        <li v-if="row.type === 'slot'" :class="{ 'slot-done': row.nodes.every(isCompleted) }">
          <span class="num">{{ showNumbers ? row.number : '' }}</span>
          <span class="chips">
            <component
              :is="skinModule.Chip"
              v-for="n in row.nodes"
              :key="n.id"
              :node="n"
              :visible-attrs="orderedAttrs"
              :style="laneStyle(n.laneId)"
            />
          </span>
          <span v-if="row.nodes.every(isCompleted)" class="ok" title="슬롯 완료">✓</span>
        </li>
        <li v-else class="fold">⋯ 숨겨진 슬롯 {{ row.count }}개</li>
      </template>
    </ol>
  </div>
</template>

<style scoped>
.list-view {
  height: 100%;
  overflow: auto;
  padding: 12px;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}
.seg-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.seg-toggle button {
  padding: 6px 14px;
  border: 0;
  background: var(--surface);
  cursor: pointer;
}
.seg-toggle button.on {
  background: var(--accent);
  color: #fff;
}
.skin {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.skin .input {
  width: auto;
}
.attr-picker {
  position: relative;
}
.attr-picker summary {
  list-style: none;
}
.attr-list {
  position: absolute;
  z-index: 10;
  display: grid;
  gap: 4px;
  min-width: 150px;
  margin-top: 4px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.attr-list label {
  display: flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
}
.summary {
  margin-left: auto;
}
.empty {
  padding: 40px 0;
  text-align: center;
}
.scroll {
  overflow-x: auto;
}
.grid {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
  min-width: max-content;
}
.head {
  position: sticky;
  top: 0;
  background: var(--bg);
}
.lane-title {
  padding: 4px 8px;
  border-top: 3px solid var(--lane);
  font-weight: 700;
}
.num {
  padding-top: 8px;
  color: var(--text-dim);
  text-align: center;
  font-size: 12px;
}
.fold {
  margin: 0 0 8px 36px;
  color: var(--text-dim);
  font-size: 12px;
  list-style: none;
}
.flat {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.flat li:not(.fold) {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 8px;
  align-items: center;
}
.flat .num {
  padding: 0;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ok {
  color: var(--ok);
  font-weight: 700;
}
</style>
