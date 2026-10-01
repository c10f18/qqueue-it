import { DomainError, draft, uid } from './core'
import { DEFAULT_LANE_NAME } from './types'
import type { BoardData, OpResult } from './types'

/** 새 보드: 기본 카테고리 "Default" 1개 + 최초 슬롯 1개 (FR-10, FR-62) */
export function createBoardData(name: string): BoardData {
  const now = Date.now()
  const boardId = uid()
  const slot = { id: uid(), boardId }
  return {
    board: {
      id: boardId,
      name: name.trim() || '이름 없는 보드',
      slotOrder: [slot.id],
      settings: { showSlotNumbers: true },
      createdAt: now,
      updatedAt: now,
    },
    lanes: [{ id: uid(), boardId, name: DEFAULT_LANE_NAME, order: 0, active: true }],
    slots: [slot],
    nodes: [],
  }
}

export function renameBoard(data: BoardData, name: string): OpResult {
  const trimmed = name.trim()
  if (!trimmed) throw new DomainError('invalid-argument', '보드 이름을 입력해 주세요.')
  const d = draft(data)
  d.board.name = trimmed
  return { data: d }
}

export function setShowSlotNumbers(data: BoardData, show: boolean): OpResult {
  const d = draft(data)
  d.board.settings.showSlotNumbers = show
  return { data: d }
}
