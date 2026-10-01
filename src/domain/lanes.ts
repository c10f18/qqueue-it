// 카테고리(레인) 연산 (FR-10~17, 명세 21.3)

import {
  DomainError,
  cleanupEmptySlots,
  draft,
  requireLane,
  slotIndex,
  sortedLanes,
  uid,
} from './core'
import { dropOnCell } from './move'
import { MAX_LANES } from './types'
import type { BoardData, OpResult } from './types'

function normalizeLaneName(d: BoardData, name: string, selfId?: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new DomainError('lane-name-empty', '카테고리 이름을 입력해 주세요.')
  if (d.lanes.some((l) => l.id !== selfId && l.name === trimmed)) {
    throw new DomainError('lane-name-duplicate', `이미 있는 카테고리 이름입니다: ${trimmed}`)
  }
  return trimmed
}

export function addLane(data: BoardData, name: string): OpResult {
  const d = draft(data)
  if (d.lanes.length >= MAX_LANES) {
    throw new DomainError('lane-max', `카테고리는 최대 ${MAX_LANES}개까지 만들 수 있습니다.`)
  }
  const lane = {
    id: uid(),
    boardId: d.board.id,
    name: normalizeLaneName(d, name),
    order: d.lanes.length,
    active: true,
  }
  d.lanes.push(lane)
  return { data: d, id: lane.id }
}

export function renameLane(data: BoardData, laneId: string, name: string): OpResult {
  const d = draft(data)
  const lane = requireLane(d, laneId)
  lane.name = normalizeLaneName(d, name, laneId)
  return { data: d }
}

export function toggleLaneActive(data: BoardData, laneId: string): OpResult {
  const d = draft(data)
  const lane = requireLane(d, laneId)
  lane.active = !lane.active
  return { data: d }
}

/** 열 순서 변경 (FR-14). toIndex는 제거 후 배열 기준 위치. */
export function reorderLane(data: BoardData, laneId: string, toIndex: number): OpResult {
  const d = draft(data)
  requireLane(d, laneId)
  const ordered = sortedLanes(d)
  const from = ordered.findIndex((l) => l.id === laneId)
  const [moved] = ordered.splice(from, 1)
  ordered.splice(Math.max(0, Math.min(toIndex, ordered.length)), 0, moved)
  ordered.forEach((l, i) => {
    d.lanes.find((x) => x.id === l.id)!.order = i
  })
  return { data: d }
}

export type DeleteLaneMode = 'deleteNodes' | 'moveTo'

/** 카테고리 삭제 (FR-11, 16, 17). 이동은 드래그와 같은 체인 밀어내기 규칙을 따른다. */
export function deleteLane(
  data: BoardData,
  laneId: string,
  mode: DeleteLaneMode = 'deleteNodes',
  targetLaneId?: string,
): OpResult {
  requireLane(data, laneId)
  if (data.lanes.length <= 1) {
    throw new DomainError('lane-min', '마지막 카테고리는 삭제할 수 없습니다.')
  }
  const affected = data.nodes.filter((n) => n.laneId === laneId)

  let d = draft(data)
  if (affected.length > 0) {
    if (mode === 'moveTo') {
      if (!targetLaneId || targetLaneId === laneId) {
        throw new DomainError('invalid-argument', '노드를 옮길 다른 카테고리를 선택해 주세요.')
      }
      requireLane(d, targetLaneId)
      const sorted = [...affected].sort((a, b) => slotIndex(data, a.slotId) - slotIndex(data, b.slotId))
      for (const n of sorted) {
        // 이전 이동으로 슬롯이 바뀌었을 수 있으므로 최신 데이터에서 슬롯을 다시 읽는다.
        const current = d.nodes.find((x) => x.id === n.id)!
        d = dropOnCell(d, n.id, current.slotId, targetLaneId).data
      }
    } else {
      d.nodes = d.nodes.filter((n) => n.laneId !== laneId)
    }
  }

  d.lanes = d.lanes.filter((l) => l.id !== laneId)
  sortedLanes(d).forEach((l, i) => {
    d.lanes.find((x) => x.id === l.id)!.order = i
  })
  for (const n of d.nodes) {
    n.linkFilter.excludedLaneIds = n.linkFilter.excludedLaneIds.filter((id) => id !== laneId)
  }
  cleanupEmptySlots(d)
  return { data: d }
}
