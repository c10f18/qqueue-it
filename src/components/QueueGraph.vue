<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { computeDerivedEdges, isCompleted, shownNodes, sortedLanes, type BoardData } from '../domain'
import { laneColor } from '../composables/laneColor'
import { DEFAULT_VIEW, clampPitch, fitZoom, makeProjector, type Point3, type View } from '../graph/projection'

// 큐 그래프 (FR-60, FR-74): 슬롯(행)×레인(열) 좌표에 노드를 놓고 파생 엣지를 화살표로 그린다.
// Canvas 2D 직접 구현 — DOM 없이 픽셀만 그려 노드가 많아도 가볍다 (NFR-05).
const props = defineProps<{ data: BoardData }>()

const DX = 170
const DY = 96
const NODE_R = 15
const HEAD_OFFSET = DY * 0.8 // 레인 머리글이 첫 행 위로 떨어진 거리

const host = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const size = shallowRef({ w: 300, h: 300 })
const view = ref<View>({ ...DEFAULT_VIEW })
const mode = ref<'pan' | 'rotate'>('pan')
const selectedId = ref<string | null>(null)
const showLabels = ref(true)

// ── 레이아웃: 슬롯/레인 위치로 좌표가 정해진다 ───────────────
const layout = computed(() => {
  const lanes = sortedLanes(props.data).filter((l) => l.active)
  const allLanes = sortedLanes(props.data)
  const laneCol = new Map(lanes.map((l, i) => [l.id, i]))
  const nodes = shownNodes(props.data)
  const slots = props.data.board.slotOrder.filter((id) => nodes.some((n) => n.slotId === id))
  const slotRow = new Map(slots.map((id, i) => [id, i]))

  const cx = ((lanes.length - 1) * DX) / 2
  // 머리글까지 포함한 영역의 중앙을 원점으로 삼는다
  const cy = (Math.max(slots.length - 1, 0) * DY - HEAD_OFFSET) / 2
  const pos = new Map<string, Point3>()
  for (const n of nodes) {
    pos.set(n.id, { x: laneCol.get(n.laneId)! * DX - cx, y: slotRow.get(n.slotId)! * DY - cy, z: 0 })
  }
  const heads = lanes.map((l) => ({
    name: l.name,
    color: laneColor(allLanes.findIndex((x) => x.id === l.id)),
    pos: { x: laneCol.get(l.id)! * DX - cx, y: -HEAD_OFFSET - cy, z: 0 } as Point3,
  }))
  const colorOf = (laneId: string) => laneColor(allLanes.findIndex((x) => x.id === laneId))
  return { nodes, pos, heads, colorOf, edges: computeDerivedEdges(props.data) }
})

function fit() {
  const pts = [...layout.value.pos.values(), ...layout.value.heads.map((h) => h.pos)]
  view.value = { ...DEFAULT_VIEW, zoom: fitZoom(pts, size.value.w, size.value.h) }
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

function drawArrow(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  ra: number,
  rb: number,
  color: string,
  width: number,
) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < ra + rb + 2) return
  const ux = dx / len
  const uy = dy / len
  const sx = a.x + ux * ra
  const sy = a.y + uy * ra
  const ex = b.x - ux * (rb + 2)
  const ey = b.y - uy * (rb + 2)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  const head = Math.max(5, 7 * Math.min(1.5, width))
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - ux * head - uy * head * 0.55, ey - uy * head + ux * head * 0.55)
  ctx.lineTo(ex - ux * head + uy * head * 0.55, ey - uy * head - ux * head * 0.55)
  ctx.closePath()
  ctx.fill()
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

  const textColor = cssVar(cv, '--text', '#222')
  const dimColor = cssVar(cv, '--text-dim', '#777')
  const surface = cssVar(cv, '--surface', '#fff')
  const accent = cssVar(cv, '--accent', '#4b6bfb')
  const ok = cssVar(cv, '--ok', '#2f9e6b')
  const borderColor = cssVar(cv, '--border', '#ccc')

  const project = makeProjector(view.value, w, h)
  const { nodes, pos, heads, colorOf, edges } = layout.value
  const proj = new Map<string, ReturnType<typeof project>>()
  for (const n of nodes) proj.set(n.id, project(pos.get(n.id)!))

  // 레인 머리글
  ctx.font = '700 13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const hd of heads) {
    const p = project(hd.pos)
    ctx.fillStyle = hd.color
    ctx.globalAlpha = 0.9
    ctx.fillText(hd.name, p.x, p.y)
    ctx.globalAlpha = 1
  }

  // 엣지 (선택된 노드와 이어진 것은 강조)
  const sel = selectedId.value
  for (const e of edges) {
    const a = proj.get(e.from)
    const b = proj.get(e.to)
    if (!a || !b) continue
    const hot = sel !== null && (e.from === sel || e.to === sel)
    drawArrow(ctx, a, b, NODE_R * a.scale, NODE_R * b.scale, hot ? accent : borderColor, hot ? 2.2 : 1.4)
  }

  // 노드: 먼 것부터 그려 가까운 것이 위에 오게 한다
  const order = [...nodes].sort((x, y) => proj.get(y.id)!.depth - proj.get(x.id)!.depth)
  const labelOk = showLabels.value && nodes.length <= 400
  for (const n of order) {
    const p = proj.get(n.id)!
    const r = NODE_R * p.scale
    const color = colorOf(n.laneId)
    const done = isCompleted(n)

    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fillStyle = done ? ok : surface
    ctx.fill()
    ctx.lineWidth = Math.max(1, 2.5 * p.scale)
    ctx.strokeStyle = n.id === sel ? accent : color
    ctx.stroke()

    if (!done && n.progress > 0) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * n.progress) / 100)
      ctx.lineWidth = Math.max(2, 4 * p.scale)
      ctx.strokeStyle = color
      ctx.stroke()
    }

    if (r > 7) {
      ctx.font = `${Math.round(r * 0.95)}px system-ui, sans-serif`
      ctx.fillStyle = done ? '#fff' : textColor
      ctx.fillText(done ? '✓' : (n.icon ?? ''), p.x, p.y + 1)
    }
    if (labelOk && r > 8) {
      ctx.font = `${Math.max(10, Math.min(14, 12 * p.scale))}px system-ui, sans-serif`
      ctx.fillStyle = n.id === sel ? accent : dimColor
      const label = n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name
      ctx.fillText(label, p.x, p.y + r + 11 * Math.max(0.8, p.scale))
    }
  }
}

// ── 크기 / 반응형: window가 아니라 이 패널 자체를 관찰한다 (명세 23.2) ──
let ro: ResizeObserver | null = null
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
  const first = size.value.w === 300 && size.value.h === 300
  size.value = { w, h }
  if (first) fit()
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
    if (Math.hypot(p.x - mx, p.y - my) <= NODE_R * p.scale + 4 && (!best || p.depth < best.depth)) {
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

onMounted(() => {
  ro = new ResizeObserver(resize)
  if (host.value) ro.observe(host.value)
  canvas.value?.addEventListener('wheel', onWheel, { passive: false })
  resize()
})
onUnmounted(() => {
  ro?.disconnect()
  canvas.value?.removeEventListener('wheel', onWheel)
  cancelAnimationFrame(raf)
})

watch([view, layout, selectedId, showLabels], schedule, { deep: false })
// 선택한 노드가 삭제·숨김 처리되면 선택을 푼다.
watch(layout, (l) => {
  if (selectedId.value && !l.pos.has(selectedId.value)) selectedId.value = null
})
// 노드 구성이 바뀌어 처음 그려질 때는 화면에 맞춘다.
watch(
  () => layout.value.nodes.length === 0,
  (empty, wasEmpty) => {
    if (!empty && wasEmpty) fit()
  },
)
</script>

<template>
  <div ref="host" class="graph-host">
    <canvas
      ref="canvas"
      :class="mode"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="drag = null"
      @contextmenu.prevent
      @dblclick="fit"
    />

    <div class="tools">
      <button :class="{ on: mode === 'pan' }" title="이동 (드래그)" @click="mode = 'pan'">✥</button>
      <button :class="{ on: mode === 'rotate' }" title="회전 (드래그, Shift 또는 우클릭 드래그도 가능)" @click="mode = 'rotate'">⟳</button>
      <button title="확대" @click="zoomBy(1.25)">＋</button>
      <button title="축소" @click="zoomBy(0.8)">－</button>
      <button title="화면에 맞추기 (더블클릭)" @click="fit">⛶</button>
      <button :class="{ on: showLabels }" title="이름 표시" @click="showLabels = !showLabels">Aa</button>
    </div>

    <p v-if="layout.nodes.length === 0" class="empty muted">표시할 작업이 없습니다</p>
    <div v-if="selectedNode" class="info">
      <b>{{ selectedNode.icon }} {{ selectedNode.name }}</b>
      <span class="muted">{{ selectedNode.progress }}%</span>
    </div>
  </div>
</template>

<style scoped>
.graph-host {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--surface-2);
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
  right: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: calc(100% - 16px);
  justify-content: flex-end;
}
.tools button {
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
}
.tools button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
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
