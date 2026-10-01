// 노드 CRUD·복제·링크 필터 (FR-20~23, 명세 5장)

import {
  DomainError,
  cellNode,
  cleanupEmptySlots,
  draft,
  findNode,
  insertSlotAfter,
  requireLane,
  requireSlot,
  uid,
} from './core'
import { DEFAULT_NODE_NAME, MAX_TAGS } from './types'
import type { BoardData, OpResult, TaskNode } from './types'

export interface NodeFields {
  name?: string
  description?: string
  icon?: string
  tags?: string[]
  deadline?: number
}

export type NodePatch = NodeFields & {
  progress?: number
  count?: number
  visible?: boolean
}

/** 앞뒤 공백 제거, 중복·빈 태그 제거, 최대 5개 검증 (명세 22.1, 17.4) */
export function normalizeTags(tags: string[]): string[] {
  const result = [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
  if (result.length > MAX_TAGS) {
    throw new DomainError('tags-max', `태그는 작업당 최대 ${MAX_TAGS}개입니다.`)
  }
  return result
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) throw new DomainError('invalid-argument', '진행도는 숫자여야 합니다.')
  return Math.min(100, Math.max(0, Math.round(value)))
}

function buildNode(d: BoardData, slotId: string, laneId: string, fields: NodeFields): TaskNode {
  const name = fields.name === undefined ? DEFAULT_NODE_NAME : fields.name.trim()
  if (!name) throw new DomainError('node-name-empty', '작업 이름을 입력해 주세요.')
  return {
    id: uid(),
    boardId: d.board.id,
    slotId,
    laneId,
    name,
    description: fields.description,
    icon: fields.icon,
    tags: normalizeTags(fields.tags ?? []),
    progress: 0,
    count: 0,
    visible: true,
    deadline: fields.deadline,
    linkFilter: { touched: false, excludedLaneIds: [] },
    createdAt: Date.now(),
  }
}

/** 빈 셀에 노드 생성 (FR-23) */
export function createNode(
  data: BoardData,
  slotId: string,
  laneId: string,
  fields: NodeFields = {},
): OpResult {
  const d = draft(data)
  requireSlot(d, slotId)
  requireLane(d, laneId)
  if (cellNode(d, slotId, laneId)) {
    throw new DomainError('cell-occupied', '이미 노드가 있는 칸입니다.')
  }
  const node = buildNode(d, slotId, laneId, fields)
  d.nodes.push(node)
  return { data: d, id: node.id }
}

/** 기준 노드의 위/아래에 같은 레인으로 새 슬롯을 끼워 노드 생성 (FR-22) */
export function insertNodeBeside(
  data: BoardData,
  anchorNodeId: string,
  position: 'above' | 'below',
  fields: NodeFields = {},
): OpResult {
  const d = draft(data)
  const anchor = findNode(d, anchorNodeId)
  const anchorIdx = requireSlot(d, anchor.slotId)
  const afterSlotId = position === 'below' ? anchor.slotId : (d.board.slotOrder[anchorIdx - 1] ?? null)
  const slotId = insertSlotAfter(d, afterSlotId)
  const node = buildNode(d, slotId, anchor.laneId, fields)
  d.nodes.push(node)
  return { data: d, id: node.id }
}

export function updateNode(data: BoardData, nodeId: string, patch: NodePatch): OpResult {
  const d = draft(data)
  const node = findNode(d, nodeId)

  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new DomainError('node-name-empty', '작업 이름을 입력해 주세요.')
    node.name = name
  }
  if ('description' in patch) node.description = patch.description || undefined
  if ('icon' in patch) node.icon = patch.icon || undefined
  if ('deadline' in patch) node.deadline = patch.deadline
  if (patch.tags !== undefined) node.tags = normalizeTags(patch.tags)
  if (patch.progress !== undefined) node.progress = clampProgress(patch.progress)
  if (patch.count !== undefined) {
    if (!Number.isFinite(patch.count)) throw new DomainError('invalid-argument', '횟수는 숫자여야 합니다.')
    node.count = Math.max(0, Math.round(patch.count))
  }
  if (patch.visible !== undefined) node.visible = patch.visible
  return { data: d }
}

export function deleteNode(data: BoardData, nodeId: string): OpResult {
  const d = draft(data)
  findNode(d, nodeId)
  d.nodes = d.nodes.filter((n) => n.id !== nodeId)
  cleanupEmptySlots(d)
  return { data: d }
}

/** 복제: 같은 레인, 원본 바로 아래 새 슬롯. 진행도·횟수는 0으로 시작한다. */
export function duplicateNode(data: BoardData, nodeId: string): OpResult {
  const d = draft(data)
  const src = findNode(d, nodeId)
  const slotId = insertSlotAfter(d, src.slotId)
  const copy: TaskNode = {
    ...structuredClone(src),
    id: uid(),
    slotId,
    name: `${src.name} (복사)`,
    progress: 0,
    count: 0,
    createdAt: Date.now(),
  }
  d.nodes.push(copy)
  return { data: d, id: copy.id }
}

/** 링크 필터 설정 (FR-30~32). 한 번이라도 조작하면 touched=true로 고정된다. */
export function setLinkFilter(data: BoardData, nodeId: string, excludedLaneIds: string[]): OpResult {
  const d = draft(data)
  const node = findNode(d, nodeId)
  node.linkFilter = { touched: true, excludedLaneIds: [...new Set(excludedLaneIds)] }
  return { data: d }
}
