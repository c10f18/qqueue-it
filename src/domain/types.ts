// 명세 17.3 레코드 타입. (DOM의 Node와 이름이 겹치지 않도록 TaskNode로 표기)

export interface Board {
  id: string
  name: string
  /** 슬롯 ID 배열. 이 순서 = 진행 순서 (FR-01, FR-04) */
  slotOrder: string[]
  settings: { showSlotNumbers: boolean; graph?: GraphStyle }
  createdAt: number
  updatedAt: number
}

export type GraphDirection =
  | 'up'
  | 'up-right'
  | 'right'
  | 'down-right'
  | 'down'
  | 'down-left'
  | 'left'
  | 'up-left'
export type DoneMark = 'check' | 'x' | 'star' | 'dot' | 'none'
export type EdgeHead = 'arrow' | 'open' | 'dot' | 'none'

/** 큐 그래프 표시 설정. 비어 있는 항목은 기본값(테마 색)을 쓴다. 색은 '#rrggbb', '#rrggbbaa', 'transparent'. */
export interface GraphStyle {
  /** 슬롯이 진행되는 방향 (8방향) */
  direction?: GraphDirection
  doneColor?: string
  doneMark?: DoneMark
  /** 노드에 진행률 링을 표시할지 */
  showProgress?: boolean
  edgeColor?: string
  edgeHead?: EdgeHead
  edgeWidth?: number
  /** 화살표 끝 크기 배율 (1 = 기본) */
  edgeHeadSize?: number
  background?: string
  /** 노드 반지름(px) */
  nodeSize?: number
  /** 슬롯(노드) 간 간격 */
  slotGap?: number
  /** 레인 간 간격 */
  laneGap?: number
  /** 노드 라벨 그룹. 없으면 기본 그룹(이름) 1개 */
  labelGroups?: LabelGroup[]
}

/** 노드 둘레에 표시하는 글자 줄 하나의 설정 */
export interface LabelGroup {
  /** 첫 그룹(작업 이름)은 NAME_LABEL_GROUP_ID */
  id: string
  name: string
  /** 노드를 기준으로 글자가 놓이는 방향 */
  position: GraphDirection
  color?: string
  /** 글자 크기(px) */
  size?: number
}
export const NAME_LABEL_GROUP_ID = 'name'
export const MAX_LABEL_GROUPS = 8
export const LABEL_SIZE = { min: 8, max: 28, step: 1, default: 12 } as const

/** 그래프 설정의 숫자 항목: 허용 범위와 기본값 */
export const GRAPH_RANGES = {
  edgeWidth: { min: 0.5, max: 8, step: 0.5, default: 1.5 },
  edgeHeadSize: { min: 0.5, max: 3, step: 0.25, default: 1 },
  nodeSize: { min: 8, max: 40, step: 2, default: 16 },
  slotGap: { min: 60, max: 320, step: 10, default: 130 },
  laneGap: { min: 60, max: 320, step: 10, default: 150 },
} as const
export type GraphNumberKey = keyof typeof GRAPH_RANGES

export interface Lane {
  id: string
  boardId: string
  /** 보드 내 중복 불가 (FR-12) */
  name: string
  /** 0~4, 열 순서 (FR-14) */
  order: number
  /** FR-15 */
  active: boolean
  /** 사용자가 고른 레인 색. 없으면 순서별 기본 색 */
  color?: string
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
  /** 노드 단색 채움 */
  color?: string
  /** 첨부 사진 (축소한 data URL) */
  image?: string
  /** 최대 5개 (명세 17.4) */
  tags: string[]
  /** 추가 라벨 그룹별 글자 (그룹 id → 글자) */
  labels?: Record<string, string>
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
    graph?: GraphStyle
    nodes: (Omit<TaskNode, 'id' | 'boardId' | 'slotId' | 'laneId' | 'linkFilter'> & {
      slotIndex: number
      laneIndex: number
      /** 레인 ID는 새 보드에서 달라지므로 열 순서(index)로 저장한다 */
      linkFilter: { touched: boolean; excludedLaneIndexes: number[] }
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
