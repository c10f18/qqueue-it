// 템플릿·보드 복제 (FR-80, FR-81). 복제본과 템플릿에서 만든 보드는 진행도·횟수가 0으로 리셋된다.

import { uid } from './core'
import type { BoardData, Template } from './types'

export function createTemplateFromBoard(data: BoardData, name: string): Template {
  const lanes = [...data.lanes].sort((a, b) => a.order - b.order)
  const laneIndex = new Map(lanes.map((l, i) => [l.id, i]))
  const slotIndex = new Map(data.board.slotOrder.map((id, i) => [id, i]))
  return {
    id: uid(),
    name: name.trim() || data.board.name,
    snapshot: {
      lanes: lanes.map((l) => ({ name: l.name, order: l.order, active: l.active, color: l.color })),
      slotCount: data.board.slotOrder.length,
      graph: data.board.settings.graph ? { ...data.board.settings.graph } : undefined,
      nodes: data.nodes.map((n) => ({
        name: n.name,
        description: n.description,
        icon: n.icon,
        color: n.color,
        image: n.image,
        tags: [...n.tags],
        progress: n.progress,
        count: n.count,
        visible: n.visible,
        deadline: n.deadline,
        createdAt: n.createdAt,
        slotIndex: slotIndex.get(n.slotId)!,
        laneIndex: laneIndex.get(n.laneId)!,
        linkFilter: {
          touched: n.linkFilter.touched,
          excludedLaneIndexes: n.linkFilter.excludedLaneIds
            .map((id) => laneIndex.get(id))
            .filter((i): i is number => i !== undefined),
        },
      })),
    },
    updatedAt: Date.now(),
  }
}

/** 템플릿에서 새 보드를 만든다. 진행도·횟수(=완료여부)는 0으로 리셋된다. */
export function createBoardFromTemplate(template: Template, boardName: string): BoardData {
  const now = Date.now()
  const boardId = uid()
  const snap = template.snapshot

  const slots = Array.from({ length: Math.max(1, snap.slotCount) }, () => ({ id: uid(), boardId }))
  const lanes = snap.lanes.map((l) => ({
    id: uid(),
    boardId,
    name: l.name,
    order: l.order,
    active: l.active,
    ...(l.color ? { color: l.color } : {}),
  }))

  return {
    board: {
      id: boardId,
      name: boardName.trim() || template.name,
      slotOrder: slots.map((s) => s.id),
      settings: { showSlotNumbers: true, ...(snap.graph ? { graph: { ...snap.graph } } : {}) },
      createdAt: now,
      updatedAt: now,
    },
    lanes,
    slots,
    nodes: snap.nodes.map((n) => ({
      id: uid(),
      boardId,
      slotId: slots[n.slotIndex].id,
      laneId: lanes[n.laneIndex].id,
      name: n.name,
      description: n.description,
      icon: n.icon,
      color: n.color,
      image: n.image,
      tags: [...n.tags],
      progress: 0,
      count: 0,
      visible: n.visible,
      deadline: n.deadline,
      linkFilter: {
        touched: n.linkFilter.touched,
        excludedLaneIds: n.linkFilter.excludedLaneIndexes.map((i) => lanes[i].id),
      },
      createdAt: now,
    })),
  }
}

/** 보드 전체 복제: 슬롯 구조를 유지한 채 분기한다. */
export function cloneBoardData(data: BoardData, name: string): BoardData {
  return createBoardFromTemplate(createTemplateFromBoard(data, name), name)
}
