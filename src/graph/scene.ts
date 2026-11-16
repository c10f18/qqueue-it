// 큐 그래프의 "그릴 목록". 무엇을 어디에 그릴지는 여기서 한 번만 계산하고,
// 화면(Canvas)과 내보내기(SVG)는 같은 목록을 각자의 방식으로 그리기만 한다.

import { LABEL_SIZE, NAME_LABEL_GROUP_ID, isCompleted, labelAngle } from '../domain'
import type { DoneMark, EdgeHead, LabelGroup, TaskNode } from '../domain'
import { fontOption } from './labelFont'

export type Shape =
  | { kind: 'circle'; x: number; y: number; r: number; fill?: string; stroke?: string; width?: number; opacity?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }
  /** sharp: 꺾이는 곳과 끝을 둥글리지 않는다 */
  | { kind: 'poly'; points: [number, number][]; closed: boolean; fill?: string; stroke?: string; width?: number; sharp?: boolean }
  | { kind: 'arc'; x: number; y: number; r: number; from: number; to: number; stroke: string; width: number }
  /** 원 모양으로 잘라 넣는 사진 */
  | { kind: 'image'; src: string; x: number; y: number; r: number }
  | {
      kind: 'text'
      x: number
      y: number
      text: string
      family: string
      size: number
      bold?: boolean
      italic?: boolean
      underline?: boolean
      fill: string
      align: 'left' | 'center' | 'right'
      baseline: 'top' | 'middle' | 'bottom'
    }

/** 화면에 투영된 점: 좌표, 원근 배율, 깊이(클수록 멀다) */
export interface ScenePoint {
  x: number
  y: number
  scale: number
  depth: number
}

export interface SceneInput {
  /** 보이는 노드와 각 노드의 투영 위치 */
  nodes: TaskNode[]
  point: (nodeId: string) => ScenePoint
  /** 레인 머리글 */
  heads: { name: string; color: string; point: ScenePoint }[]
  edges: { from: string; to: string }[]
  laneColorOf: (laneId: string) => string
  /** 라벨 그룹 (앞선 그룹이 위에 그려진다) */
  groups: LabelGroup[]
  /** 테마 색 */
  theme: { text: string; dim: string; surface: string; accent: string; ok: string; border: string }
  nodeRadius: number
  doneColor?: string
  doneMark: DoneMark
  /** 완료 표시로 쓸 이미지 (doneMark가 'image'일 때) */
  doneImage?: string
  edgeColor?: string
  edgeWidth: number
  edgeHead: EdgeHead
  edgeHeadSize: number
  /** 진행률(링·% 글자)을 그릴지 */
  showProgress: boolean
  showLabels: boolean
  /** 강조할(선택한) 노드. 내보낼 때는 null */
  selectedId: string | null
}

const SYSTEM_FONT = 'system-ui, sans-serif'
// 체크와 엑스는 글자가 아니라 직선으로 그린다(글꼴에 따라 둥글게 보이지 않도록). 나머지는 글자.
const DONE_GLYPHS: Partial<Record<DoneMark, string>> = { star: '★', dot: '●' }
/** 이 수를 넘으면 라벨은 그리지 않는다 (노드가 아주 많을 때 가볍게) */
const MAX_LABELED_NODES = 400

/** 색이 (거의) 투명한지 — 그 위에 얹는 글자색을 고를 때 쓴다 */
function isSeeThrough(color: string): boolean {
  if (color === 'transparent') return true
  return color.length === 9 && parseInt(color.slice(7, 9), 16) < 128
}

function edgeShapes(a: ScenePoint, b: ScenePoint, ra: number, rb: number, color: string, width: number, kind: EdgeHead, headSize: number): Shape[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < ra + rb + 2) return []
  const ux = dx / len
  const uy = dy / len
  const sx = a.x + ux * ra
  const sy = a.y + uy * ra
  const ex = b.x - ux * (rb + 2)
  const ey = b.y - uy * (rb + 2)
  const head = Math.max(6, 5 + width * 2.2) * headSize
  // 채운 화살표는 선이 촉 안쪽에서 끝나야 끝이 뭉툭해지지 않는다.
  const lineEnd = kind === 'arrow' ? head * 0.8 : 0
  const shapes: Shape[] = [{ kind: 'line', x1: sx, y1: sy, x2: ex - ux * lineEnd, y2: ey - uy * lineEnd, stroke: color, width }]

  const left: [number, number] = [ex - ux * head - uy * head * 0.55, ey - uy * head + ux * head * 0.55]
  const right: [number, number] = [ex - ux * head + uy * head * 0.55, ey - uy * head - ux * head * 0.55]
  if (kind === 'arrow') shapes.push({ kind: 'poly', points: [[ex, ey], left, right], closed: true, fill: color })
  else if (kind === 'open') shapes.push({ kind: 'poly', points: [left, [ex, ey], right], closed: false, stroke: color, width })
  else if (kind === 'dot') shapes.push({ kind: 'circle', x: ex, y: ey, r: Math.max(2.5, width * 1.6) * headSize, fill: color })
  return shapes
}

/** 그리는 순서대로 나열한 도형 목록을 만든다: 레인 머리글 → 화살표 → 노드(먼 것부터) */
export function buildScene(input: SceneInput): Shape[] {
  const { theme, nodes, point, selectedId: sel } = input
  const shapes: Shape[] = []
  const R = input.nodeRadius
  const doneColor = input.doneColor ?? theme.ok
  const edgeColor = input.edgeColor ?? theme.border

  for (const head of input.heads) {
    shapes.push({
      kind: 'text',
      x: head.point.x,
      y: head.point.y,
      text: head.name,
      family: SYSTEM_FONT,
      size: 13,
      bold: true,
      fill: head.color === 'transparent' ? theme.dim : head.color,
      align: 'center',
      baseline: 'middle',
    })
  }

  const shown = new Set(nodes.map((n) => n.id))
  for (const e of input.edges) {
    if (!shown.has(e.from) || !shown.has(e.to)) continue
    const a = point(e.from)
    const b = point(e.to)
    // 선택한 노드와 이어진 화살표는 강조한다.
    const hot = sel !== null && (e.from === sel || e.to === sel)
    shapes.push(
      ...edgeShapes(a, b, R * a.scale, R * b.scale, hot ? theme.accent : edgeColor, hot ? input.edgeWidth + 0.8 : input.edgeWidth, input.edgeHead, input.edgeHeadSize),
    )
  }

  // 먼 노드부터 그려 가까운 노드가 위에 오게 한다.
  const order = [...nodes].sort((x, y) => point(y.id).depth - point(x.id).depth)
  const labelOk = input.showLabels && nodes.length <= MAX_LABELED_NODES
  // 순서가 앞선 그룹이 위에 오도록 뒤에서부터 그린다.
  const groups = [...input.groups].reverse()

  for (const n of order) {
    const p = point(n.id)
    const r = R * p.scale
    const laneColor = input.laneColorOf(n.laneId)
    const done = isCompleted(n)

    // 채움: 사진 > 단색 > 기본
    shapes.push({ kind: 'circle', x: p.x, y: p.y, r, fill: n.color ?? theme.surface })
    if (n.image) shapes.push({ kind: 'image', src: n.image, x: p.x, y: p.y, r })
    if (done) shapes.push({ kind: 'circle', x: p.x, y: p.y, r, fill: doneColor, opacity: n.image ? 0.65 : 1 })
    shapes.push({ kind: 'circle', x: p.x, y: p.y, r, stroke: n.id === sel ? theme.accent : laneColor, width: Math.max(1, 2.5 * p.scale) })

    if (input.showProgress && !done && n.progress > 0) {
      shapes.push({
        kind: 'arc',
        x: p.x,
        y: p.y,
        r: r + 3 * p.scale,
        from: -Math.PI / 2,
        to: -Math.PI / 2 + (Math.PI * 2 * n.progress) / 100,
        stroke: laneColor === 'transparent' ? theme.accent : laneColor,
        width: Math.max(2, 3.5 * p.scale),
      })
    }

    // 가운데: 완료 표시(직선 체크·엑스, 사용자 이미지, 글자) 또는 노드 아이콘
    if (r > 7) {
      const markColor = isSeeThrough(doneColor) && !n.image ? theme.text : '#fff'
      const stroke = Math.max(1.5, r * 0.15)
      if (done && input.doneMark === 'check') {
        shapes.push({
          kind: 'poly',
          points: [
            [p.x - r * 0.42, p.y + r * 0.03],
            [p.x - r * 0.12, p.y + r * 0.33],
            [p.x + r * 0.44, p.y - r * 0.3],
          ],
          closed: false,
          stroke: markColor,
          width: stroke,
          sharp: true,
        })
      } else if (done && input.doneMark === 'x') {
        const k = r * 0.34
        for (const sign of [1, -1]) {
          shapes.push({
            kind: 'poly',
            points: [
              [p.x - k, p.y - k * sign],
              [p.x + k, p.y + k * sign],
            ],
            closed: false,
            stroke: markColor,
            width: stroke,
            sharp: true,
          })
        }
      } else if (done && input.doneMark === 'image' && input.doneImage) {
        shapes.push({ kind: 'image', src: input.doneImage, x: p.x, y: p.y, r: r * 0.66 })
      }
      const glyph = done ? (DONE_GLYPHS[input.doneMark] ?? '') : n.image ? '' : (n.icon ?? '')
      if (glyph) {
        shapes.push({
          kind: 'text',
          x: p.x,
          y: p.y + 1,
          text: glyph,
          family: SYSTEM_FONT,
          size: Math.round(r * 0.95),
          fill: done ? markColor : theme.text,
          align: 'center',
          baseline: 'middle',
        })
      }
    }

    // 라벨 그룹: 각도(0 = 위, 시계 방향)로 노드 둘레의 한 점을 잡고, 글자가 노드 바깥으로 뻗도록 정렬한다.
    if (labelOk && r > 8) {
      const textScale = Math.max(0.8, Math.min(1.2, p.scale))
      for (const g of groups) {
        if (g.visible === false) continue
        let text: string
        if (g.id === NAME_LABEL_GROUP_ID) {
          const label = n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name
          text = input.showProgress && !done && n.progress > 0 ? `${label} ${n.progress}%` : label
        } else {
          text = n.labels?.[g.id] ?? ''
        }
        if (!text) continue
        const rad = (labelAngle(g) * Math.PI) / 180
        const dir = { x: Math.sin(rad), y: -Math.cos(rad) }
        const reach = r + 6 * textScale
        const SIDE = 0.38
        shapes.push({
          kind: 'text',
          x: p.x + dir.x * reach,
          y: p.y + dir.y * reach,
          text,
          family: fontOption(g.font).family,
          size: Math.round((g.size ?? LABEL_SIZE.default) * textScale),
          bold: g.bold,
          italic: g.italic,
          underline: g.underline,
          fill: g.color ?? (n.id === sel ? theme.accent : theme.dim),
          align: dir.x > SIDE ? 'left' : dir.x < -SIDE ? 'right' : 'center',
          baseline: dir.y > SIDE ? 'top' : dir.y < -SIDE ? 'bottom' : 'middle',
        })
      }
    }
  }
  return shapes
}

// ── Canvas ────────────────────────────────────────────────
function cssFont(s: Extract<Shape, { kind: 'text' }>): string {
  return `${s.italic ? 'italic ' : ''}${s.bold ? '700 ' : ''}${s.size}px ${s.family}`
}

/** 목록을 캔버스에 그린다. imageFor는 사진이 아직 안 불러와졌으면 null을 돌려준다. */
export function renderCanvas(ctx: CanvasRenderingContext2D, shapes: Shape[], imageFor: (src: string) => CanvasImageSource | null) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of shapes) {
    switch (s.kind) {
      case 'circle':
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        if (s.fill && s.fill !== 'transparent') {
          ctx.globalAlpha = s.opacity ?? 1
          ctx.fillStyle = s.fill
          ctx.fill()
          ctx.globalAlpha = 1
        }
        if (s.stroke && s.stroke !== 'transparent') {
          ctx.lineWidth = s.width ?? 1
          ctx.strokeStyle = s.stroke
          ctx.stroke()
        }
        break
      case 'line':
        if (s.stroke === 'transparent') break
        ctx.beginPath()
        ctx.moveTo(s.x1, s.y1)
        ctx.lineTo(s.x2, s.y2)
        ctx.lineWidth = s.width
        ctx.strokeStyle = s.stroke
        ctx.stroke()
        break
      case 'poly':
        ctx.beginPath()
        s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        if (s.closed) ctx.closePath()
        if (s.fill && s.fill !== 'transparent') {
          ctx.fillStyle = s.fill
          ctx.fill()
        }
        if (s.stroke && s.stroke !== 'transparent') {
          ctx.lineWidth = s.width ?? 1
          ctx.strokeStyle = s.stroke
          if (s.sharp) {
            ctx.lineCap = 'butt'
            ctx.lineJoin = 'miter'
          }
          ctx.stroke()
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
        }
        break
      case 'arc':
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, s.from, s.to)
        ctx.lineWidth = s.width
        ctx.strokeStyle = s.stroke
        ctx.stroke()
        break
      case 'image': {
        const img = imageFor(s.src)
        if (!img) break
        ctx.save()
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(img, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2)
        ctx.restore()
        break
      }
      case 'text': {
        if (s.fill === 'transparent') break
        ctx.font = cssFont(s)
        ctx.textAlign = s.align
        ctx.textBaseline = s.baseline
        ctx.fillStyle = s.fill
        ctx.fillText(s.text, s.x, s.y)
        if (s.underline) {
          // 캔버스에는 밑줄이 없어서 글자 아래에 선을 직접 긋는다.
          const width = ctx.measureText(s.text).width
          const left = s.align === 'left' ? s.x : s.align === 'right' ? s.x - width : s.x - width / 2
          const bottom = s.baseline === 'top' ? s.y + s.size : s.baseline === 'bottom' ? s.y : s.y + s.size / 2
          ctx.fillRect(left, bottom + 1, width, Math.max(1, s.size / 14))
        }
        break
      }
    }
  }
}

// ── SVG ───────────────────────────────────────────────────
export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
/** 색 → SVG 속성. '#rrggbbaa'는 불투명도 속성으로 나눠 쓴다. */
export function svgPaint(attr: 'fill' | 'stroke', color: string | undefined): string {
  if (!color || color === 'transparent') return `${attr}="none"`
  if (/^#[0-9a-f]{8}$/i.test(color)) {
    return `${attr}="${color.slice(0, 7)}" ${attr}-opacity="${(parseInt(color.slice(7), 16) / 255).toFixed(3)}"`
  }
  return `${attr}="${color}"`
}
const f1 = (n: number) => n.toFixed(1)

/** 목록을 SVG 요소들로 바꾼다 (바깥의 svg 태그는 부르는 쪽이 감싼다). */
export function renderSvg(shapes: Shape[]): string {
  const out: string[] = []
  let clipId = 0
  for (const s of shapes) {
    switch (s.kind) {
      case 'circle':
        out.push(
          `<circle cx="${f1(s.x)}" cy="${f1(s.y)}" r="${f1(s.r)}" ${svgPaint('fill', s.fill)}${s.opacity !== undefined && s.opacity < 1 ? ` opacity="${s.opacity}"` : ''}${
            s.stroke ? ` ${svgPaint('stroke', s.stroke)} stroke-width="${f1(s.width ?? 1)}"` : ''
          }/>`,
        )
        break
      case 'line':
        out.push(
          `<line x1="${f1(s.x1)}" y1="${f1(s.y1)}" x2="${f1(s.x2)}" y2="${f1(s.y2)}" ${svgPaint('stroke', s.stroke)} stroke-width="${s.width}" stroke-linecap="round"/>`,
        )
        break
      case 'poly': {
        const d = s.points.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('') + (s.closed ? 'Z' : '')
        out.push(
          `<path d="${d}" ${svgPaint('fill', s.fill)}${s.stroke ? ` ${svgPaint('stroke', s.stroke)} stroke-width="${s.width ?? 1}" stroke-linecap="${s.sharp ? 'butt' : 'round'}" stroke-linejoin="${s.sharp ? 'miter' : 'round'}"` : ''}/>`,
        )
        break
      }
      case 'arc': {
        const x1 = s.x + Math.cos(s.from) * s.r
        const y1 = s.y + Math.sin(s.from) * s.r
        const x2 = s.x + Math.cos(s.to) * s.r
        const y2 = s.y + Math.sin(s.to) * s.r
        const large = s.to - s.from > Math.PI ? 1 : 0
        out.push(
          `<path d="M${f1(x1)} ${f1(y1)}A${f1(s.r)} ${f1(s.r)} 0 ${large} 1 ${f1(x2)} ${f1(y2)}" fill="none" ${svgPaint('stroke', s.stroke)} stroke-width="${f1(s.width)}" stroke-linecap="round"/>`,
        )
        break
      }
      case 'image': {
        const id = `clip${clipId++}`
        out.push(
          `<clipPath id="${id}"><circle cx="${f1(s.x)}" cy="${f1(s.y)}" r="${f1(s.r)}"/></clipPath>`,
          `<image href="${s.src}" xlink:href="${s.src}" x="${f1(s.x - s.r)}" y="${f1(s.y - s.r)}" width="${f1(s.r * 2)}" height="${f1(s.r * 2)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`,
        )
        break
      }
      case 'text': {
        // SVG에는 캔버스의 기준선 설정이 없어서 글자 크기만큼 내려 맞춘다.
        const dy = s.baseline === 'top' ? s.size * 0.85 : s.baseline === 'bottom' ? -s.size * 0.2 : s.size * 0.35
        const anchor = s.align === 'left' ? 'start' : s.align === 'right' ? 'end' : 'middle'
        const attrs = [
          `font-family="${escapeXml(s.family)}"`,
          `font-size="${s.size}"`,
          s.bold ? 'font-weight="700"' : '',
          s.italic ? 'font-style="italic"' : '',
          s.underline ? 'text-decoration="underline"' : '',
        ]
          .filter(Boolean)
          .join(' ')
        out.push(`<text x="${f1(s.x)}" y="${f1(s.y + dy)}" text-anchor="${anchor}" ${attrs} ${svgPaint('fill', s.fill)}>${escapeXml(s.text)}</text>`)
        break
      }
    }
  }
  return out.join('\n')
}
