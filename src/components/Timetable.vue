<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  addLane,
  bulkProgress,
  deleteLane,
  deleteNode,
  dropOnBoundary,
  dropOnCell,
  duplicateNode,
  insertNodeBeside,
  moveSlot,
  renameLane,
  reorderLane,
  resetAllProgress,
  resetLaneProgress,
  setLinkFilter,
  sortedLanes,
  toggleLaneActive,
  updateNode,
  createNode,
  MAX_LANES,
  type BoardData,
  type DeleteLaneMode,
  type NodePatch,
} from '../domain'
import { useBoardStore } from '../stores/board'
import { useTimetableDrag, type DropTarget } from '../composables/useTimetableDrag'
import { laneColor } from '../composables/laneColor'
import BulkProgressDialog from './BulkProgressDialog.vue'
import DeleteLaneDialog from './DeleteLaneDialog.vue'
import LaneHeader from './LaneHeader.vue'
import NodeCard from './NodeCard.vue'
import NodeContextMenu from './NodeContextMenu.vue'
import NodeEditor from './NodeEditor.vue'

const props = defineProps<{ data: BoardData; bulkOpen: boolean }>()
const emit = defineEmits<{ 'update:bulkOpen': [open: boolean] }>()

const store = useBoardStore()

const allLanes = computed(() => sortedLanes(props.data))
const lanes = computed(() => allLanes.value.filter((l) => l.active))
const slotIds = computed(() => props.data.board.slotOrder)

const cellMap = computed(() => {
  const m = new Map<string, string>() // `${slotId}|${laneId}` → nodeId
  for (const n of props.data.nodes) m.set(`${n.slotId}|${n.laneId}`, n.id)
  return m
})
const nodeById = computed(() => new Map(props.data.nodes.map((n) => [n.id, n])))
function nodeAt(slotId: string, laneId: string) {
  const id = cellMap.value.get(`${slotId}|${laneId}`)
  return id ? nodeById.value.get(id) : undefined
}

const gridStyle = computed(() => ({
  gridTemplateColumns: `44px repeat(${Math.max(lanes.value.length, 1)}, minmax(180px, 1fr)) 40px`,
}))
function laneStyle(laneId: string) {
  const idx = allLanes.value.findIndex((l) => l.id === laneId)
  return { '--lane': laneColor(idx) }
}

// ── 편집 상태 ─────────────────────────────────────────────
const editingNodeId = ref<string | null>(null)
const newLaneId = ref<string | null>(null)
const editorNodeId = ref<string | null>(null)
const menu = ref<{ nodeId: string; x: number; y: number } | null>(null)
const deleteLaneId = ref<string | null>(null)

const editorNode = computed(() => (editorNodeId.value ? nodeById.value.get(editorNodeId.value) : undefined))
const menuNode = computed(() => (menu.value ? nodeById.value.get(menu.value.nodeId) : undefined))
const deleteLaneTarget = computed(() => allLanes.value.find((l) => l.id === deleteLaneId.value))

// ── 드래그 ────────────────────────────────────────────────
const scroller = ref<HTMLElement | null>(null)
const { drag, startNode, startSlot, startLane } = useTimetableDrag(() => scroller.value, {
  dropNode(nodeId, target: DropTarget) {
    if (target.kind === 'cell') store.apply((d) => dropOnCell(d, nodeId, target.slotId, target.laneId))
    else store.apply((d) => dropOnBoundary(d, nodeId, target.afterSlotId, target.laneId))
  },
  moveSlot(slotId, toIndex) {
    store.apply((d) => moveSlot(d, slotId, toIndex))
  },
  moveLane(laneId, visibleIndex) {
    // 보이는 열 기준 위치 → 전체 열(비활성 포함) 기준 위치로 변환
    const rest = allLanes.value.filter((l) => l.id !== laneId)
    const restVisible = rest.filter((l) => l.active)
    const toIndex =
      visibleIndex < restVisible.length
        ? rest.indexOf(restVisible[visibleIndex])
        : rest.indexOf(restVisible[restVisible.length - 1]) + 1
    store.apply((d) => reorderLane(d, laneId, toIndex))
  },
})

const draggedNode = computed(() => (drag.kind === 'node' && drag.id ? nodeById.value.get(drag.id) : undefined))

function cellState(slotId: string, laneId: string) {
  const t = drag.target
  if (!draggedNode.value || t?.kind !== 'cell' || t.slotId !== slotId || t.laneId !== laneId) return ''
  if (draggedNode.value.slotId === slotId && draggedNode.value.laneId === laneId) return 'self'
  return draggedNode.value.laneId === laneId ? 'drop' : 'drop lane-change'
}
function boundaryState(afterSlotId: string | null, laneId: string) {
  const t = drag.target
  if (!draggedNode.value || t?.kind !== 'boundary') return ''
  if (t.afterSlotId !== afterSlotId || t.laneId !== laneId) return ''
  return draggedNode.value.laneId === laneId ? 'drop' : 'drop lane-change'
}
function slotMark(slotId: string): '' | 'before' | 'after' {
  if (drag.kind !== 'slot' || drag.index === null) return ''
  const rest = slotIds.value.filter((id) => id !== drag.id)
  if (rest[drag.index] === slotId) return 'before'
  if (drag.index === rest.length && rest[rest.length - 1] === slotId) return 'after'
  return ''
}
function laneMark(laneId: string): '' | 'before' | 'after' {
  if (drag.kind !== 'lane' || drag.index === null) return ''
  const rest = lanes.value.filter((l) => l.id !== drag.id)
  if (rest[drag.index]?.id === laneId) return 'before'
  if (drag.index === rest.length && rest[rest.length - 1]?.id === laneId) return 'after'
  return ''
}

// ── 노드 동작 ─────────────────────────────────────────────
function createInCell(slotId: string, laneId: string) {
  const id = store.apply((d) => createNode(d, slotId, laneId))
  if (id) editingNodeId.value = id
}
function addBeside(nodeId: string, position: 'above' | 'below') {
  menu.value = null
  const id = store.apply((d) => insertNodeBeside(d, nodeId, position))
  if (id) editingNodeId.value = id
}
function patchNode(nodeId: string, patch: NodePatch) {
  store.apply((d) => updateNode(d, nodeId, patch))
}
function removeNode(nodeId: string) {
  menu.value = null
  editorNodeId.value = null
  store.apply((d) => deleteNode(d, nodeId))
}
function copyNode(nodeId: string) {
  menu.value = null
  editorNodeId.value = null
  store.apply((d) => duplicateNode(d, nodeId))
}
function saveEditor(patch: NodePatch) {
  const id = editorNodeId.value
  if (!id) return
  // 오류(태그 초과 등)가 나면 apply가 undefined를 돌려주고 에디터는 열린 채 유지된다.
  const before = store.current
  store.apply((d) => updateNode(d, id, patch))
  if (store.current !== before) editorNodeId.value = null
}
function openMenu(nodeId: string, e: MouseEvent) {
  menu.value = { nodeId, x: e.clientX, y: e.clientY }
}

// ── 카테고리 동작 ─────────────────────────────────────────
function addLaneAction() {
  const taken = new Set(props.data.lanes.map((l) => l.name))
  let n = props.data.lanes.length + 1
  while (taken.has(`카테고리 ${n}`)) n++
  const id = store.apply((d) => addLane(d, `카테고리 ${n}`))
  if (id) newLaneId.value = id
}
function confirmDeleteLane(mode: DeleteLaneMode, target?: string) {
  const id = deleteLaneId.value
  deleteLaneId.value = null
  if (id) store.apply((d) => deleteLane(d, id, mode, target))
}
function laneNodeCount(laneId: string) {
  return props.data.nodes.filter((n) => n.laneId === laneId).length
}

function applyBulk(upTo: string, laneIds: string[]) {
  emit('update:bulkOpen', false)
  store.apply((d) => bulkProgress(d, upTo, laneIds))
}
function resetAll() {
  emit('update:bulkOpen', false)
  store.apply((d) => resetAllProgress(d))
}
</script>

<template>
  <div ref="scroller" class="tt-scroll" :class="{ 'node-dragging': drag.active && drag.kind === 'node' }">
    <div class="tt">
      <!-- 헤더: 카테고리(열) -->
      <div class="tt-head" :style="gridStyle">
        <div class="corner" />
        <div
          v-for="lane in lanes"
          :key="lane.id"
          class="head-cell"
          :class="[laneMark(lane.id) && `mark-${laneMark(lane.id)}`]"
          :style="laneStyle(lane.id)"
          :data-lane-head="lane.id"
        >
          <LaneHeader
            :lane="lane"
            :can-delete="allLanes.length > 1"
            :dragging="drag.active && drag.kind === 'lane' && drag.id === lane.id"
            :start-editing="newLaneId === lane.id"
            @rename="(name) => store.apply((d) => renameLane(d, lane.id, name))"
            @toggle="store.apply((d) => toggleLaneActive(d, lane.id))"
            @remove="deleteLaneId = lane.id"
            @reset-progress="store.apply((d) => resetLaneProgress(d, lane.id))"
            @drag-start="(e) => startLane(e, lane.id, lane.name)"
          />
        </div>
        <div v-if="lanes.length === 0" class="head-cell muted">표시 중인 카테고리가 없습니다</div>
        <button
          class="add-lane"
          :disabled="allLanes.length >= MAX_LANES"
          :title="allLanes.length >= MAX_LANES ? `카테고리는 최대 ${MAX_LANES}개` : '카테고리 추가'"
          @click="addLaneAction"
        >
          +
        </button>
      </div>

      <!-- 맨 앞 경계 + 슬롯 행들 -->
      <div class="tt-boundary" :style="gridStyle">
        <div />
        <div
          v-for="lane in lanes"
          :key="lane.id"
          class="seg"
          :class="boundaryState(null, lane.id)"
          :style="laneStyle(lane.id)"
          data-boundary
          data-after=""
          :data-lane="lane.id"
        />
      </div>

      <template v-for="(slotId, i) in slotIds" :key="slotId">
        <div
          class="tt-row"
          :class="[slotMark(slotId) && `mark-${slotMark(slotId)}`, { 'row-dragging': drag.kind === 'slot' && drag.id === slotId }]"
          :style="gridStyle"
          :data-row-slot="slotId"
        >
          <div class="handle" title="끌어서 슬롯(행) 전체 이동" @pointerdown="startSlot($event, slotId, `${i + 1}번 슬롯`)">
            <span class="grip">⠿</span>
            <span v-if="data.board.settings.showSlotNumbers" class="num">{{ i + 1 }}</span>
          </div>

          <div
            v-for="lane in lanes"
            :key="lane.id"
            class="cell"
            :class="cellState(slotId, lane.id)"
            :style="laneStyle(lane.id)"
            data-cell
            :data-slot="slotId"
            :data-lane="lane.id"
          >
            <NodeCard
              v-if="nodeAt(slotId, lane.id)"
              :node="nodeAt(slotId, lane.id)!"
              :editing="editingNodeId === nodeAt(slotId, lane.id)!.id"
              :dragging="drag.active && drag.id === nodeAt(slotId, lane.id)!.id"
              @open="editorNodeId = nodeAt(slotId, lane.id)!.id"
              @menu="(e) => openMenu(nodeAt(slotId, lane.id)!.id, e)"
              @add-below="addBeside(nodeAt(slotId, lane.id)!.id, 'below')"
              @rename="(name) => patchNode(nodeAt(slotId, lane.id)!.id, { name })"
              @stop-edit="editingNodeId = null"
              @toggle-done="patchNode(nodeAt(slotId, lane.id)!.id, { progress: nodeAt(slotId, lane.id)!.progress === 100 ? 0 : 100 })"
              @count="(delta) => patchNode(nodeAt(slotId, lane.id)!.id, { count: nodeAt(slotId, lane.id)!.count + delta })"
              @drag-start="(e) => startNode(e, nodeAt(slotId, lane.id)!.id, nodeAt(slotId, lane.id)!.name)"
            />
            <button v-else class="empty-add" title="여기에 작업 추가" @click="createInCell(slotId, lane.id)">+</button>
          </div>
        </div>

        <div class="tt-boundary" :style="gridStyle">
          <div />
          <div
            v-for="lane in lanes"
            :key="lane.id"
            class="seg"
            :class="boundaryState(slotId, lane.id)"
            :style="laneStyle(lane.id)"
            data-boundary
            :data-after="slotId"
            :data-lane="lane.id"
          />
        </div>
      </template>
    </div>

    <!-- 드래그 고스트 -->
    <div v-if="drag.active && drag.kind" class="ghost" :style="{ left: drag.x + 12 + 'px', top: drag.y + 12 + 'px' }">
      {{ drag.label }}
    </div>
  </div>

  <NodeContextMenu
    v-if="menu && menuNode"
    :node="menuNode"
    :lanes="allLanes"
    :x="menu.x"
    :y="menu.y"
    @close="menu = null"
    @add-above="addBeside(menu.nodeId, 'above')"
    @add-below="addBeside(menu.nodeId, 'below')"
    @duplicate="copyNode(menu.nodeId)"
    @remove="removeNode(menu.nodeId)"
    @link-filter="(excluded) => store.apply((d) => setLinkFilter(d, menu!.nodeId, excluded))"
  />

  <NodeEditor
    v-if="editorNode"
    :key="editorNode.id"
    :node="editorNode"
    :lane="allLanes.find((l) => l.id === editorNode!.laneId)"
    @save="saveEditor"
    @duplicate="copyNode(editorNode.id)"
    @remove="removeNode(editorNode.id)"
    @close="editorNodeId = null"
  />

  <DeleteLaneDialog
    v-if="deleteLaneTarget"
    :lane="deleteLaneTarget"
    :others="allLanes.filter((l) => l.id !== deleteLaneTarget!.id)"
    :node-count="laneNodeCount(deleteLaneTarget.id)"
    @confirm="confirmDeleteLane"
    @close="deleteLaneId = null"
  />

  <BulkProgressDialog
    v-if="bulkOpen"
    :data="data"
    @apply="applyBulk"
    @reset-all="resetAll"
    @close="emit('update:bulkOpen', false)"
  />
</template>

<style scoped>
.tt-scroll {
  position: relative;
  height: 100%;
  overflow: auto;
  padding: 0 12px 80px;
}
.tt {
  min-width: max-content;
  width: 100%;
}
.tt-head,
.tt-row,
.tt-boundary {
  display: grid;
  column-gap: 8px;
}
.tt-head {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 10px 0 6px;
  background: var(--bg);
}
.head-cell {
  position: relative;
  min-width: 0;
}
.mark-before::before,
.mark-after::after {
  content: '';
  position: absolute;
  z-index: 6;
  background: var(--accent);
  pointer-events: none;
}
.head-cell.mark-before::before {
  left: -6px;
  top: 0;
  bottom: 0;
  width: 3px;
}
.head-cell.mark-after::after {
  right: -6px;
  top: 0;
  bottom: 0;
  width: 3px;
}
.add-lane {
  align-self: center;
  width: 32px;
  height: 32px;
  border: 1px dashed var(--border);
  border-radius: 50%;
  background: transparent;
  color: var(--text-dim);
  font-size: 18px;
  cursor: pointer;
}
.add-lane:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.add-lane:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tt-row {
  position: relative;
  align-items: stretch;
}
.tt-row.row-dragging {
  opacity: 0.4;
}
.tt-row.mark-before::before,
.tt-row.mark-after::after {
  left: 0;
  right: 0;
  height: 3px;
}
.tt-row.mark-before::before {
  top: -5px;
}
.tt-row.mark-after::after {
  bottom: -5px;
}
.handle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-dim);
  font-size: 12px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.cell {
  position: relative;
  min-height: 60px;
  padding: 2px 0;
  border-radius: 8px;
}
.cell.drop {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  outline: 2px solid var(--accent);
}
.cell.drop.lane-change {
  background: color-mix(in srgb, #f59e0b 20%, transparent);
  outline: 2px dashed #f59e0b;
}
.cell.self {
  outline: 2px dotted var(--text-dim);
}
.empty-add {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  min-height: 56px;
  border: 1px dashed transparent;
  border-radius: 8px;
  background: transparent;
  color: transparent;
  font-size: 20px;
  cursor: pointer;
}
.cell:hover .empty-add,
.empty-add:focus-visible {
  border-color: var(--border);
  color: var(--text-dim);
}
@media (hover: none) {
  .empty-add {
    border-color: var(--border);
    color: var(--text-dim);
  }
}

.tt-boundary {
  height: 12px;
}
.seg {
  position: relative;
  height: 12px;
  border-radius: 6px;
}
.node-dragging .seg::before {
  content: '';
  position: absolute;
  inset: -8px 0;
}
.seg.drop {
  background: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
}
.seg.drop.lane-change {
  background: #f59e0b;
  box-shadow: 0 0 0 2px #f59e0b;
}

.ghost {
  position: fixed;
  z-index: 100;
  max-width: 220px;
  padding: 6px 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  box-shadow: var(--shadow);
  pointer-events: none;
}
</style>
