// 큐 그래프용 3D 투영 (명세 16장: Canvas 2D, 회전은 Y→X→원근 순서의 회전 행렬을 직접 계산).
// 좌표는 이미 슬롯/레인으로 정해져 있어 자동 배치가 필요 없고, 조명/재질 없이 점·선만 그린다.

export interface View {
  /** Y축 회전(좌우), 라디안 */
  yaw: number
  /** X축 회전(상하), 라디안 */
  pitch: number
  zoom: number
  panX: number
  panY: number
}

export interface Point3 {
  x: number
  y: number
  z: number
}

export interface Projected {
  x: number
  y: number
  /** 원근에 따른 배율 (가까울수록 큼) */
  scale: number
  /** 클수록 멀다 — 그리는 순서 정렬용 */
  depth: number
}

const FOCAL = 1200
const MAX_PITCH = Math.PI / 2 - 0.05

export const DEFAULT_VIEW: View = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 }

export function clampPitch(pitch: number): number {
  return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch))
}

/** 회전 행렬을 매번 만들지 않도록 sin/cos를 미리 계산해 둔다. */
export function makeProjector(view: View, width: number, height: number) {
  const cy = Math.cos(view.yaw)
  const sy = Math.sin(view.yaw)
  const cx = Math.cos(view.pitch)
  const sx = Math.sin(view.pitch)
  const originX = width / 2 + view.panX
  const originY = height / 2 + view.panY

  return (p: Point3): Projected => {
    // 1) Y축 회전
    const x1 = p.x * cy + p.z * sy
    const z1 = -p.x * sy + p.z * cy
    // 2) X축 회전
    const y2 = p.y * cx - z1 * sx
    const z2 = p.y * sx + z1 * cx
    // 3) 원근
    const scale = FOCAL / (FOCAL + z2)
    return {
      x: originX + x1 * scale * view.zoom,
      y: originY + y2 * scale * view.zoom,
      scale: scale * view.zoom,
      depth: z2,
    }
  }
}

/** 포인트 집합의 경계에 맞는 zoom (회전 없이 보이는 평면 기준) */
export function fitZoom(points: Point3[], width: number, height: number, padding = 56): number {
  if (points.length === 0) return 1
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const w = Math.max(maxX - minX, 1)
  const h = Math.max(maxY - minY, 1)
  const zoom = Math.min((width - padding * 2) / w, (height - padding * 2) / h)
  return Math.max(0.2, Math.min(zoom, 1.6))
}
