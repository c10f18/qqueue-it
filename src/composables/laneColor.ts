import type { Lane } from '../domain'

// 카테고리 순서별 기본 강조색 (최대 5개). 사용자가 색을 고르면 그 색을 쓴다.
export const LANE_PALETTE = ['#3b7dd8', '#35b37a', '#d98a2b', '#9a55d6', '#d84a6b']

export function laneColor(index: number): string {
  return LANE_PALETTE[((index % LANE_PALETTE.length) + LANE_PALETTE.length) % LANE_PALETTE.length]
}

/** 레인의 표시 색: 지정한 색이 있으면 그 색(투명 포함), 없으면 순서별 기본 색 */
export function laneColorOf(lane: Lane | undefined, index: number): string {
  return lane?.color ?? laneColor(index)
}
