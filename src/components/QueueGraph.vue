<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  computeDerivedEdges,
  labelGroupsOf,
  shownNodes,
  sortedLanes,
  type BoardData,
  type GraphStyle,
  type GraphView,
  GRAPH_RANGES,
} from '../domain'
import { laneColorOf } from '../composables/laneColor'
import { ensureFont, fontOption, labelFontCss } from '../graph/labelFont'
import { buildScene, escapeXml, renderCanvas, renderSvg, svgPaint, type Shape } from '../graph/scene'
import { place } from '../graph/layout'
import { DEFAULT_VIEW, clampPitch, fitZoom, makeProjector, type Point3, type View } from '../graph/projection'

// 큐 그래프 (FR-60, FR-74): 슬롯×레인 좌표에 노드를 놓고 파생 엣지를 화살표로 그린다.
// Canvas 2D 직접 구현 — DOM 없이 픽셀만 그려 노드가 많아도 가볍다 (NFR-05).
// 진행 방향·완료 표시·화살표·배경은 보드의 그래프 설정(board.settings.graph)을 따른다.
// fitTick: 값이 바뀔 때마다 화면을 다시 맞춘다 (정렬 버튼).
// camera: "뷰 저장"으로 저장해 둔 시점. 있으면 그 시점으로 연다. 없으면 화면에 맞춘다.
// editable: 수정 모드. 뷰 저장·해제 버튼을 보여 주고 camera 이벤트로 알린다.
//           평소의 확대·이동·회전은 저장되지 않는다.
const props = defineProps<{ data: BoardData; fitTick?: number; camera?: GraphView | null; editable?: boolean }>()
const emit = defineEmits<{ camera: [view: GraphView | null] }>()

const HEAD_OFFSET = 0.85 // 레인 머리글이 첫 슬롯보다 앞에 놓이는 거리(슬롯 간격 단위)


const host = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const size = shallowRef({ w: 300, h: 300 })
const view = ref<View>({ ...DEFAULT_VIEW })
const mode = ref<'pan' | 'rotate'>('pan')
const selectedId = ref<string | null>(null)
const showLabels = ref(true)

const style = computed<GraphStyle>(() => props.data.board.settings.graph ?? {})
const direction = computed(() => style.value.direction ?? 'down')
const percentMode = computed(() => props.data.board.settings.percent === true)
const slotGap = computed(() => style.value.slotGap ?? GRAPH_RANGES.slotGap.default)
const laneGap = computed(() => style.value.laneGap ?? GRAPH_RANGES.laneGap.default)
const nodeR = computed(() => style.value.nodeSize ?? GRAPH_RANGES.nodeSize.default)

// ── 레이아웃: 슬롯/레인 순번과 진행 방향으로 좌표가 정해진다 ──
const layout = computed(() => {
  const allLanes = sortedLanes(props.data)
  const lanes = allLanes.filter((l) => l.active)
  const laneCol = new Map(lanes.map((l, i) => [l.id, i]))
  const nodes = shownNodes(props.data)
  const slots = props.data.board.slotOrder.filter((id) => nodes.some((n) => n.slotId === id))
  const slotRow = new Map(slots.map((id, i) => [id, i]))
  const colorOf = (laneId: string) => {
    const idx = allLanes.findIndex((x) => x.id === laneId)
    return laneColorOf(allLanes[idx], idx)
  }

  const at = (slot: number, lane: number): Point3 => ({ ...place(direction.value, slot, lane, slotGap.value, laneGap.value), z: 0 })
  const pos = new Map<string, Point3>()
  for (const n of nodes) pos.set(n.id, at(slotRow.get(n.slotId)!, laneCol.get(n.laneId)!))
  const heads = lanes.map((l) => ({ name: l.name, color: colorOf(l.id), pos: at(-HEAD_OFFSET, laneCol.get(l.id)!) }))

  // 머리글까지 포함한 영역의 중앙을 원점으로 옮긴다.
  const all = [...pos.values(), ...heads.map((h) => h.pos)]
  if (all.length) {
    const xs = all.map((p) => p.x)
    const ys = all.map((p) => p.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    for (const p of all) {
      p.x -= cx
      p.y -= cy
    }
  }
  return { nodes, pos, heads, colorOf, edges: computeDerivedEdges(props.data) }
})

/**
 * 이동·회전을 초기화하고 전체가 보이게 확대 배율을 맞춘다.
 * 기본은 100%(설정한 크기 그대로)이고, 다 들어오지 않을 때만 줄인다. 내용이 적다고 100%보다 키우지는 않는다.
 */
function fit() {
  const pts = [...layout.value.pos.values(), ...layout.value.heads.map((h) => h.pos)]
  view.value = { ...DEFAULT_VIEW, zoom: Math.min(1, fitZoom(pts, size.value.w, size.value.h)) }
}
/** 뷰 리셋: 저장해 둔 뷰로 돌아간다. 저장한 뷰가 없으면 화면에 맞춘다. */
function resetView() {
  if (props.camera) view.value = { ...props.camera }
  else fit()
}
/** 뷰 초기화: 저장한 뷰와 상관없이 맨 처음의 기본 시점(화면에 맞춤)으로 돌아간다. */
function initView() {
  viewMenuOpen.value = false
  fit()
}

// 리셋 버튼의 ▾(또는 우클릭) 메뉴: 자주 쓰지 않는 뷰 기능을 모아 둔다.
const viewMenuOpen = ref(false)
const viewMenu = ref<HTMLElement | null>(null)
function onDocDownForMenu(e: PointerEvent) {
  if (viewMenuOpen.value && !viewMenu.value?.contains(e.target as Node)) viewMenuOpen.value = false
}
/** 100%: 설정에서 정한 크기 그대로 보이는 배율 */
function zoomActual() {
  view.value = { ...view.value, zoom: 1 }
}

// ── 뷰 저장: 지금 시점을 보기 모드에서 보여 줄 뷰로 저장한다 (수정 모드 전용) ──
const VIEW_KEYS = ['yaw', 'pitch', 'zoom', 'panX', 'panY'] as const
/** 지금 시점이 저장해 둔 뷰와 같은지 */
const atSavedView = computed(() => {
  const saved = props.camera
  return !!saved && VIEW_KEYS.every((k) => Math.abs(saved[k] - view.value[k]) < 1e-6)
})
function saveView() {
  emit('camera', { ...view.value })
}
function clearSavedView() {
  viewMenuOpen.value = false
  emit('camera', null)
}
const zoomPercent = computed(() => Math.round(view.value.zoom * 100))

// ── 첨부 사진 캐시 ───────────────────────────────────────
const images = new Map<string, HTMLImageElement>()
function imageFor(src: string): HTMLImageElement | null {
  let img = images.get(src)
  if (!img) {
    img = new Image()
    img.onload = schedule
    img.src = src
    images.set(src, img)
  }
  return img.complete && img.naturalWidth > 0 ? img : null
}

// ── 그리기 ───────────────────────────────────────────────
let raf = 0
function schedule() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    draw()
  })
}

function cssVar(el: Element, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback
}

/** 지금 상태로 그릴 목록을 만든다. 화면과 SVG 내보내기가 같이 쓴다. */
function scene(selected: string | null): Shape[] {
  const cv = canvas.value!
  const { w, h } = size.value
  const st = style.value
  const project = makeProjector(view.value, w, h)
  const { nodes, pos, heads, colorOf, edges } = layout.value
  const points = new Map(nodes.map((n) => [n.id, project(pos.get(n.id)!)]))
  return buildScene({
    nodes,
    point: (id) => points.get(id)!,
    heads: heads.map((hd) => ({ name: hd.name, color: hd.color, point: project(hd.pos) })),
    edges,
    laneColorOf: colorOf,
    groups: labelGroupsOf(props.data),
    theme: {
      text: cssVar(cv, '--text', '#222'),
      dim: cssVar(cv, '--text-dim', '#777'),
      surface: cssVar(cv, '--surface', '#fff'),
      accent: cssVar(cv, '--accent', '#4b6bfb'),
      ok: cssVar(cv, '--ok', '#2f9e6b'),
      border: cssVar(cv, '--border', '#ccc'),
    },
    nodeRadius: nodeR.value,
    doneColor: st.doneColor,
    doneMark: st.doneMark ?? 'check',
    edgeColor: st.edgeColor,
    edgeWidth: st.edgeWidth ?? GRAPH_RANGES.edgeWidth.default,
    edgeHead: st.edgeHead ?? 'arrow',
    edgeHeadSize: st.edgeHeadSize ?? GRAPH_RANGES.edgeHeadSize.default,
    // 보드가 백분율을 쓸 때만 진행률(링·% 글자)을 그린다.
    showProgress: percentMode.value,
    showLabels: showLabels.value,
    selectedId: selected,
  })
}

function draw() {
  const cv = canvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const { w, h } = size.value
  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  renderCanvas(ctx, scene(selectedId.value), imageFor)
}

// ── 내보내기: 지금 보이는 그래프를 그림(PNG/JPEG)이나 벡터(SVG)로 만든다 ──
const TITLE_BAND = 44

/** 배경과 보드 이름까지 합친 그림. 화면 캔버스는 배경이 투명이라 따로 깔아 준다. */
function snapshotCanvas(): HTMLCanvasElement {
  draw()
  const cv = canvas.value!
  const dpr = window.devicePixelRatio || 1
  const titleH = style.value.showBoardName ? Math.round(TITLE_BAND * dpr) : 0
  const out = document.createElement('canvas')
  out.width = cv.width
  out.height = cv.height + titleH
  const ctx = out.getContext('2d')!
  ctx.fillStyle = cssVar(cv, '--surface-2', '#f1f1ee')
  ctx.fillRect(0, 0, out.width, out.height)
  if (style.value.background && style.value.background !== 'transparent') {
    ctx.fillStyle = style.value.background
    ctx.fillRect(0, 0, out.width, out.height)
  }
  if (titleH) {
    ctx.font = `700 ${Math.round(20 * dpr)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = cssVar(cv, '--text', '#222')
    ctx.fillText(props.data.board.name, out.width / 2, titleH / 2, out.width - 24 * dpr)
  }
  ctx.drawImage(cv, 0, titleH)
  return out
}
function toBlob(type: 'image/png' | 'image/jpeg'): Promise<{ blob: Blob; width: number; height: number }> {
  const cv = snapshotCanvas()
  return new Promise((resolve, reject) =>
    cv.toBlob(
      (blob) => (blob ? resolve({ blob, width: cv.width, height: cv.height }) : reject(new Error('그림을 만들지 못했습니다.'))),
      type,
      0.92,
    ),
  )
}

/** 지금 시점 그대로의 그래프를 SVG 문서로 만든다. 화면과 같은 그릴 목록을 쓴다(선택 강조만 뺀다). */
function toSvg(): string {
  const cv = canvas.value!
  const { w, h } = size.value
  const st = style.value
  const titleH = st.showBoardName ? TITLE_BAND : 0
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h + titleH}" viewBox="0 0 ${w} ${h + titleH}" font-family="system-ui, sans-serif">`,
    `<rect width="100%" height="100%" fill="${cssVar(cv, '--surface-2', '#f1f1ee')}"/>`,
  ]
  if (st.background) out.push(`<rect width="100%" height="100%" ${svgPaint('fill', st.background)}/>`)
  if (titleH) {
    out.push(
      `<text x="${w / 2}" y="${titleH / 2 + 7}" text-anchor="middle" font-size="20" font-weight="700" fill="${cssVar(cv, '--text', '#222')}">${escapeXml(props.data.board.name)}</text>`,
    )
  }
  out.push(
    `<defs><clipPath id="stage"><rect width="${w}" height="${h}"/></clipPath></defs>`,
    `<g transform="translate(0 ${titleH})" clip-path="url(#stage)">`,
    renderSvg(scene(null)),
    '</g></svg>',
  )
  return out.join('\n')
}

defineExpose({ toBlob, toSvg })

// ── 크기 / 반응형: window가 아니라 이 패널 자체를 관찰한다 (명세 23.2) ──
let ro: ResizeObserver | null = null
let sized = false
function resize() {
  const el = host.value
  const cv = canvas.value
  if (!el || !cv) return
  const w = Math.max(1, Math.floor(el.clientWidth))
  const h = Math.max(1, Math.floor(el.clientHeight))
  const dpr = window.devicePixelRatio || 1
  cv.width = Math.floor(w * dpr)
  cv.height = Math.floor(h * dpr)
  cv.style.width = w + 'px'
  cv.style.height = h + 'px'
  size.value = { w, h }
  if (!sized) {
    sized = true
    // 저장해 둔 시점이 있으면 그대로 열고, 없으면 화면에 맞춘다.
    if (props.camera) view.value = { ...props.camera }
    else fit()
  }
  schedule()
}

// ── 조작: 드래그(이동/회전), 휠(확대), 클릭(선택) ────────────
let drag: { x: number; y: number; moved: boolean; rotate: boolean } | null = null

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.button !== 2) return
  canvas.value?.setPointerCapture(e.pointerId)
  drag = { x: e.clientX, y: e.clientY, moved: false, rotate: mode.value === 'rotate' || e.shiftKey || e.button === 2 }
}
function onPointerMove(e: PointerEvent) {
  if (!drag) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  if (!drag.moved && Math.hypot(dx, dy) < 4) return
  drag.moved = true
  drag.x = e.clientX
  drag.y = e.clientY
  const v = view.value
  if (drag.rotate) {
    view.value = { ...v, yaw: v.yaw + dx * 0.008, pitch: clampPitch(v.pitch + dy * 0.008) }
  } else {
    view.value = { ...v, panX: v.panX + dx, panY: v.panY + dy }
  }
}
function onPointerUp(e: PointerEvent) {
  const d = drag
  drag = null
  if (!d || d.moved) return
  const rect = canvas.value!.getBoundingClientRect()
  selectedId.value = hit(e.clientX - rect.left, e.clientY - rect.top)
}
function hit(mx: number, my: number): string | null {
  const project = makeProjector(view.value, size.value.w, size.value.h)
  let best: { id: string; depth: number } | null = null
  for (const n of layout.value.nodes) {
    const p = project(layout.value.pos.get(n.id)!)
    if (Math.hypot(p.x - mx, p.y - my) <= nodeR.value * p.scale + 4 && (!best || p.depth < best.depth)) {
      best = { id: n.id, depth: p.depth }
    }
  }
  return best?.id ?? null
}
function onWheel(e: WheelEvent) {
  e.preventDefault()
  zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)
}
function zoomBy(factor: number) {
  const v = view.value
  view.value = { ...v, zoom: Math.max(0.1, Math.min(4, v.zoom * factor)) }
}

const selectedNode = computed(() => layout.value.nodes.find((n) => n.id === selectedId.value))

// 라벨에 쓰는 Google 글꼴을 받아 오고, 글꼴이 도착하면 다시 그린다 (캔버스는 스스로 다시 그리지 않는다).
watch(
  () => {
    const groups = labelGroupsOf(props.data).filter((g) => fontOption(g.font).google)
    // only the characters actually shown, so the browser fetches just the needed font slices
    const chars = groups.length ? [...new Set(props.data.nodes.flatMap((n) => [n.name, ...Object.values(n.labels ?? {})]).join('') + '0123456789%')].join('') : ''
    return JSON.stringify([groups.map((g) => labelFontCss(g)), chars])
  },
  (key) => {
    const [fonts, chars] = JSON.parse(key) as [string[], string]
    void Promise.all(labelGroupsOf(props.data).map((g) => ensureFont(g.font))).then(() => {
      for (const font of fonts) void document.fonts?.load(font, chars).then(schedule, () => {})
    })
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('pointerdown', onDocDownForMenu, true)
  document.fonts?.addEventListener('loadingdone', schedule)
  ro = new ResizeObserver(resize)
  if (host.value) ro.observe(host.value)
  canvas.value?.addEventListener('wheel', onWheel, { passive: false })
  resize()
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocDownForMenu, true)
  document.fonts?.removeEventListener('loadingdone', schedule)
  ro?.disconnect()
  canvas.value?.removeEventListener('wheel', onWheel)
  cancelAnimationFrame(raf)
})

watch([view, layout, selectedId, showLabels, style], schedule)
// 선택한 노드가 삭제·숨김 처리되면 선택을 푼다.
watch(layout, (l) => {
  if (selectedId.value && !l.pos.has(selectedId.value)) selectedId.value = null
})
// 정렬(방향·간격)을 바꾸거나 정렬 버튼을 누르거나 빈 보드에 첫 노드가 생기면 화면에 다시 맞춘다.
watch([direction, slotGap, laneGap, () => props.fitTick], () => fit())
watch(
  () => layout.value.nodes.length === 0,
  (empty, wasEmpty) => {
    if (!empty && wasEmpty) fit()
  },
)
</script>

<template>
  <div class="graph-host" :style="style.background ? { background: style.background } : undefined">
    <!-- 보드 이름은 그래프 위의 따로 떨어진 띠에 둬서 노드·화살표와 겹치지 않게 한다. -->
    <h2 v-if="style.showBoardName" class="board-title">{{ data.board.name }}</h2>
    <div ref="host" class="stage">
    <canvas
      ref="canvas"
      :class="mode"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="drag = null"
      @contextmenu.prevent
      @dblclick="resetView"
    />

    <!-- 도구 줄: 끌기 동작 / 확대 / 뷰 리셋(+메뉴) / 뷰 저장 / 라벨 표시 -->
    <div class="tools">
      <div class="btn-group" role="group" aria-label="끌기 동작">
        <button :class="{ on: mode === 'pan' }" title="이동 (끌기)" aria-label="이동" :aria-pressed="mode === 'pan'" @click="mode = 'pan'">
          <AppIcon name="move" />
        </button>
        <button
          :class="{ on: mode === 'rotate' }"
          title="회전 (끌기. Shift 또는 우클릭 끌기도 가능)"
          aria-label="회전"
          :aria-pressed="mode === 'rotate'"
          @click="mode = 'rotate'"
        >
          <AppIcon name="rotate" />
        </button>
      </div>

      <div class="btn-group" role="group" aria-label="확대">
        <button title="축소" aria-label="축소" @click="zoomBy(0.8)"><AppIcon name="minus" /></button>
        <button class="zoom" title="지금 확대 배율. 누르면 100%(설정한 크기 그대로)로 봅니다" @click="zoomActual">{{ zoomPercent }}%</button>
        <button title="확대" aria-label="확대" @click="zoomBy(1.25)"><AppIcon name="plus" /></button>
      </div>

      <!-- 뷰 리셋 + 메뉴(뷰 초기화, 저장된 뷰 지우기). 우클릭으로도 메뉴가 열린다. -->
      <div ref="viewMenu" class="split">
        <div class="btn-group">
          <button
            :title="camera ? '뷰 리셋: 저장된 뷰로 돌아가기 (더블클릭)' : '뷰 리셋: 화면에 맞추기 (더블클릭). 저장된 뷰가 없습니다'"
            aria-label="뷰 리셋"
            @click="resetView"
            @contextmenu.prevent="viewMenuOpen = true"
          >
            <AppIcon name="fit" />
          </button>
          <button class="caret" title="뷰 메뉴" aria-label="뷰 메뉴" aria-haspopup="true" :aria-expanded="viewMenuOpen" @click="viewMenuOpen = !viewMenuOpen">
            <AppIcon name="chevron-down" :size="12" />
          </button>
        </div>
        <div v-if="viewMenuOpen" class="menu view-menu" role="menu">
          <button role="menuitem" @click="initView">뷰 초기화 <span class="hint">기본 시점(화면에 맞춤)</span></button>
          <button v-if="editable" role="menuitem" :disabled="!camera" @click="clearSavedView">
            저장된 뷰 지우기 <span class="hint">{{ camera ? '보기 모드도 기본 시점으로' : '저장된 뷰 없음' }}</span>
          </button>
        </div>
      </div>

      <div v-if="editable" class="btn-group">
        <button
          :class="{ on: atSavedView }"
          :title="
            atSavedView
              ? '지금 시점이 저장된 뷰입니다 (보기 모드에서 이대로 보입니다)'
              : '뷰 저장: 지금의 확대·이동·회전을 보기 모드에서 보여 줄 뷰로 저장'
          "
          @click="saveView"
        >
          <AppIcon name="camera" /> 뷰 저장
        </button>
      </div>

      <div class="btn-group">
        <button :class="{ on: showLabels }" title="라벨 표시" aria-label="라벨 표시" :aria-pressed="showLabels" @click="showLabels = !showLabels">
          <AppIcon name="label" />
        </button>
      </div>
    </div>

    <p v-if="layout.nodes.length === 0" class="empty muted">표시할 작업이 없습니다</p>
    <div v-if="selectedNode" class="info">
      <b>{{ selectedNode.icon }} {{ selectedNode.name }}</b>
      <span class="muted">{{ percentMode ? `${selectedNode.progress}%` : selectedNode.progress === 100 ? '완료' : '' }}</span>
    </div>
    </div>
  </div>
</template>

<style scoped>
.graph-host {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--surface-2);
}
.board-title {
  flex: none;
  margin: 0;
  padding: 8px 12px 4px;
  overflow: hidden;
  font-size: 20px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
canvas {
  display: block;
  touch-action: none;
  cursor: grab;
}
canvas.rotate {
  cursor: move;
}
.tools {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: calc(100% - 16px);
}
/* 묶음(.btn-group)의 버튼을 도구 줄 크기로 맞춘다 */
.tools .btn-group > button {
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  font-size: 12px;
}
.tools .zoom {
  min-width: 48px;
  font-variant-numeric: tabular-nums;
}
.tools .caret {
  min-width: 20px;
  padding: 0 3px;
}
.split {
  position: relative;
  display: inline-flex;
}
.view-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 250px;
}
.empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.info {
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: flex;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
</style>
