// 진행도 연산 (FR-50~54, 명세 21.2)

import { draft, requireLane, requireSlot, slotIndex } from './core'
import type { BoardData, OpResult } from './types'

/** 지정한 슬롯(포함)까지의 노드를 완료 처리한다. laneIds의 레인만 대상. */
export function bulkProgress(data: BoardData, upToSlotId: string, laneIds: string[]): OpResult {
  const d = draft(data)
  const upToIdx = requireSlot(d, upToSlotId)
  const lanes = new Set(laneIds)
  for (const n of d.nodes) {
    if (lanes.has(n.laneId) && slotIndex(d, n.slotId) <= upToIdx) n.progress = 100
  }
  return { data: d }
}

export function resetLaneProgress(data: BoardData, laneId: string): OpResult {
  const d = draft(data)
  requireLane(d, laneId)
  for (const n of d.nodes) if (n.laneId === laneId) n.progress = 0
  return { data: d }
}

/** 보드의 모든 노드 진행도를 0으로 (보드 단위 일괄 리셋) */
export function resetAllProgress(data: BoardData): OpResult {
  const d = draft(data)
  for (const n of d.nodes) n.progress = 0
  return { data: d }
}
