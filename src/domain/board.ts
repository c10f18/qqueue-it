import { DomainError, draft, normalizeColor, uid } from './core'
import { DEFAULT_LANE_NAME, GRAPH_RANGES } from './types'
import type { BoardData, GraphNumberKey, GraphStyle, ListStyle, OpResult } from './types'

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

/** 보기 모드 리스트 설정 변경. patch에 undefined로 넣은 항목은 기본값으로 되돌린다. */
export function setListStyle(data: BoardData, patch: ListStyle): OpResult {
  const d = draft(data)
  const next: ListStyle = { ...d.board.settings.list, ...patch }
  if (next.attrs) next.attrs = [...new Set(next.attrs)]
  for (const key of Object.keys(next) as (keyof ListStyle)[]) {
    if (next[key] === undefined) delete next[key]
  }
  d.board.settings.list = next
  return { data: d }
}

/** 그래프 표시 설정 변경. patch에 undefined로 넣은 항목은 기본값으로 되돌린다. */
export function setGraphStyle(data: BoardData, patch: GraphStyle): OpResult {
  const d = draft(data)
  const next: GraphStyle = { ...d.board.settings.graph, ...patch }
  for (const key of ['doneColor', 'edgeColor', 'background'] as const) {
    if (key in patch) next[key] = normalizeColor(patch[key])
  }
  for (const key of Object.keys(GRAPH_RANGES) as GraphNumberKey[]) {
    const value = next[key]
    if (value === undefined) continue
    if (!Number.isFinite(value)) throw new DomainError('invalid-argument', '크기·간격·두께는 숫자여야 합니다.')
    next[key] = Math.min(GRAPH_RANGES[key].max, Math.max(GRAPH_RANGES[key].min, value))
  }
  for (const key of Object.keys(next) as (keyof GraphStyle)[]) {
    if (next[key] === undefined) delete next[key]
  }
  d.board.settings.graph = next
  return { data: d }
}
