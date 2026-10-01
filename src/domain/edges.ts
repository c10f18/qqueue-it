// 파생 엣지 계산 (FR-07, FR-30~32, 명세 20장). 저장하지 않고 호출할 때마다 계산한다.

import { sortedLanes } from './core'
import type { BoardData, TaskNode } from './types'

export interface DerivedEdge {
  from: string
  to: string
}

/** 화면에 표시되는 노드: 표시 상태이고 활성 카테고리에 속한 노드 (FR-15, FR-79) */
export function shownNodes(data: BoardData): TaskNode[] {
  const active = new Set(data.lanes.filter((l) => l.active).map((l) => l.id))
  return data.nodes.filter((n) => n.visible && active.has(n.laneId))
}

/**
 * 표시되는 노드끼리의 엣지를 계산한다.
 *  - 링크 필터를 건드리지 않은 노드: 다음 슬롯의 모든 노드에 연결 (FR-30)
 *  - 건드린 노드: 체크된 레인마다 그 이후 가장 가까운 노드에 연결 (FR-31)
 * 숨겨진 노드·비활성 레인만 있는 슬롯은 "다음 슬롯"으로 치지 않고 건너뛴다.
 */
export function computeDerivedEdges(data: BoardData): DerivedEdge[] {
  const nodes = shownNodes(data)
  const bySlot = new Map<string, TaskNode[]>()
  for (const n of nodes) {
    const list = bySlot.get(n.slotId)
    if (list) list.push(n)
    else bySlot.set(n.slotId, [n])
  }
  // 표시되는 노드가 있는 슬롯만, 진행 순서대로
  const slots = data.board.slotOrder.filter((id) => bySlot.has(id))
  const slotPos = new Map(slots.map((id, i) => [id, i]))
  const activeLaneIds = sortedLanes(data)
    .filter((l) => l.active)
    .map((l) => l.id)

  const edges: DerivedEdge[] = []
  for (const n of nodes) {
    const pos = slotPos.get(n.slotId)!

    if (!n.linkFilter.touched) {
      const next = slots[pos + 1]
      for (const target of next ? bySlot.get(next)! : []) edges.push({ from: n.id, to: target.id })
      continue
    }

    const excluded = new Set(n.linkFilter.excludedLaneIds)
    for (const laneId of activeLaneIds) {
      if (excluded.has(laneId)) continue
      for (let i = pos + 1; i < slots.length; i++) {
        const candidate = bySlot.get(slots[i])!.find((x) => x.laneId === laneId)
        if (candidate) {
          edges.push({ from: n.id, to: candidate.id })
          break
        }
      }
    }
  }
  return edges
}
