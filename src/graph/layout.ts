// 큐 그래프 배치: 슬롯 진행 방향(8방향)에 따라 슬롯 축과 레인 축을 정한다.

import type { GraphDirection } from '../domain'

export interface Vec2 {
  x: number
  y: number
}

const S = Math.SQRT1_2

/** 화면 좌표계(y가 아래로 증가) 기준 슬롯 진행 방향 단위 벡터 */
const SLOT_AXIS: Record<GraphDirection, Vec2> = {
  up: { x: 0, y: -1 },
  'up-right': { x: S, y: -S },
  right: { x: 1, y: 0 },
  'down-right': { x: S, y: S },
  down: { x: 0, y: 1 },
  'down-left': { x: -S, y: S },
  left: { x: -1, y: 0 },
  'up-left': { x: -S, y: -S },
}

export const DIRECTIONS = Object.keys(SLOT_AXIS) as GraphDirection[]

/**
 * 슬롯 축(u)과 레인 축(v). v는 u에 수직이며, 레인이 되도록 오른쪽(같으면 아래쪽)으로 늘어나게 고른다.
 * 예) 아래로 진행 → 레인은 오른쪽으로, 오른쪽으로 진행 → 레인은 아래쪽으로.
 */
export function axes(direction: GraphDirection): { u: Vec2; v: Vec2 } {
  const u = SLOT_AXIS[direction]
  let v = { x: u.y, y: -u.x }
  const EPS = 1e-9
  if (v.x < -EPS || (Math.abs(v.x) < EPS && v.y < 0)) v = { x: -v.x, y: -v.y }
  // -0 정리
  return { u, v: { x: v.x + 0, y: v.y + 0 } }
}

/** (슬롯 순번, 레인 순번) → 평면 좌표 */
export function place(
  direction: GraphDirection,
  slot: number,
  lane: number,
  slotGap: number,
  laneGap: number,
): Vec2 {
  const { u, v } = axes(direction)
  return { x: slot * slotGap * u.x + lane * laneGap * v.x, y: slot * slotGap * u.y + lane * laneGap * v.y }
}
