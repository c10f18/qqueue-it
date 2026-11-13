<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import BulkProgressDialog from '../components/BulkProgressDialog.vue'
import GraphSettingsDialog from '../components/GraphSettingsDialog.vue'
import ListView from '../components/ListView.vue'
import QueueGraph from '../components/QueueGraph.vue'
import Timetable from '../components/Timetable.vue'
import { navigate } from '../composables/useRoute'
import {
  DomainError,
  bulkProgress,
  exportBoard,
  importBoardData,
  renameBoard,
  resetAllProgress,
  sortedLanes,
  toggleLaneActive,
} from '../domain'
import { safeFileName, saveBlob } from '../export/download'
import { jpegToPdf } from '../export/pdf'
import { boardToXlsx } from '../export/xlsx'
import { useBoardStore } from '../stores/board'

const props = defineProps<{ boardId: string; mode: 'edit' | 'view' }>()
const store = useBoardStore()

const missing = ref(false)
const bulkOpen = ref(false)
const renaming = ref(false)
// 오른쪽에 붙는 패널은 한 번에 하나만 연다. 패널 밖을 누르면 닫힌다.
const panel = ref<'settings' | null>(null)
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

// 일괄 진행: 보기 모드에서만 쓴다.
function applyBulk(upTo: string, laneIds: string[]) {
  bulkOpen.value = false
  store.apply((d) => bulkProgress(d, upTo, laneIds))
}
function resetAll() {
  bulkOpen.value = false
  store.apply((d) => resetAllProgress(d))
}

// ── 보기 모드의 ☰ 메뉴: 일괄 진행, 내보내기, 가져오기 ─────────
const menuOpen = ref(false)
const viewGraph = ref<InstanceType<typeof QueueGraph> | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
type ExportKind = 'json' | 'xlsx' | 'pdf' | 'png' | 'svg'
const EXPORTS: { kind: ExportKind; label: string; hint: string }[] = [
  { kind: 'json', label: 'JSON', hint: '보드 전체 (다시 가져올 수 있음)' },
  { kind: 'xlsx', label: 'Excel (.xlsx)', hint: '작업 목록 표' },
  { kind: 'pdf', label: 'PDF', hint: '큐 그래프 그림' },
  { kind: 'png', label: 'PNG', hint: '큐 그래프 그림' },
  { kind: 'svg', label: 'SVG', hint: '큐 그래프 벡터' },
]

/** 그래프를 그림으로 내보내려면 그래프 탭이 떠 있어야 한다. */
async function graphForExport() {
  if (viewTab.value !== 'graph') {
    viewTab.value = 'graph'
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  if (!viewGraph.value) throw new Error('그래프를 준비하지 못했습니다.')
  return viewGraph.value
}

async function doExport(kind: ExportKind) {
  menuOpen.value = false
  const board = store.exportData()
  if (!board) return
  const name = safeFileName(board.board.name)
  try {
    if (kind === 'json') {
      const text = JSON.stringify(exportBoard(board), null, 2)
      saveBlob(new Blob([text], { type: 'application/json' }), `${name}.json`)
    } else if (kind === 'xlsx') {
      saveBlob(boardToXlsx(board), `${name}.xlsx`)
    } else if (kind === 'svg') {
      const svg = (await graphForExport()).toSvg()
      saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`)
    } else if (kind === 'png') {
      saveBlob((await (await graphForExport()).toBlob('image/png')).blob, `${name}.png`)
    } else {
      const { blob, width, height } = await (await graphForExport()).toBlob('image/jpeg')
      const pageW = Math.round(width / (window.devicePixelRatio || 1)) * 0.75 // CSS px → pt
      saveBlob(jpegToPdf(new Uint8Array(await blob.arrayBuffer()), width, height, pageW), `${name}.pdf`)
    }
  } catch (e) {
    store.error = e instanceof Error ? e.message : '내보내지 못했습니다.'
  }
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      throw new DomainError('invalid-argument', '가져올 수 없는 파일입니다: JSON 형식이 아닙니다.')
    }
    const id = await store.importBoard(importBoardData(raw))
    navigate({ name: 'view', boardId: id })
  } catch (err) {
    store.error = err instanceof Error ? err.message : '가져오지 못했습니다.'
  }
}

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
    panel.value = null
    bulkOpen.value = false
    menuOpen.value = false
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
  const target = e.target as HTMLElement
  if (layoutOpen.value && !target.closest('.layout-wrap')) layoutOpen.value = false
  if (menuOpen.value && !target.closest('.menu-wrap')) menuOpen.value = false
  if (!panel.value) return
  if (target.closest('.side-panel .dialog, [data-panel-toggle]')) return
  panel.value = null
}
function togglePanel(name: 'settings') {
  panel.value = panel.value === name ? null : name
}

// ── 수정 모드 레이아웃: 그래프와 카드(타임테이블)를 어떻게 놓을지 ──
// 그래프를 카드 영역의 어느 쪽에 붙일지(도크 위치) 또는 한쪽만 볼지를 고른다.
type EditLayout = 'left' | 'right' | 'top' | 'bottom' | 'cards' | 'graph'
interface LayoutOption {
  value: EditLayout
  label: string
  /** 아이콘(18×14) 안에서 그래프가 차지하는 칸 */
  fill?: { x: number; y: number; w: number; h: number }
}
const DOCK_LAYOUTS: LayoutOption[] = [
  { value: 'left', label: '그래프를 왼쪽에', fill: { x: 3, y: 3, w: 5, h: 8 } },
  { value: 'right', label: '그래프를 오른쪽에', fill: { x: 10, y: 3, w: 5, h: 8 } },
  { value: 'top', label: '그래프를 위에', fill: { x: 3, y: 3, w: 12, h: 3.5 } },
  { value: 'bottom', label: '그래프를 아래에', fill: { x: 3, y: 7.5, w: 12, h: 3.5 } },
]
const FULL_LAYOUTS: LayoutOption[] = [
  { value: 'cards', label: '카드만' },
  { value: 'graph', label: '그래프만', fill: { x: 3, y: 3, w: 12, h: 8 } },
]
const LAYOUTS = [...DOCK_LAYOUTS, ...FULL_LAYOUTS]
const layoutOpen = ref(false)
const PREF_KEY = 'qqueue.editLayout'
function defaultLayout(): EditLayout {
  if (!window.matchMedia('(min-width: 640px)').matches) return 'cards'
  return window.matchMedia('(orientation: landscape)').matches ? 'top' : 'left'
}
const layout = ref<EditLayout>(defaultLayout())
/** 나눠 보는 레이아웃에서 그래프 영역이 차지하는 비율 */
const ratio = ref(0.4)
try {
  const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null')
  // 예전 이름(rows/cols)으로 기억해 둔 값도 받아 준다.
  const name = saved?.layout === 'rows' ? 'top' : saved?.layout === 'cols' ? 'left' : saved?.layout
  if (LAYOUTS.some((l) => l.value === name)) layout.value = name
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
const split = computed(() => DOCK_LAYOUTS.some((l) => l.value === layout.value))
const vertical = computed(() => layout.value === 'top' || layout.value === 'bottom')
const currentLayout = computed(() => LAYOUTS.find((l) => l.value === layout.value)!)
function pickLayout(value: EditLayout) {
  layout.value = value
  layoutOpen.value = false
}

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
  // 그래프가 붙은 쪽 가장자리에서 포인터까지의 거리가 그래프 영역의 크기다.
  const value =
    layout.value === 'top'
      ? (e.clientY - rect.top) / rect.height
      : layout.value === 'bottom'
        ? (rect.bottom - e.clientY) / rect.height
        : layout.value === 'right'
          ? (rect.right - e.clientX) / rect.width
          : (e.clientX - rect.left) / rect.width
  ratio.value = Math.min(0.85, Math.max(0.15, value))
}
function resizeKey(e: KeyboardEvent) {
  // 방향키가 가리키는 쪽으로 경계가 움직이게 한다.
  const grow = { left: 'ArrowRight', right: 'ArrowLeft', top: 'ArrowDown', bottom: 'ArrowUp' }[layout.value as string]
  const shrink = { left: 'ArrowLeft', right: 'ArrowRight', top: 'ArrowUp', bottom: 'ArrowDown' }[layout.value as string]
  const delta = e.key === grow ? 0.05 : e.key === shrink ? -0.05 : 0
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

      <button
        v-if="mode === 'view'"
        class="edit-btn"
        title="수정 모드로 들어가기"
        aria-label="수정"
        @click="navigate({ name: 'edit', boardId })"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            d="M11.3 1.7a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L5.6 13.4l-3.7.8.8-3.7z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path d="M9.8 3.2l3 3" stroke="currentColor" stroke-width="1.4" />
        </svg>
      </button>
      <span v-else class="chip mode-chip">수정 중</span>

      <template v-if="mode === 'view'">
        <span class="spacer" />
        <div class="menu-wrap">
          <button class="menu-btn" title="메뉴" aria-label="메뉴" aria-haspopup="true" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
              <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
          <div v-if="menuOpen" class="menu-pop" role="menu">
            <button role="menuitem" title="지정한 슬롯까지 한 번에 완료 처리" @click="((menuOpen = false), (bulkOpen = true))">일괄 진행…</button>
            <span class="menu-title">내보내기</span>
            <button v-for="x in EXPORTS" :key="x.kind" role="menuitem" @click="doExport(x.kind)">
              {{ x.label }} <span class="muted">{{ x.hint }}</span>
            </button>
            <span class="menu-title">가져오기</span>
            <button role="menuitem" @click="((menuOpen = false), importInput?.click())">
              JSON 파일… <span class="muted">새 보드로 추가</span>
            </button>
          </div>
          <input ref="importInput" type="file" accept=".json,application/json" hidden @change="onImportFile" />
        </div>
      </template>

      <template v-if="mode === 'edit'">
        <button class="btn" :disabled="!store.canUndo" title="되돌리기 (Ctrl+Z)" @click="store.undo()">↶</button>
        <button class="btn" :disabled="!store.canRedo" title="다시 실행 (Ctrl+Shift+Z)" @click="store.redo()">↷</button>

        <div class="layout-wrap">
          <button
            class="btn layout-btn"
            title="레이아웃 선택"
            aria-label="레이아웃 선택"
            aria-haspopup="true"
            :aria-expanded="layoutOpen"
            @click="((panel = null), (layoutOpen = !layoutOpen))"
          >
            <svg class="lay" viewBox="0 0 18 14" aria-hidden="true">
              <rect x="1" y="1" width="16" height="12" rx="2.5" />
              <rect v-if="currentLayout.fill" class="fill" v-bind="{ x: currentLayout.fill.x, y: currentLayout.fill.y, width: currentLayout.fill.w, height: currentLayout.fill.h }" rx="1" />
              <path v-else class="lines" d="M4.5 4.5h9M4.5 7h9M4.5 9.5h9" />
            </svg>
          </button>

          <div v-if="layoutOpen" class="layout-pop" role="dialog" aria-label="레이아웃 선택">
            <template
              v-for="group in [
                { title: '그래프 위치', items: DOCK_LAYOUTS },
                { title: '한쪽만 보기', items: FULL_LAYOUTS },
              ]"
              :key="group.title"
            >
              <span class="pop-title">{{ group.title }}</span>
              <div class="pop-row" role="radiogroup" :aria-label="group.title">
                <button
                  v-for="l in group.items"
                  :key="l.value"
                  type="button"
                  role="radio"
                  :class="{ on: layout === l.value }"
                  :aria-checked="layout === l.value"
                  :title="l.label"
                  :aria-label="l.label"
                  @click="pickLayout(l.value)"
                >
                  <svg class="lay" viewBox="0 0 18 14" aria-hidden="true">
                    <rect x="1" y="1" width="16" height="12" rx="2.5" />
                    <rect v-if="l.fill" class="fill" v-bind="{ x: l.fill.x, y: l.fill.y, width: l.fill.w, height: l.fill.h }" rx="1" />
                    <path v-else class="lines" d="M4.5 4.5h9M4.5 7h9M4.5 9.5h9" />
                  </svg>
                </button>
              </div>
            </template>
          </div>
        </div>
        <button class="btn" data-panel-toggle title="테마·그래프(표시·정렬)·노드·라인 설정" @click="togglePanel('settings')">⚙ 설정</button>

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
        <QueueGraph :data="data" :fit-tick="fitTick" :camera="store.camera" editable @camera="store.setCamera" />
      </section>
      <div
        v-if="split"
        class="splitter"
        role="separator"
        tabindex="0"
        :aria-orientation="vertical ? 'horizontal' : 'vertical'"
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
        <Timetable :data="data" />
      </section>
    </div>

    <div v-else class="body view-layout">
      <div class="view-tabs" role="tablist">
        <button role="tab" :class="{ on: viewTab === 'list' }" @click="viewTab = 'list'">리스트</button>
        <button role="tab" :class="{ on: viewTab === 'graph' }" @click="viewTab = 'graph'">큐 그래프</button>
      </div>
      <div class="view-body">
        <ListView v-if="viewTab === 'list'" :data="data" />
        <QueueGraph v-else ref="viewGraph" :data="data" :camera="store.camera" />
      </div>
    </div>

    <GraphSettingsDialog v-if="panel === 'settings'" :data="data" @aligned="fitTick++" @close="panel = null" />

    <BulkProgressDialog v-if="bulkOpen && mode === 'view'" :data="data" @apply="applyBulk" @reset-all="resetAll" @close="bulkOpen = false" />

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
/* 펜 아이콘만 있는 테두리 없는 버튼 */
.edit-btn,
.menu-btn {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
}
.edit-btn:hover,
.menu-btn:hover,
.menu-btn[aria-expanded='true'] {
  background: var(--surface-2);
  color: var(--text);
}
.menu-btn {
  color: var(--text);
}
.menu-wrap {
  position: relative;
}
.menu-pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  display: grid;
  min-width: 250px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.menu-pop button {
  display: flex;
  gap: 8px;
  justify-content: space-between;
  align-items: baseline;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.menu-pop button:hover {
  background: var(--surface-2);
}
.menu-pop button .muted {
  font-size: 12px;
}
.menu-title {
  margin-top: 4px;
  padding: 8px 10px 2px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-dim);
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
/* 그래프가 DOM에서 먼저 오므로, 오른쪽·아래에 붙일 때는 방향을 뒤집는다. */
.edit-layout.left {
  flex-direction: row;
}
.edit-layout.right {
  flex-direction: row-reverse;
}
.edit-layout.top {
  flex-direction: column;
}
.edit-layout.bottom {
  flex-direction: column-reverse;
}
.graph-pane {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.left .graph-pane,
.right .graph-pane,
.top .graph-pane,
.bottom .graph-pane {
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
.top .splitter,
.bottom .splitter {
  height: 6px;
  cursor: row-resize;
}
.left .splitter,
.right .splitter {
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
.top .splitter::after,
.bottom .splitter::after {
  width: 36px;
  height: 2px;
}
.left .splitter::after,
.right .splitter::after {
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
/* 레이아웃 선택: 창 도크 위치를 고르는 메뉴처럼, 테두리 안에 그래프가 붙는 쪽을 칠한 아이콘으로 보여 준다 */
.layout-wrap {
  position: relative;
}
.layout-btn {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.lay {
  width: 22px;
  height: 17px;
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
.layout-pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 30;
  display: grid;
  gap: 6px;
  min-width: 190px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.pop-title {
  font-size: 12px;
  color: var(--text-dim);
}
.pop-title:not(:first-child) {
  margin-top: 6px;
}
.pop-row {
  display: flex;
  gap: 4px;
}
.pop-row button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}
.pop-row button:hover {
  background: var(--surface-2);
}
.pop-row button.on {
  background: var(--accent-soft);
  color: var(--accent);
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
