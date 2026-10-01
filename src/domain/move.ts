// 드래그 규칙 (FR-40, 명세 6장·18장). 모두 순수 함수: BoardData → OpResult.

import {
  DomainError,
  cellNode,
  cleanupEmptySlots,
  draft,
  findNode,
  insertSlotAfter,
  requireLane,
  requireSlot,
  slotIndex,
} from './core'
import type { BoardData, OpResult } from './types'

/**
 * 셀(slotId × laneId)에 노드를 드롭한다.
 *  - 빈 셀 → 합류 (레인이 다르면 레인도 변경)
 *  - 노드가 있는 셀 → 끌어온 노드가 그 자리를 차지하고 기존 노드들은 같은 레인에서 연쇄로 밀린다.
 *    연쇄가 끝나는 곳: 끌어온 노드가 같은 레인 뒤쪽에 있었다면 그 비워진 자리, 아니면 마지막 노드 뒤의 새 슬롯.
 */
export function dropOnCell(
  data: BoardData,
  nodeId: string,
  slotId: string,
  laneId: string,
): OpResult {
  const d = draft(data)
  const dragged = findNode(d, nodeId)
  requireLane(d, laneId)
  const targetIdx = requireSlot(d, slotId)

  const occupant = cellNode(d, slotId, laneId)
  if (occupant?.id === dragged.id) return { data }

  if (!occupant) {
    dragged.slotId = slotId
    dragged.laneId = laneId
    cleanupEmptySlots(d)
    return { data: d }
  }

  const originSlotId = dragged.slotId
  const originInSameLane = dragged.laneId === laneId
  const originIdx = slotIndex(d, originSlotId)

  const laneNodes = d.nodes
    .filter((n) => n.laneId === laneId && n.id !== dragged.id)
    .sort((a, b) => slotIndex(d, a.slotId) - slotIndex(d, b.slotId))
  let displaced = laneNodes.filter((n) => slotIndex(d, n.slotId) >= targetIdx)

  // 끌어온 노드가 같은 레인의 뒤쪽에서 왔다면, 그 비워진 자리에서 연쇄가 끝난다.
  const endsAtOrigin = originInSameLane && originIdx > targetIdx
  if (endsAtOrigin) displaced = displaced.filter((n) => slotIndex(d, n.slotId) < originIdx)

  // 노드 i는 chain[i]로 이동한다. chain[0]은 끌어온 노드의 새 자리.
  const lastDisplaced = displaced.at(-1)
  const tail = endsAtOrigin
    ? originSlotId
    : insertSlotAfter(d, lastDisplaced ? lastDisplaced.slotId : slotId)
  const chain = [slotId, ...displaced.slice(1).map((n) => n.slotId), tail]

  dragged.slotId = chain[0]
  dragged.laneId = laneId
  displaced.forEach((n, i) => {
    n.slotId = chain[i + 1]
  })

  cleanupEmptySlots(d)
  return { data: d }
}

/**
 * 슬롯 사이 경계선에 드롭: 새 슬롯을 만들고 해당 레인에 단독 배치.
 * afterSlotId가 null이면 맨 앞 경계.
 */
export function dropOnBoundary(
  data: BoardData,
  nodeId: string,
  afterSlotId: string | null,
  laneId: string,
): OpResult {
  const d = draft(data)
  const dragged = findNode(d, nodeId)
  requireLane(d, laneId)
  const newSlotId = insertSlotAfter(d, afterSlotId)
  dragged.slotId = newSlotId
  dragged.laneId = laneId
  cleanupEmptySlots(d)
  return { data: d }
}

/** 슬롯(행) 전체 이동: slotOrder 배열만 재정렬한다. toIndex는 제거 후 배열 기준 위치. */
export function moveSlot(data: BoardData, slotId: string, toIndex: number): OpResult {
  const d = draft(data)
  const from = requireSlot(d, slotId)
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= d.board.slotOrder.length) {
    throw new DomainError('invalid-argument', `잘못된 슬롯 위치: ${toIndex}`)
  }
  d.board.slotOrder.splice(from, 1)
  d.board.slotOrder.splice(toIndex, 0, slotId)
  return { data: d }
}
