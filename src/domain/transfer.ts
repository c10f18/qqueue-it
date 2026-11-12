// JSON 내보내기·가져오기. 가져온 보드는 항상 새 보드로 만든다(기존 보드를 덮어쓰지 않는다).

import { DomainError, uid } from './core'
import { MAX_LANES } from './types'
import type { BoardData, Lane, TaskNode } from './types'

export const EXPORT_FORMAT = 'qqueue-it/board'
export const EXPORT_VERSION = 1

export interface BoardExport {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: number
  data: BoardData
}

export function exportBoard(data: BoardData): BoardExport {
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: Date.now(), data }
}

function fail(message: string): never {
  throw new DomainError('invalid-argument', `가져올 수 없는 파일입니다: ${message}`)
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 내보낸 JSON(또는 BoardData 그대로)을 검사하고, 모든 id를 새로 발급한 새 보드로 바꾼다.
 * 진행도·라벨·색·그래프 설정은 그대로 유지한다.
 */
export function importBoardData(raw: unknown): BoardData {
  if (!isObject(raw)) fail('JSON 객체가 아닙니다.')
  if ('format' in raw && raw.format !== EXPORT_FORMAT) fail('뀨잇 보드 파일이 아닙니다.')
  const src = (isObject(raw.data) ? raw.data : raw) as Partial<BoardData>

  const board = src.board
  if (!isObject(board) || typeof board.name !== 'string' || !Array.isArray(board.slotOrder)) fail('보드 정보가 없습니다.')
  if (!Array.isArray(src.lanes) || !Array.isArray(src.nodes)) fail('카테고리 또는 작업 목록이 없습니다.')
  if (src.lanes.length < 1 || src.lanes.length > MAX_LANES) fail(`카테고리는 1~${MAX_LANES}개여야 합니다.`)

  const now = Date.now()
  const boardId = uid()
  const slotIds = new Map<string, string>()
  for (const id of board.slotOrder) {
    if (typeof id !== 'string' || slotIds.has(id)) fail('슬롯 순서가 잘못되었습니다.')
    slotIds.set(id, uid())
  }
  if (slotIds.size === 0) fail('슬롯이 없습니다.')

  const laneIds = new Map<string, string>()
  const lanes: Lane[] = [...src.lanes]
    .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
    .map((l, i) => {
      if (!isObject(l) || typeof l.id !== 'string' || typeof l.name !== 'string' || laneIds.has(l.id)) fail('카테고리 정보가 잘못되었습니다.')
      const id = uid()
      laneIds.set(l.id, id)
      return { id, boardId, name: l.name, order: i, active: l.active !== false, ...(typeof l.color === 'string' ? { color: l.color } : {}) }
    })

  const taken = new Set<string>()
  const nodes: TaskNode[] = src.nodes.map((n) => {
    if (!isObject(n) || typeof n.name !== 'string') fail('작업 정보가 잘못되었습니다.')
    const slotId = slotIds.get(n.slotId as string)
    const laneId = laneIds.get(n.laneId as string)
    if (!slotId || !laneId) fail(`"${n.name}" 작업의 슬롯 또는 카테고리를 찾을 수 없습니다.`)
    const cell = `${slotId}/${laneId}`
    if (taken.has(cell)) fail(`"${n.name}" 작업이 다른 작업과 같은 칸에 있습니다.`)
    taken.add(cell)
    const progress = Number(n.progress)
    const filter: Record<string, unknown> = isObject(n.linkFilter) ? n.linkFilter : {}
    const excluded: unknown[] = Array.isArray(filter.excludedLaneIds) ? filter.excludedLaneIds : []
    return {
      ...(structuredClone(n) as unknown as TaskNode),
      id: uid(),
      boardId,
      slotId,
      laneId,
      tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === 'string') : [],
      progress: Number.isFinite(progress) ? Math.min(100, Math.max(0, Math.round(progress))) : 0,
      count: Number.isFinite(Number(n.count)) ? Number(n.count) : 0,
      visible: n.visible !== false,
      linkFilter: {
        touched: filter.touched === true,
        excludedLaneIds: excluded.map((id) => laneIds.get(id as string)).filter((id): id is string => !!id),
      },
      createdAt: typeof n.createdAt === 'number' ? n.createdAt : now,
    }
  })

  const settings = isObject(board.settings) ? structuredClone(board.settings) : {}
  return {
    board: {
      id: boardId,
      name: board.name.trim() || '가져온 보드',
      slotOrder: [...slotIds.values()],
      settings: { ...settings, showSlotNumbers: true } as BoardData['board']['settings'],
      createdAt: now,
      updatedAt: now,
    },
    lanes,
    slots: [...slotIds.values()].map((id) => ({ id, boardId })),
    nodes,
  }
}
