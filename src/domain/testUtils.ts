// 테스트 전용 헬퍼: 격자 문자열로 보드를 만들고, 보드를 격자로 되읽는다.

import { createBoardData } from './board'
import { sortedLanes } from './core'
import type { BoardData } from './types'

/**
 * rows[슬롯][레인] = 노드 이름(없으면 null). 레인 이름은 lanes 인자.
 * 예) build(['A','B'], [['a1', null], ['a2','b2']])
 */
export function build(laneNames: string[], rows: (string | null)[][]): BoardData {
  const data = createBoardData('test')
  data.lanes = laneNames.map((name, order) => ({
    id: `lane-${name}`,
    boardId: data.board.id,
    name,
    order,
    active: true,
  }))
  data.slots = []
  data.board.slotOrder = []
  rows.forEach((row, i) => {
    const slotId = `slot-${i + 1}`
    data.slots.push({ id: slotId, boardId: data.board.id })
    data.board.slotOrder.push(slotId)
    row.forEach((name, laneIdx) => {
      if (name === null) return
      data.nodes.push({
        id: name,
        boardId: data.board.id,
        slotId,
        laneId: `lane-${laneNames[laneIdx]}`,
        name,
        tags: [],
        progress: 0,
        count: 0,
        visible: true,
        linkFilter: { touched: false, excludedLaneIds: [] },
        createdAt: 0,
      })
    })
  })
  return data
}

/** 보드를 rows[슬롯][레인] = 노드 이름|null 로 되읽는다. */
export function grid(data: BoardData): (string | null)[][] {
  const lanes = sortedLanes(data)
  return data.board.slotOrder.map((slotId) =>
    lanes.map((l) => data.nodes.find((n) => n.slotId === slotId && n.laneId === l.id)?.name ?? null),
  )
}

/** 불변식 검증: 셀 유일성, 슬롯 정합성, 고아 노드 없음 */
export function assertInvariants(data: BoardData): void {
  const seen = new Set<string>()
  const slotIds = new Set(data.board.slotOrder)
  const laneIds = new Set(data.lanes.map((l) => l.id))
  if (data.board.slotOrder.length < 1) throw new Error('슬롯이 1개 미만')
  if (slotIds.size !== data.board.slotOrder.length) throw new Error('slotOrder 중복')
  if (data.slots.length !== slotIds.size) throw new Error('slots와 slotOrder 불일치')
  for (const n of data.nodes) {
    const key = `${n.slotId}|${n.laneId}`
    if (seen.has(key)) throw new Error(`셀 중복: ${key}`)
    seen.add(key)
    if (!slotIds.has(n.slotId)) throw new Error(`없는 슬롯 참조: ${n.name}`)
    if (!laneIds.has(n.laneId)) throw new Error(`없는 레인 참조: ${n.name}`)
  }
  const occupied = new Set(data.nodes.map((n) => n.slotId))
  if (data.board.slotOrder.length > 1) {
    for (const id of data.board.slotOrder) {
      if (!occupied.has(id)) throw new Error(`빈 슬롯이 남음: ${id}`)
    }
  }
}
