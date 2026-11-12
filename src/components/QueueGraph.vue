<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  computeDerivedEdges,
  isCompleted,
  labelAngle,
  labelGroupsOf,
  shownNodes,
  sortedLanes,
  type BoardData,
  type DoneMark,
  type EdgeHead,
  type GraphStyle,
  type GraphView,
  GRAPH_RANGES,
  LABEL_SIZE,
  NAME_LABEL_GROUP_ID,
} from '../domain'
import { laneColorOf } from '../composables/laneColor'
import { LABEL_FONTS, labelFontCss } from '../graph/labelFont'
import { place } from '../graph/layout'
import { DEFAULT_VIEW, clampPitch, fitZoom, makeProjector, type Point3, type View } from '../graph/projection'

// 큐 그래프 (FR-60, FR-74): 슬롯×레인 좌표에 노드를 놓고 파생 엣지를 화살표로 그린다.
// Canvas 2D 직접 구현 — DOM 없이 픽셀만 그려 노드가 많아도 가볍다 (NFR-05).
// 진행 방향·완료 표시·화살표·배경은 보드의 그래프 설정(board.settings.graph)을 따른다.
// fitTick: 값이 바뀔 때마다 화면을 다시 맞춘다 (정렬 버튼).
// camera: 저장해 둔 시점. 있으면 그 시점으로 연다.
// editable: 수정 모드. 시점을 바꾸면 camera 이벤트로 알려 저장되게 한다.
const props = defineProps<{ data: BoardData; fitTick?: number; camera?: GraphView | null; editable?: boolean }>()
const emit = defineEmits<{ camera: [view: GraphView] }>()

const HEAD_OFFSET = 0.85 // 레인 머리글이 첫 슬롯보다 앞에 놓이는 거리(슬롯 간격 단위)

const DONE_MARKS: Record<DoneMark, string> = { check: '✓', x: '✕', star: '★', dot: '●', none: '' }

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

// 수정 모드에서 시점이 바뀌면 조금 모았다가 한 번만 알린다 (휠 확대처럼 연달아 바뀌는 경우).
let cameraTimer = 0
function sendCamera() {
  clearTimeout(cameraTimer)
  cameraTimer = 0
  emit('camera', { ...view.value })
}
function commitView() {
  if (!props.editable) return
  clearTimeout(cameraTimer)
  cameraTimer = window.setTimeout(sendCamera, 200)
}

/** 이동·회전을 초기화하고 전체가 보이게 확대 배율을 맞춘다. */
function fit(save = true) {
  const pts = [...layout.value.pos.values(), ...layout.value.heads.map((h) => h.pos)]
  view.value = { ...DEFAULT_VIEW, zoom: fitZoom(pts, size.value.w, size.value.h) }
  if (save) commitView()
}
/** 시점 리셋: 보기 모드에서는 저장해 둔 시점으로, 그 밖에는 화면에 맞춘다. */
function resetView() {
  if (!props.editable && props.camera) view.value = { ...props.camera }
  else fit()
}
/** 100%: 설정에서 정한 크기 그대로 보이는 배율 */
function zoomActual() {
  view.value = { ...view.value, zoom: 1 }
  commitView()
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
        if (g.visible === false) continue
        let text: string
        if (g.id === NAME_LABEL_GROUP_ID) {
          const label = n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name
          text = showProgress && !done && n.progress > 0 ? `${label} ${n.progress}%` : label
        } else {
          text = n.labels?.[g.id] ?? ''
        }
        if (!text) continue
        // 각도(0 = 위, 시계 방향)로 노드 둘레의 한 점을 잡고, 글자가 노드 바깥으로 뻗도록 정렬한다.
        const rad = (labelAngle(g) * Math.PI) / 180
        const dir = { x: Math.sin(rad), y: -Math.cos(rad) }
        const reach = r + 6 * textScale
        const SIDE = 0.38
        ctx.font = labelFontCss(g, textScale)
        ctx.textAlign = dir.x > SIDE ? 'left' : dir.x < -SIDE ? 'right' : 'center'
        ctx.textBaseline = dir.y > SIDE ? 'top' : dir.y < -SIDE ? 'bottom' : 'middle'
        ctx.fillStyle = g.color ?? (n.id === sel ? accent : dimColor)
        const tx = p.x + dir.x * reach
        const ty = p.y + dir.y * reach
        ctx.fillText(text, tx, ty)
        if (g.underline) {
          // 캔버스에는 밑줄이 없어서 글자 아래에 선을 직접 긋는다.
          const px = (g.size ?? LABEL_SIZE.default) * textScale
          const width = ctx.measureText(text).width
          const left = ctx.textAlign === 'left' ? tx : ctx.textAlign === 'right' ? tx - width : tx - width / 2
          const bottom = ctx.textBaseline === 'top' ? ty + px : ctx.textBaseline === 'bottom' ? ty : ty + px / 2
          ctx.fillRect(left, bottom + 1, width, Math.max(1, px / 14))
        }
      }
    }
  }
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

function xml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
/** 색 → SVG 속성. '#rrggbbaa'는 불투명도 속성으로 나눠 쓴다. */
function paint(attr: 'fill' | 'stroke', color: string): string {
  if (color === 'transparent') return `${attr}="none"`
  if (/^#[0-9a-f]{8}$/i.test(color)) {
    return `${attr}="${color.slice(0, 7)}" ${attr}-opacity="${(parseInt(color.slice(7), 16) / 255).toFixed(3)}"`
  }
  return `${attr}="${color}"`
}
const f1 = (n: number) => n.toFixed(1)

/** 지금 시점 그대로의 그래프를 SVG 문서로 만든다. 그리는 순서와 모양은 draw()와 같다. */
function toSvg(): string {
  const cv = canvas.value!
  const { w, h } = size.value
  const st = style.value
  const titleH = st.showBoardName ? TITLE_BAND : 0
  const textColor = cssVar(cv, '--text', '#222')
  const dimColor = cssVar(cv, '--text-dim', '#777')
  const surface = cssVar(cv, '--surface', '#fff')
  const accent = cssVar(cv, '--accent', '#4b6bfb')
  const doneColor = st.doneColor ?? cssVar(cv, '--ok', '#2f9e6b')
  const doneMark = DONE_MARKS[st.doneMark ?? 'check']
  const edgeColor = st.edgeColor ?? cssVar(cv, '--border', '#ccc')
  const edgeWidth = st.edgeWidth ?? 1.5
  const edgeHead = st.edgeHead ?? 'arrow'
  const headSize = st.edgeHeadSize ?? GRAPH_RANGES.edgeHeadSize.default
  const showProgress = st.showProgress ?? true
  const R = nodeR.value

  const project = makeProjector(view.value, w, h)
  const { nodes, pos, heads, colorOf, edges } = layout.value
  const proj = new Map(nodes.map((n) => [n.id, project(pos.get(n.id)!)]))
  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h + titleH}" viewBox="0 0 ${w} ${h + titleH}" font-family="system-ui, sans-serif">`,
    `<rect width="100%" height="100%" fill="${cssVar(cv, '--surface-2', '#f1f1ee')}"/>`,
  )
  if (st.background) out.push(`<rect width="100%" height="100%" ${paint('fill', st.background)}/>`)
  if (titleH) {
    out.push(
      `<text x="${w / 2}" y="${titleH / 2 + 7}" text-anchor="middle" font-size="20" font-weight="700" fill="${textColor}">${xml(props.data.board.name)}</text>`,
    )
  }
  out.push(`<defs><clipPath id="stage"><rect width="${w}" height="${h}"/></clipPath></defs>`)
  out.push(`<g transform="translate(0 ${titleH})" clip-path="url(#stage)">`)

  for (const hd of heads) {
    const p = project(hd.pos)
    out.push(
      `<text x="${f1(p.x)}" y="${f1(p.y + 4.5)}" text-anchor="middle" font-size="13" font-weight="700" ${paint('fill', hd.color === 'transparent' ? dimColor : hd.color)}>${xml(hd.name)}</text>`,
    )
  }

  for (const e of edges) {
    const a = proj.get(e.from)
    const b = proj.get(e.to)
    if (!a || !b) continue
    const ra = R * a.scale
    const rb = R * b.scale
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < ra + rb + 2) continue
    const ux = dx / len
    const uy = dy / len
    const sx = a.x + ux * ra
    const sy = a.y + uy * ra
    const ex = b.x - ux * (rb + 2)
    const ey = b.y - uy * (rb + 2)
    const head = Math.max(6, 5 + edgeWidth * 2.2) * headSize
    const lineEnd = edgeHead === 'arrow' ? head * 0.8 : 0
    const stroke = `${paint('stroke', edgeColor)} stroke-width="${edgeWidth}" stroke-linecap="round" stroke-linejoin="round"`
    out.push(`<line x1="${f1(sx)}" y1="${f1(sy)}" x2="${f1(ex - ux * lineEnd)}" y2="${f1(ey - uy * lineEnd)}" ${stroke}/>`)
    const lx = ex - ux * head - uy * head * 0.55
    const ly = ey - uy * head + ux * head * 0.55
    const rx = ex - ux * head + uy * head * 0.55
    const ry = ey - uy * head - ux * head * 0.55
    if (edgeHead === 'arrow') {
      out.push(`<path d="M${f1(ex)} ${f1(ey)}L${f1(lx)} ${f1(ly)}L${f1(rx)} ${f1(ry)}Z" ${paint('fill', edgeColor)}/>`)
    } else if (edgeHead === 'open') {
      out.push(`<path d="M${f1(lx)} ${f1(ly)}L${f1(ex)} ${f1(ey)}L${f1(rx)} ${f1(ry)}" fill="none" ${stroke}/>`)
    } else if (edgeHead === 'dot') {
      out.push(`<circle cx="${f1(ex)}" cy="${f1(ey)}" r="${f1(Math.max(2.5, edgeWidth * 1.6) * headSize)}" ${paint('fill', edgeColor)}/>`)
    }
  }

  const order = [...nodes].sort((x, y) => proj.get(y.id)!.depth - proj.get(x.id)!.depth)
  const labelOk = showLabels.value && nodes.length <= 400
  const groups = labelGroupsOf(props.data)
  order.forEach((n, i) => {
    const p = proj.get(n.id)!
    const r = R * p.scale
    const laneCol = colorOf(n.laneId)
    const done = isCompleted(n)
    const circle = `cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r)}"`
    out.push(`<circle ${circle} ${paint('fill', n.color ?? surface)}/>`)
    if (n.image) {
      out.push(
        `<clipPath id="n${i}"><circle ${circle}/></clipPath>`,
        `<image href="${n.image}" xlink:href="${n.image}" x="${f1(p.x - r)}" y="${f1(p.y - r)}" width="${f1(r * 2)}" height="${f1(r * 2)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#n${i})"/>`,
      )
    }
    if (done) out.push(`<circle ${circle} ${paint('fill', doneColor)}${n.image ? ' opacity="0.65"' : ''}/>`)
    out.push(`<circle ${circle} fill="none" ${paint('stroke', laneCol)} stroke-width="${f1(Math.max(1, 2.5 * p.scale))}"/>`)

    if (showProgress && !done && n.progress > 0) {
      const rr = r + 3 * p.scale
      const end = -Math.PI / 2 + (Math.PI * 2 * n.progress) / 100
      out.push(
        `<path d="M${f1(p.x)} ${f1(p.y - rr)}A${f1(rr)} ${f1(rr)} 0 ${n.progress > 50 ? 1 : 0} 1 ${f1(p.x + Math.cos(end) * rr)} ${f1(p.y + Math.sin(end) * rr)}" fill="none" ${paint('stroke', laneCol === 'transparent' ? accent : laneCol)} stroke-width="${f1(Math.max(2, 3.5 * p.scale))}"/>`,
      )
    }
    if (r > 7) {
      const glyph = done ? doneMark : n.image ? '' : (n.icon ?? '')
      if (glyph) {
        const px = Math.round(r * 0.95)
        const fill = done ? (isSeeThrough(doneColor) && !n.image ? textColor : '#fff') : textColor
        out.push(`<text x="${f1(p.x)}" y="${f1(p.y + px * 0.36)}" text-anchor="middle" font-size="${px}" fill="${fill}">${xml(glyph)}</text>`)
      }
    }
    if (labelOk && r > 8) {
      const textScale = Math.max(0.8, Math.min(1.2, p.scale))
      for (const g of groups) {
        if (g.visible === false) continue
        let text: string
        if (g.id === NAME_LABEL_GROUP_ID) {
          const label = n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name
          text = showProgress && !done && n.progress > 0 ? `${label} ${n.progress}%` : label
        } else {
          text = n.labels?.[g.id] ?? ''
        }
        if (!text) continue
        const rad = (labelAngle(g) * Math.PI) / 180
        const dir = { x: Math.sin(rad), y: -Math.cos(rad) }
        const reach = r + 6 * textScale
        const SIDE = 0.38
        const px = Math.round((g.size ?? LABEL_SIZE.default) * textScale)
        const anchor = dir.x > SIDE ? 'start' : dir.x < -SIDE ? 'end' : 'middle'
        // 글자 기준선: 아래쪽 라벨은 위를, 위쪽 라벨은 아래를 노드에 붙인다.
        const dyBase = dir.y > SIDE ? px * 0.85 : dir.y < -SIDE ? -px * 0.2 : px * 0.35
        const styleAttrs = [
          `font-family="${xml(LABEL_FONTS[g.font ?? 'sans'].family)}"`,
          `font-size="${px}"`,
          g.bold ? 'font-weight="700"' : '',
          g.italic ? 'font-style="italic"' : '',
          g.underline ? 'text-decoration="underline"' : '',
        ].join(' ')
        out.push(
          `<text x="${f1(p.x + dir.x * reach)}" y="${f1(p.y + dir.y * reach + dyBase)}" text-anchor="${anchor}" ${styleAttrs} ${paint('fill', g.color ?? dimColor)}>${xml(text)}</text>`,
        )
      }
    }
  })
  out.push('</g></svg>')
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
    else fit(false)
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
  if (d?.moved) commitView()
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
  commitView()
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
  if (cameraTimer) sendCamera()
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
    if (!empty && wasEmpty) fit(false)
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

    <div class="tools">
      <button :class="{ on: mode === 'pan' }" title="이동 (드래그)" @click="mode = 'pan'">✥</button>
      <button :class="{ on: mode === 'rotate' }" title="회전 (드래그, Shift 또는 우클릭 드래그도 가능)" @click="mode = 'rotate'">⟳</button>
      <button title="확대" @click="zoomBy(1.25)">＋</button>
      <button title="축소" @click="zoomBy(0.8)">－</button>
      <button class="zoom" title="지금 확대 배율. 누르면 100%(설정한 크기 그대로)로 봅니다" @click="zoomActual">{{ zoomPercent }}%</button>
      <button
        :title="!editable && camera ? '저장된 시점으로 되돌리기 (더블클릭)' : '시점 리셋: 이동·회전을 초기화하고 화면에 맞추기 (더블클릭)'"
        @click="resetView"
      >
        ⛶
      </button>
      <button :class="{ on: showLabels }" title="이름 표시" @click="showLabels = !showLabels">Aa</button>
    </div>

    <p v-if="layout.nodes.length === 0" class="empty muted">표시할 작업이 없습니다</p>
    <div v-if="selectedNode" class="info">
      <b>{{ selectedNode.icon }} {{ selectedNode.name }}</b>
      <span class="muted">{{ selectedNode.progress }}%</span>
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
.tools .zoom {
  min-width: 48px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
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
