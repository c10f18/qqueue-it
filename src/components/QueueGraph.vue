<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  computeDerivedEdges,
  isCompleted,
  labelGroupsOf,
  shownNodes,
  sortedLanes,
  type BoardData,
  type DoneMark,
  type EdgeHead,
  type GraphStyle,
  GRAPH_RANGES,
  LABEL_SIZE,
  NAME_LABEL_GROUP_ID,
  type GraphDirection,
} from '../domain'
import { laneColorOf } from '../composables/laneColor'
import { place } from '../graph/layout'
import { DEFAULT_VIEW, clampPitch, fitZoom, makeProjector, type Point3, type View } from '../graph/projection'

// 큐 그래프 (FR-60, FR-74): 슬롯×레인 좌표에 노드를 놓고 파생 엣지를 화살표로 그린다.
// Canvas 2D 직접 구현 — DOM 없이 픽셀만 그려 노드가 많아도 가볍다 (NFR-05).
// 진행 방향·완료 표시·화살표·배경은 보드의 그래프 설정(board.settings.graph)을 따른다.
// fitTick: 값이 바뀔 때마다 화면을 다시 맞춘다 (정렬 버튼).
const props = defineProps<{ data: BoardData; fitTick?: number }>()

const HEAD_OFFSET = 0.85 // 레인 머리글이 첫 슬롯보다 앞에 놓이는 거리(슬롯 간격 단위)

const DONE_MARKS: Record<DoneMark, string> = { check: '✓', x: '✕', star: '★', dot: '●', none: '' }

/** 라벨 위치(8방향) → 노드 중심에서의 방향 */
const LABEL_DIR: Record<GraphDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  'up-right': { x: 1, y: -1 },
  right: { x: 1, y: 0 },
  'down-right': { x: 1, y: 1 },
  down: { x: 0, y: 1 },
  'down-left': { x: -1, y: 1 },
  left: { x: -1, y: 0 },
  'up-left': { x: -1, y: -1 },
}

const host = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const size = shallowRef({ w: 300, h: 300 })
const view = ref<View>({ ...DEFAULT_VIEW })
const mode = ref<'pan' | 'rotate'>('pan')
const selectedId = ref<string | null>(null)
const showLabels = ref(true)

const style = computed<GraphStyle>(() => props.data.board.settings.graph ?? {})
const direction = computed(() => style.value.direction ?? 'down')
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

function fit() {
  const pts = [...layout.value.pos.values(), ...layout.value.heads.map((h) => h.pos)]
  view.value = { ...DEFAULT_VIEW, zoom: fitZoom(pts, size.value.w, size.value.h) }
}

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

/** 색이 (거의) 투명한지 — 그 위에 얹는 글자색을 고를 때 쓴다 */
function isSeeThrough(color: string): boolean {
  if (color === 'transparent') return true
  return color.length === 9 && parseInt(color.slice(7, 9), 16) < 128
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  ra: number,
  rb: number,
  color: string,
  width: number,
  headKind: EdgeHead,
  headSize: number,
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
  const head = Math.max(6, 5 + width * 2.2) * headSize

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // 채운 화살표는 선이 촉 안쪽에서 끝나야 끝이 뭉툭해지지 않는다.
  const lineEnd = headKind === 'arrow' ? head * 0.8 : 0
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex - ux * lineEnd, ey - uy * lineEnd)
  ctx.stroke()

  const lx = ex - ux * head - uy * head * 0.55
  const ly = ey - uy * head + ux * head * 0.55
  const rx = ex - ux * head + uy * head * 0.55
  const ry = ey - uy * head - ux * head * 0.55
  if (headKind === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(lx, ly)
    ctx.lineTo(rx, ry)
    ctx.closePath()
    ctx.fill()
  } else if (headKind === 'open') {
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(ex, ey)
    ctx.lineTo(rx, ry)
    ctx.stroke()
  } else if (headKind === 'dot') {
    ctx.beginPath()
    ctx.arc(ex, ey, Math.max(2.5, width * 1.6) * headSize, 0, Math.PI * 2)
    ctx.fill()
  }
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
  const st = style.value
  const doneColor = st.doneColor ?? cssVar(cv, '--ok', '#2f9e6b')
  const doneMark = DONE_MARKS[st.doneMark ?? 'check']
  const edgeColor = st.edgeColor ?? cssVar(cv, '--border', '#ccc')
  const edgeWidth = st.edgeWidth ?? 1.5
  const edgeHead = st.edgeHead ?? 'arrow'
  const edgeHeadSize = st.edgeHeadSize ?? GRAPH_RANGES.edgeHeadSize.default
  const NODE_R = nodeR.value
  const showProgress = st.showProgress ?? true

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
    ctx.fillStyle = hd.color === 'transparent' ? dimColor : hd.color
    ctx.fillText(hd.name, p.x, p.y)
  }

  // 엣지 (선택된 노드와 이어진 것은 강조)
  const sel = selectedId.value
  for (const e of edges) {
    const a = proj.get(e.from)
    const b = proj.get(e.to)
    if (!a || !b) continue
    const hot = sel !== null && (e.from === sel || e.to === sel)
    drawEdge(
      ctx,
      a,
      b,
      NODE_R * a.scale,
      NODE_R * b.scale,
      hot ? accent : edgeColor,
      hot ? edgeWidth + 0.8 : edgeWidth,
      edgeHead,
      edgeHeadSize,
    )
  }

  // 노드: 먼 것부터 그려 가까운 것이 위에 오게 한다
  const order = [...nodes].sort((x, y) => proj.get(y.id)!.depth - proj.get(x.id)!.depth)
  const labelOk = showLabels.value && nodes.length <= 400
  const groups = labelGroupsOf(props.data)
  for (const n of order) {
    const p = proj.get(n.id)!
    const r = NODE_R * p.scale
    const laneCol = colorOf(n.laneId)
    const done = isCompleted(n)
    const img = n.image ? imageFor(n.image) : null
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 채움: 사진 > 단색 > 기본
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fillStyle = n.color ?? surface
    ctx.fill()
    if (img) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, p.x - r, p.y - r, r * 2, r * 2)
      ctx.restore()
    }
    if (done) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = doneColor
      ctx.globalAlpha = img ? 0.65 : 1
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // 테두리
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.lineWidth = Math.max(1, 2.5 * p.scale)
    ctx.strokeStyle = n.id === sel ? accent : laneCol
    ctx.stroke()

    // 진행률 링
    if (showProgress && !done && n.progress > 0) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, r + 3 * p.scale, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * n.progress) / 100)
      ctx.lineWidth = Math.max(2, 3.5 * p.scale)
      ctx.strokeStyle = laneCol === 'transparent' ? accent : laneCol
      ctx.stroke()
    }

    // 가운데 글자: 완료 표시 또는 아이콘
    if (r > 7) {
      const glyph = done ? doneMark : img ? '' : (n.icon ?? '')
      if (glyph) {
        ctx.font = `${Math.round(r * 0.95)}px system-ui, sans-serif`
        ctx.fillStyle = done ? (isSeeThrough(doneColor) && !img ? textColor : '#fff') : textColor
        ctx.fillText(glyph, p.x, p.y + 1)
      }
    }
    // 라벨 그룹: 그룹마다 정해진 방향(8방향)으로 노드 바깥에 글자를 놓는다.
    if (labelOk && r > 8) {
      const textScale = Math.max(0.8, Math.min(1.2, p.scale))
      for (const g of groups) {
        let text: string
        if (g.id === NAME_LABEL_GROUP_ID) {
          const label = n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name
          text = showProgress && !done && n.progress > 0 ? `${label} ${n.progress}%` : label
        } else {
          text = n.labels?.[g.id] ?? ''
        }
        if (!text) continue
        const dir = LABEL_DIR[g.position]
        // 대각선은 원 둘레에 붙도록 거리를 줄인다.
        const reach = (r + 6 * textScale) * (dir.x !== 0 && dir.y !== 0 ? Math.SQRT1_2 + 0.1 : 1)
        ctx.font = `${Math.round((g.size ?? LABEL_SIZE.default) * textScale)}px system-ui, sans-serif`
        ctx.textAlign = dir.x > 0 ? 'left' : dir.x < 0 ? 'right' : 'center'
        ctx.textBaseline = dir.y > 0 ? 'top' : dir.y < 0 ? 'bottom' : 'middle'
        ctx.fillStyle = g.color ?? (n.id === sel ? accent : dimColor)
        ctx.fillText(text, p.x + dir.x * reach, p.y + dir.y * reach)
      }
    }
  }
}

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
    fit()
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

watch([view, layout, selectedId, showLabels, style], schedule)
// 선택한 노드가 삭제·숨김 처리되면 선택을 푼다.
watch(layout, (l) => {
  if (selectedId.value && !l.pos.has(selectedId.value)) selectedId.value = null
})
// 정렬(방향·간격)을 바꾸거나 정렬 버튼을 누르거나 빈 보드에 첫 노드가 생기면 화면에 다시 맞춘다.
watch([direction, slotGap, laneGap, () => props.fitTick], fit)
watch(
  () => layout.value.nodes.length === 0,
  (empty, wasEmpty) => {
    if (!empty && wasEmpty) fit()
  },
)
</script>

<template>
  <div ref="host" class="graph-host" :style="style.background ? { background: style.background } : undefined">
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
  left: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: calc(100% - 16px);
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
