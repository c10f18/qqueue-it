<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AlignDialog from '../components/AlignDialog.vue'
import GraphSettingsDialog from '../components/GraphSettingsDialog.vue'
import ListView from '../components/ListView.vue'
import QueueGraph from '../components/QueueGraph.vue'
import Timetable from '../components/Timetable.vue'
import { navigate } from '../composables/useRoute'
import { renameBoard, sortedLanes, toggleLaneActive } from '../domain'
import { useBoardStore } from '../stores/board'

const props = defineProps<{ boardId: string; mode: 'edit' | 'view' }>()
const store = useBoardStore()

const missing = ref(false)
const bulkOpen = ref(false)
const renaming = ref(false)
// 오른쪽에 붙는 패널은 한 번에 하나만 연다. 패널 밖을 누르면 닫힌다.
const panel = ref<'settings' | 'align' | null>(null)
// 정렬을 누를 때마다 올려서 그래프가 화면을 다시 맞추게 한다.
const fitTick = ref(0)
const viewTab = ref<'list' | 'graph'>('list')
const nameDraft = ref('')

watch(
  () => props.boardId,
  async (id) => {
    missing.value = !(await store.openBoard(id))
  },
  { immediate: true },
)

const data = computed(() => (store.current?.board.id === props.boardId ? store.current : null))
const lanes = computed(() => (data.value ? sortedLanes(data.value) : []))
const inactiveLanes = computed(() => lanes.value.filter((l) => !l.active))

function startRename() {
  if (!data.value || props.mode !== 'edit') return
  nameDraft.value = data.value.board.name
  renaming.value = true
}
function commitRename() {
  if (!renaming.value) return
  renaming.value = false
  if (nameDraft.value.trim()) store.apply((d) => renameBoard(d, nameDraft.value))
}

// ── 저장: 수정 모드에서는 "저장"을 눌러야 저장된다 ─────────────
watch(
  () => props.mode,
  (mode) => {
    store.setAutosave(mode !== 'edit')
    renaming.value = false
  },
  { immediate: true },
)
const leaveOpen = ref(false)
async function saveAndClose() {
  await store.save()
  navigate({ name: 'view', boardId: props.boardId })
}
/** 수정 모드에서 목록으로 나가기: 저장하지 않은 변경이 있으면 먼저 묻는다. */
function leaveToList() {
  if (store.dirty) leaveOpen.value = true
  else navigate({ name: 'list' })
}
async function leave(keep: boolean) {
  leaveOpen.value = false
  if (keep) await store.save()
  else await store.discard()
  navigate({ name: 'list' })
}
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (store.dirty) e.preventDefault()
}

// ── 패널 밖을 누르면 닫는다 ────────────────────────────────
function onDocDown(e: PointerEvent) {
  if (!panel.value) return
  const target = e.target as HTMLElement
  if (target.closest('.side-panel .dialog, [data-panel-toggle]')) return
  panel.value = null
}
function togglePanel(name: 'settings' | 'align') {
  panel.value = panel.value === name ? null : name
}

// ── 수정 모드 레이아웃: 그래프와 카드(타임테이블)를 어떻게 놓을지 ──
type EditLayout = 'rows' | 'cols' | 'cards' | 'graph'
const LAYOUTS: { value: EditLayout; label: string }[] = [
  { value: 'rows', label: '위: 그래프 / 아래: 카드' },
  { value: 'cols', label: '왼쪽: 그래프 / 오른쪽: 카드' },
  { value: 'cards', label: '카드만' },
  { value: 'graph', label: '그래프만' },
]
const PREF_KEY = 'qqueue.editLayout'
function defaultLayout(): EditLayout {
  if (!window.matchMedia('(min-width: 640px)').matches) return 'cards'
  return window.matchMedia('(orientation: landscape)').matches ? 'rows' : 'cols'
}
const layout = ref<EditLayout>(defaultLayout())
/** 나눠 보는 레이아웃에서 그래프 영역이 차지하는 비율 */
const ratio = ref(0.4)
try {
  const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null')
  if (saved && LAYOUTS.some((l) => l.value === saved.layout)) layout.value = saved.layout
  if (saved && typeof saved.ratio === 'number') ratio.value = Math.min(0.85, Math.max(0.15, saved.ratio))
} catch {
  // 저장소를 못 쓰면 기본 레이아웃으로 시작한다.
}
watch([layout, ratio], () => {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ layout: layout.value, ratio: ratio.value }))
  } catch {
    // 기억하지 못해도 동작에는 지장이 없다.
  }
})
const split = computed(() => layout.value === 'rows' || layout.value === 'cols')

const body = ref<HTMLElement | null>(null)
const resizing = ref(false)
function resizeStart(e: PointerEvent) {
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    // 붙잡지 못해도 경계 위에서는 끌 수 있다.
  }
  resizing.value = true
}
function resizeMove(e: PointerEvent) {
  if (!resizing.value || !body.value) return
  const rect = body.value.getBoundingClientRect()
  const value = layout.value === 'rows' ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width
  ratio.value = Math.min(0.85, Math.max(0.15, value))
}
function resizeKey(e: KeyboardEvent) {
  const back = layout.value === 'rows' ? 'ArrowUp' : 'ArrowLeft'
  const forward = layout.value === 'rows' ? 'ArrowDown' : 'ArrowRight'
  const delta = e.key === back ? -0.05 : e.key === forward ? 0.05 : 0
  if (!delta) return
  e.preventDefault()
  ratio.value = Math.min(0.85, Math.max(0.15, ratio.value + delta))
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocDown, true)
  window.addEventListener('beforeunload', onBeforeUnload)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocDown, true)
  window.removeEventListener('beforeunload', onBeforeUnload)
  // 다른 화면으로 넘어가면 밀린 변경을 저장하고 자동 저장으로 돌아간다.
  store.setAutosave(true)
})
</script>

<template>
  <div v-if="missing" class="missing">
    <p>보드를 찾을 수 없습니다.</p>
    <a class="btn" href="#/">목록으로</a>
  </div>

  <div v-else-if="data" class="board-page">
    <div class="toolbar">
      <button v-if="mode === 'edit'" class="btn ghost" title="보드 목록" @click="leaveToList">←</button>
      <a v-else class="btn ghost" href="#/" title="보드 목록">←</a>

      <input
        v-if="renaming"
        v-model="nameDraft"
        class="input title-input"
        maxlength="60"
        autofocus
        @keydown.enter.prevent="commitRename"
        @keydown.esc.prevent="renaming = false"
        @blur="commitRename"
      />
      <h1
        v-else
        class="title"
        :class="{ editable: mode === 'edit' }"
        :title="mode === 'edit' ? '클릭하여 이름 수정' : undefined"
        @click="startRename"
      >
        {{ data.board.name }}
      </h1>

      <button v-if="mode === 'view'" class="btn edit-btn" title="수정 모드로 들어가기" @click="navigate({ name: 'edit', boardId })">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M11.3 1.7a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L5.6 13.4l-3.7.8.8-3.7z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path d="M9.8 3.2l3 3" stroke="currentColor" stroke-width="1.4" />
        </svg>
        수정
      </button>
      <span v-else class="chip mode-chip">수정 중</span>

      <button class="btn" data-panel-toggle title="노드를 방향에 맞춰 정렬하고 간격을 조정" @click="togglePanel('align')">정렬</button>
      <button class="btn" data-panel-toggle title="노드·라벨·완료 표시·화살표·배경" @click="togglePanel('settings')">⚙ 설정</button>

      <template v-if="mode === 'edit'">
        <button class="btn" :disabled="!store.canUndo" title="되돌리기 (Ctrl+Z)" @click="store.undo()">↶</button>
        <button class="btn" :disabled="!store.canRedo" title="다시 실행 (Ctrl+Shift+Z)" @click="store.redo()">↷</button>
        <button class="btn" @click="bulkOpen = true">일괄 진행</button>

        <div class="layout-pick" role="radiogroup" aria-label="레이아웃">
          <button
            v-for="l in LAYOUTS"
            :key="l.value"
            type="button"
            role="radio"
            :class="{ on: layout === l.value }"
            :aria-checked="layout === l.value"
            :title="l.label"
            :aria-label="l.label"
            @click="layout = l.value"
          >
            <span class="lay" :class="l.value"><i /><i /></span>
          </button>
        </div>

        <span v-if="inactiveLanes.length" class="inactive">
          <span class="muted">숨긴 카테고리</span>
          <button
            v-for="l in inactiveLanes"
            :key="l.id"
            class="chip"
            title="다시 보이기"
            @click="store.apply((d) => toggleLaneActive(d, l.id))"
          >
            🚫 {{ l.name }}
          </button>
        </span>

        <span class="spacer" />
        <span v-if="store.dirty" class="unsaved" role="status">● 저장 안 됨</span>
        <button class="btn" :disabled="!store.dirty" @click="store.save()">저장</button>
        <button class="btn primary" @click="saveAndClose">저장 및 닫기</button>
      </template>
    </div>

    <!-- 수정 모드: 고른 레이아웃대로 그래프와 카드를 놓는다. 나눠 볼 때는 경계를 끌어 비율을 바꾼다. -->
    <div v-if="mode === 'edit'" ref="body" class="body edit-layout" :class="[layout, { resizing }]">
      <section v-if="layout !== 'cards'" class="graph-pane" :style="split ? { flexBasis: ratio * 100 + '%' } : undefined">
        <QueueGraph :data="data" :fit-tick="fitTick" />
      </section>
      <div
        v-if="split"
        class="splitter"
        role="separator"
        tabindex="0"
        :aria-orientation="layout === 'rows' ? 'horizontal' : 'vertical'"
        :aria-valuenow="Math.round(ratio * 100)"
        aria-valuemin="15"
        aria-valuemax="85"
        aria-label="그래프와 카드 영역 크기 조절"
        title="끌어서 영역 크기 조절"
        @pointerdown.prevent="resizeStart"
        @pointermove="resizeMove"
        @pointerup="resizing = false"
        @pointercancel="resizing = false"
        @keydown="resizeKey"
      />
      <section v-if="layout !== 'graph'" class="timetable-pane">
        <Timetable v-model:bulk-open="bulkOpen" :data="data" />
      </section>
    </div>

    <div v-else class="body view-layout">
      <div class="view-tabs" role="tablist">
        <button role="tab" :class="{ on: viewTab === 'list' }" @click="viewTab = 'list'">리스트</button>
        <button role="tab" :class="{ on: viewTab === 'graph' }" @click="viewTab = 'graph'">큐 그래프</button>
      </div>
      <div class="view-body">
        <ListView v-if="viewTab === 'list'" :data="data" />
        <QueueGraph v-else :data="data" :fit-tick="fitTick" />
      </div>
    </div>

    <GraphSettingsDialog v-if="panel === 'settings'" :data="data" @close="panel = null" />
    <AlignDialog v-else-if="panel === 'align'" :data="data" @aligned="fitTick++" @close="panel = null" />

    <div v-if="leaveOpen" class="overlay" @pointerdown.self="leaveOpen = false">
      <div class="dialog" role="alertdialog" aria-label="저장하지 않은 변경">
        <h2>저장하지 않은 변경이 있습니다</h2>
        <p class="muted">저장하지 않고 나가면 마지막으로 저장한 뒤의 변경이 사라집니다.</p>
        <div class="actions">
          <button class="btn" @click="leaveOpen = false">취소</button>
          <span style="flex: 1" />
          <button class="btn danger" @click="leave(false)">저장 안 하고 나가기</button>
          <button class="btn primary" @click="leave(true)">저장하고 나가기</button>
        </div>
      </div>
    </div>
  </div>

  <p v-else class="muted loading">불러오는 중…</p>
</template>

<style scoped>
.board-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.title {
  margin: 0;
  font-size: 18px;
}
.title.editable {
  cursor: text;
}
.title-input {
  width: 220px;
}
.edit-btn {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}
.edit-btn,
.mode-chip {
  margin-right: 8px;
}
.spacer {
  flex: 1;
}
.unsaved {
  color: var(--danger);
  font-size: 12px;
}
.body {
  flex: 1;
  min-height: 0;
}
.edit-layout {
  display: flex;
  width: 100%;
}
.edit-layout.rows {
  flex-direction: column;
}
.edit-layout.cols {
  flex-direction: row;
}
.graph-pane {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.rows .graph-pane,
.cols .graph-pane {
  flex: 0 0 40%;
}
.timetable-pane {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
/* 영역 경계: 끌어서 비율 조정 */
.splitter {
  position: relative;
  flex: none;
  background: var(--border);
  touch-action: none;
}
.rows .splitter {
  height: 6px;
  cursor: row-resize;
}
.cols .splitter {
  width: 6px;
  cursor: col-resize;
}
.splitter::after {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  border-radius: 2px;
  background: var(--text-dim);
  opacity: 0.6;
}
.rows .splitter::after {
  width: 36px;
  height: 2px;
}
.cols .splitter::after {
  width: 2px;
  height: 36px;
}
.splitter:hover,
.splitter:focus-visible,
.resizing .splitter {
  background: var(--accent);
  outline: none;
}
.resizing {
  user-select: none;
}
/* 레이아웃 선택: 작은 그림으로 배치를 보여 준다 */
.layout-pick {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.layout-pick button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 32px;
  padding: 0;
  border: 0;
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
}
.layout-pick button.on {
  background: var(--accent);
  color: #fff;
}
.lay {
  display: flex;
  gap: 2px;
  width: 18px;
  height: 14px;
}
.lay i {
  flex: 1;
  border: 1.5px solid currentColor;
  border-radius: 2px;
}
/* 첫 칸 = 그래프(채움), 둘째 칸 = 카드(테두리만) */
.lay i:first-child {
  background: currentColor;
}
.lay.rows {
  flex-direction: column;
}
.lay.cards i:first-child,
.lay.graph i:last-child {
  display: none;
}
.view-layout {
  display: flex;
  flex-direction: column;
}
.view-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px 0;
}
.view-tabs button {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: var(--surface-2);
  cursor: pointer;
}
.view-tabs button.on {
  background: var(--surface);
  font-weight: 700;
}
.view-body {
  flex: 1;
  min-height: 0;
  border-top: 1px solid var(--border);
}
.inactive {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.inactive .chip {
  border: 0;
  cursor: pointer;
}
.missing,
.loading {
  padding: 48px 16px;
  text-align: center;
}
</style>
