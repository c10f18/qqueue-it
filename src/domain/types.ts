// 명세 17.3 레코드 타입. (DOM의 Node와 이름이 겹치지 않도록 TaskNode로 표기)

export interface Board {
  id: string
  name: string
  /** 슬롯 ID 배열. 이 순서 = 진행 순서 (FR-01, FR-04) */
  slotOrder: string[]
  settings: { showSlotNumbers: boolean }
  createdAt: number
  updatedAt: number
}

export interface Lane {
  id: string
  boardId: string
  /** 보드 내 중복 불가 (FR-12) */
  name: string
  /** 0~4, 열 순서 (FR-14) */
  order: number
  /** FR-15 */
  active: boolean
}

export interface Slot {
  id: string
  boardId: string
  // 순번 없음 — board.slotOrder 안에서의 위치가 곧 순번 (FR-04)
}

export interface LinkFilter {
  /** false면 다음 슬롯 전체 연결 (FR-30), true면 레인별 가장 가까운 노드 (FR-31) */
  touched: boolean
  excludedLaneIds: string[]
}

export interface TaskNode {
  id: string
  boardId: string
  slotId: string
  /** = 카테고리 (FR-06) */
  laneId: string
  name: string
  description?: string
  icon?: string
  /** 최대 5개 (명세 17.4) */
  tags: string[]
  /** 0~100. 100이면 완료 (FR-53) — 완료여부는 저장하지 않는다 */
  progress: number
  /** 순수 카운터 (FR-54) */
  count: number
  /** FR-79 */
  visible: boolean
  /** epoch ms, 정렬용만 (NFR-04) */
  deadline?: number
  linkFilter: LinkFilter
  createdAt: number
}

/** 보드 하나의 전체 데이터. 도메인 연산은 이 값을 받아 새 값을 돌려준다. */
export interface BoardData {
  board: Board
  lanes: Lane[]
  slots: Slot[]
  nodes: TaskNode[]
}

export interface Template {
  id: string
  name: string
  snapshot: {
    lanes: Omit<Lane, 'id' | 'boardId'>[]
    slotCount: number
    nodes: (Omit<TaskNode, 'id' | 'boardId' | 'slotId' | 'laneId'> & {
      slotIndex: number
      laneIndex: number
    })[]
  }
  updatedAt: number
}

/** 연산 결과. 새로 만든 엔티티가 있으면 id로 알려준다. */
export interface OpResult {
  data: BoardData
  id?: string
}

export const MAX_LANES = 5
export const MAX_TAGS = 5
export const DEFAULT_LANE_NAME = 'Default'
export const DEFAULT_NODE_NAME = '새 작업'

export function isCompleted(node: TaskNode): boolean {
  return node.progress === 100
}
