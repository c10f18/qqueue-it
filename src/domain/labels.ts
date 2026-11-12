// 노드 라벨 그룹: 그래프에서 노드 둘레(8방향)에 표시하는 글자 줄.
// 첫 그룹은 항상 작업 이름이고 지울 수 없다. 추가한 그룹은 노드마다 글자를 따로 입력한다.

import { DomainError, draft, findNode, normalizeColor, uid } from './core'
import { LABEL_SIZE, MAX_LABEL_GROUPS, NAME_LABEL_GROUP_ID } from './types'
import type { BoardData, GraphDirection, LabelGroup, OpResult } from './types'

/** 새 그룹을 놓을 방향을 고르는 순서 */
const POSITION_ORDER: GraphDirection[] = ['down', 'up', 'right', 'left', 'down-right', 'down-left', 'up-right', 'up-left']

/** 첫 그룹(작업 이름)의 이름은 고정이다. */
export const NAME_LABEL_GROUP_NAME = '이름'

const DEFAULT_GROUPS: LabelGroup[] = [{ id: NAME_LABEL_GROUP_ID, name: NAME_LABEL_GROUP_NAME, position: 'down' }]

/** 보드의 라벨 그룹 목록. 설정한 적이 없으면 기본 그룹(이름) 1개 */
export function labelGroupsOf(data: BoardData): LabelGroup[] {
  return data.board.settings.graph?.labelGroups ?? DEFAULT_GROUPS
}

function editableGroups(d: BoardData): LabelGroup[] {
  const graph = (d.board.settings.graph ??= {})
  return (graph.labelGroups ??= structuredClone(DEFAULT_GROUPS))
}

/** 그룹 추가 (최대 8개). 추가하는 시점에 아직 쓰이지 않은 방향에 놓는다. */
export function addLabelGroup(data: BoardData): OpResult {
  const d = draft(data)
  const groups = editableGroups(d)
  if (groups.length >= MAX_LABEL_GROUPS) {
    throw new DomainError('invalid-argument', `라벨 그룹은 최대 ${MAX_LABEL_GROUPS}개입니다.`)
  }
  const used = new Set(groups.map((g) => g.position))
  const names = new Set(groups.map((g) => g.name))
  let n = groups.length + 1
  while (names.has(`라벨 ${n}`)) n++
  const group: LabelGroup = {
    id: uid(),
    name: `라벨 ${n}`,
    position: POSITION_ORDER.find((p) => !used.has(p)) ?? 'down',
  }
  groups.push(group)
  return { data: d, id: group.id }
}

export interface LabelGroupPatch {
  name?: string
  position?: GraphDirection
  /** 0~359도. undefined를 넣으면 각도를 지우고 position으로 돌아간다. */
  angle?: number
  color?: string
  size?: number
}

/** 그룹 이름·위치·색·크기 변경. 위치는 다른 그룹과 겹쳐도 된다. */
export function updateLabelGroup(data: BoardData, groupId: string, patch: LabelGroupPatch): OpResult {
  const d = draft(data)
  const group = editableGroups(d).find((g) => g.id === groupId)
  if (!group) throw new DomainError('invalid-argument', '라벨 그룹을 찾을 수 없습니다.')
  if (group.id === NAME_LABEL_GROUP_ID) {
    if (patch.name !== undefined) throw new DomainError('invalid-argument', '이름 라벨의 그룹 이름은 바꿀 수 없습니다.')
    group.name = NAME_LABEL_GROUP_NAME
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new DomainError('invalid-argument', '라벨 그룹 이름을 입력해 주세요.')
    group.name = name
  }
  if (patch.position !== undefined) {
    if (!POSITION_ORDER.includes(patch.position)) throw new DomainError('invalid-argument', '잘못된 라벨 위치입니다.')
    group.position = patch.position
    // 방향 칸을 고르면 세밀한 각도는 지운다.
    delete group.angle
  }
  if ('angle' in patch) {
    if (patch.angle === undefined) delete group.angle
    else {
      if (!Number.isFinite(patch.angle)) throw new DomainError('invalid-argument', '라벨 각도는 숫자여야 합니다.')
      group.angle = ((Math.round(patch.angle) % 360) + 360) % 360
    }
  }
  if ('color' in patch) {
    const color = normalizeColor(patch.color)
    if (color) group.color = color
    else delete group.color
  }
  if ('size' in patch) {
    if (patch.size === undefined) delete group.size
    else {
      if (!Number.isFinite(patch.size)) throw new DomainError('invalid-argument', '라벨 크기는 숫자여야 합니다.')
      group.size = Math.min(LABEL_SIZE.max, Math.max(LABEL_SIZE.min, patch.size))
    }
  }
  return { data: d }
}

/** 그룹 삭제. 노드에 입력해 둔 그 그룹의 글자도 함께 지운다. 이름 그룹은 지울 수 없다. */
export function removeLabelGroup(data: BoardData, groupId: string): OpResult {
  if (groupId === NAME_LABEL_GROUP_ID) throw new DomainError('invalid-argument', '이름 라벨은 지울 수 없습니다.')
  const d = draft(data)
  const groups = editableGroups(d)
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx < 0) throw new DomainError('invalid-argument', '라벨 그룹을 찾을 수 없습니다.')
  groups.splice(idx, 1)
  for (const node of d.nodes) {
    if (!node.labels) continue
    delete node.labels[groupId]
    if (Object.keys(node.labels).length === 0) delete node.labels
  }
  return { data: d }
}

/** 노드의 라벨 글자 입력. 앞뒤 공백은 떼고, 빈 글자는 지운 것으로 본다. */
export function setNodeLabel(data: BoardData, nodeId: string, groupId: string, text: string): OpResult {
  const d = draft(data)
  const node = findNode(d, nodeId)
  if (groupId === NAME_LABEL_GROUP_ID || !labelGroupsOf(d).some((g) => g.id === groupId)) {
    throw new DomainError('invalid-argument', '라벨 그룹을 찾을 수 없습니다.')
  }
  const value = text.trim()
  const labels = { ...node.labels }
  if (value) labels[groupId] = value
  else delete labels[groupId]
  if (Object.keys(labels).length) node.labels = labels
  else delete node.labels
  return { data: d }
}
