import type { BoardData, Lane, TaskNode } from './types'

export type DomainErrorCode =
  | 'lane-max'
  | 'lane-min'
  | 'lane-name-empty'
  | 'lane-name-duplicate'
  | 'lane-not-found'
  | 'slot-not-found'
  | 'node-not-found'
  | 'node-name-empty'
  | 'cell-occupied'
  | 'tags-max'
  | 'invalid-argument'

export class DomainError extends Error {
  code: DomainErrorCode
  constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export function uid(): string {
  return crypto.randomUUID()
}

/** 변경용 사본을 만든다. 연산은 이 사본만 수정하고 원본은 건드리지 않는다. */
export function draft(data: BoardData): BoardData {
  const copy = structuredClone(data)
  copy.board.updatedAt = Date.now()
  return copy
}

export function sortedLanes(data: BoardData): Lane[] {
  return [...data.lanes].sort((a, b) => a.order - b.order)
}

export function slotIndex(data: BoardData, slotId: string): number {
  return data.board.slotOrder.indexOf(slotId)
}

export function findNode(data: BoardData, nodeId: string): TaskNode {
  const node = data.nodes.find((n) => n.id === nodeId)
  if (!node) throw new DomainError('node-not-found', `노드를 찾을 수 없습니다: ${nodeId}`)
  return node
}

export function requireLane(data: BoardData, laneId: string): Lane {
  const lane = data.lanes.find((l) => l.id === laneId)
  if (!lane) throw new DomainError('lane-not-found', `카테고리를 찾을 수 없습니다: ${laneId}`)
  return lane
}

export function requireSlot(data: BoardData, slotId: string): number {
  const idx = slotIndex(data, slotId)
  if (idx === -1) throw new DomainError('slot-not-found', `슬롯을 찾을 수 없습니다: ${slotId}`)
  return idx
}

export function cellNode(data: BoardData, slotId: string, laneId: string): TaskNode | undefined {
  return data.nodes.find((n) => n.slotId === slotId && n.laneId === laneId)
}

/** afterSlotId 바로 뒤에 새 슬롯을 끼운다. null이면 맨 앞. (명세 18.3) */
export function insertSlotAfter(d: BoardData, afterSlotId: string | null): string {
  const idx = afterSlotId === null ? -1 : requireSlot(d, afterSlotId)
  const slot = { id: uid(), boardId: d.board.id }
  d.slots.push(slot)
  d.board.slotOrder.splice(idx + 1, 0, slot.id)
  return slot.id
}

/**
 * 노드가 0개인 슬롯을 지운다 (FR-03). 슬롯이 하나도 남지 않게 되는 경우에만 마지막 슬롯을 남긴다 (FR-02).
 * 비어 있는 채로 남는 슬롯은 항상 "보드의 유일한 슬롯"이다.
 */
export function cleanupEmptySlots(d: BoardData): void {
  const occupied = new Set(d.nodes.map((n) => n.slotId))
  const keep = d.board.slotOrder.filter((id) => occupied.has(id))
  if (keep.length === d.board.slotOrder.length) return
  if (keep.length === 0) keep.push(d.board.slotOrder.at(-1)!)
  const keepSet = new Set(keep)
  d.board.slotOrder = d.board.slotOrder.filter((id) => keepSet.has(id))
  d.slots = d.slots.filter((s) => keepSet.has(s.id))
}
