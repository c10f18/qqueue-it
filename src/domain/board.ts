import { DomainError, draft, normalizeColor, uid } from './core'
import { DEFAULT_LANE_NAME, DEFAULT_NODE_NAME, GRAPH_RANGES } from './types'
import type { BoardData, GraphNumberKey, GraphStyle, ListStyle, OpResult } from './types'

/** 새 보드: 기본 카테고리 "Default" 1개 + 슬롯 1개 + 그 칸에 빈 작업 1개 (FR-10, FR-62) */
export function createBoardData(name: string): BoardData {
  const now = Date.now()
  const boardId = uid()
  const slot = { id: uid(), boardId }
  const lane = { id: uid(), boardId, name: DEFAULT_LANE_NAME, order: 0, active: true }
  return {
    board: {
      id: boardId,
      name: name.trim() || '이름 없는 보드',
      slotOrder: [slot.id],
      settings: {},
      createdAt: now,
      updatedAt: now,
    },
    lanes: [lane],
    slots: [slot],
    nodes: [
      {
        id: uid(),
        boardId,
        slotId: slot.id,
        laneId: lane.id,
        name: DEFAULT_NODE_NAME,
        tags: [],
        progress: 0,
        visible: true,
        linkFilter: { touched: false, excludedLaneIds: [] },
        createdAt: now,
      },
    ],
  }
}

export function renameBoard(data: BoardData, name: string): OpResult {
  const trimmed = name.trim()
  if (!trimmed) throw new DomainError('invalid-argument', '보드 이름을 입력해 주세요.')
  const d = draft(data)
  d.board.name = trimmed
  return { data: d }
}

/** 진행도를 백분율(%)로 쓸지 정한다. 끄면 완료 체크만 쓰고 % 표시는 어디에도 나오지 않는다. */
export function setPercentMode(data: BoardData, on: boolean): OpResult {
  const d = draft(data)
  if (on) d.board.settings.percent = true
  else delete d.board.settings.percent
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
