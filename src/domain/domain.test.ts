import { describe, expect, it } from 'vitest'
import {
  addLane,
  bulkProgress,
  createBoardData,
  createNode,
  deleteLane,
  deleteNode,
  dropOnBoundary,
  dropOnCell,
  duplicateNode,
  insertNodeBeside,
  moveSlot,
  renameLane,
  reorderLane,
  resetLaneProgress,
  updateNode,
} from './index'
import { assertInvariants, build, grid } from './testUtils'

const N = null

describe('보드 생성', () => {
  it('Default 레인 1개와 슬롯 1개를 가진다 (FR-10, FR-62)', () => {
    const d = createBoardData('x')
    expect(d.lanes.map((l) => l.name)).toEqual(['Default'])
    expect(d.board.slotOrder).toHaveLength(1)
    assertInvariants(d)
  })
})

describe('드래그: 노드 위에 드롭 (체인 밀어내기)', () => {
  it('같은 레인 앞으로: 비워진 자리에서 연쇄가 끝난다 (새 슬롯 없음)', () => {
    const d = build(['L'], [['A'], ['B'], ['C']])
    const r = dropOnCell(d, 'C', 'slot-1', 'lane-L').data
    expect(grid(r)).toEqual([['C'], ['A'], ['B']])
    assertInvariants(r)
  })

  it('같은 레인 앞으로: 비워진 자리에 다른 레인 노드가 있어도 합류한다', () => {
    const d = build(['L', 'M'], [['A', N], ['B', N], ['C', 'x']])
    const r = dropOnCell(d, 'C', 'slot-1', 'lane-L').data
    expect(grid(r)).toEqual([['C', N], ['A', N], ['B', 'x']])
    assertInvariants(r)
  })

  it('같은 레인 뒤로: 대상이 밀려 마지막은 새 슬롯, 비게 된 원래 슬롯은 정리 (FR-40)', () => {
    const d = build(['L'], [['A'], ['B'], ['C']])
    const r = dropOnCell(d, 'A', 'slot-3', 'lane-L').data
    expect(grid(r)).toEqual([['B'], ['A'], ['C']])
    assertInvariants(r)
  })

  it('다른 레인 노드 위: 레인이 바뀌고 대상이 밀린다', () => {
    const d = build(['L', 'M'], [['A', 'x'], [N, 'y']])
    const r = dropOnCell(d, 'A', 'slot-1', 'lane-M').data
    expect(grid(r)).toEqual([[N, 'A'], [N, 'x'], [N, 'y']])
    assertInvariants(r)
  })

  it('다른 레인 노드 위: 밀린 마지막 노드는 새 슬롯에 단독 배치', () => {
    const d = build(['L', 'M'], [['A', N], ['y', 'x']])
    const r = dropOnCell(d, 'A', 'slot-2', 'lane-M').data
    expect(grid(r)).toEqual([['y', 'A'], [N, 'x']])
    assertInvariants(r)
  })

  it('자기 자신 위에 드롭하면 아무 일도 없다', () => {
    const d = build(['L'], [['A'], ['B']])
    expect(dropOnCell(d, 'A', 'slot-1', 'lane-L').data).toBe(d)
  })

  it('원본 데이터를 변경하지 않는다', () => {
    const d = build(['L'], [['A'], ['B'], ['C']])
    const before = structuredClone(d)
    dropOnCell(d, 'C', 'slot-1', 'lane-L')
    expect(d).toEqual(before)
  })
})

describe('드래그: 빈 칸 합류 / 경계선 분리 / 슬롯 이동', () => {
  it('같은 슬롯의 빈 칸에 합류하고, 비게 된 슬롯은 정리된다', () => {
    const d = build(['L', 'M'], [['A', N], ['B', N]])
    const r = dropOnCell(d, 'B', 'slot-1', 'lane-M').data
    expect(grid(r)).toEqual([['A', 'B']])
    assertInvariants(r)
  })

  it('경계선: 새 슬롯을 만들어 커서 레인에 단독 배치', () => {
    const d = build(['L', 'M'], [['A', 'x'], ['B', N]])
    const r = dropOnBoundary(d, 'x', 'slot-1', 'lane-M').data
    expect(grid(r)).toEqual([['A', N], [N, 'x'], ['B', N]])
    assertInvariants(r)
  })

  it('경계선: 맨 앞 경계(null)', () => {
    const d = build(['L'], [['A'], ['B']])
    const r = dropOnBoundary(d, 'B', null, 'lane-L').data
    expect(grid(r)).toEqual([['B'], ['A']])
    assertInvariants(r)
  })

  it('슬롯 전체 이동은 slotOrder만 바꾼다', () => {
    const d = build(['L'], [['A'], ['B'], ['C']])
    const r = moveSlot(d, 'slot-1', 2).data
    expect(grid(r)).toEqual([['B'], ['C'], ['A']])
    expect(r.nodes).toEqual(d.nodes)
  })
})

describe('빈 슬롯 정리 (FR-02/03)', () => {
  it('중간 슬롯이 비면 삭제된다', () => {
    const d = build(['L', 'M'], [['A', N], ['B', 'x'], ['C', N]])
    const r = deleteNode(deleteNode(d, 'B').data, 'x').data
    expect(grid(r)).toEqual([['A', N], ['C', N]])
  })

  it('마지막 슬롯도 비면 삭제된다 (단, 보드의 유일한 슬롯이면 남는다)', () => {
    const d = build(['L'], [['A'], ['B']])
    const r = deleteNode(d, 'B').data
    expect(grid(r)).toEqual([['A']])
    assertInvariants(r)
  })

  it('유일한 노드를 지워도 슬롯 1개는 유지', () => {
    const r = deleteNode(build(['L'], [['A']]), 'A').data
    expect(r.board.slotOrder).toHaveLength(1)
  })
})

describe('노드 생성/수정/복제', () => {
  it('빈 셀에 생성, 점유된 셀은 거부 (FR-05, FR-23)', () => {
    const d = build(['L', 'M'], [['A', N]])
    const r = createNode(d, 'slot-1', 'lane-M', { name: 'x' }).data
    expect(grid(r)).toEqual([['A', 'x']])
    expect(() => createNode(r, 'slot-1', 'lane-M')).toThrow(/이미 노드/)
  })

  it('위/아래에 추가는 같은 레인에 새 슬롯을 끼운다 (FR-22)', () => {
    const d = build(['L', 'M'], [['A', 'x'], ['B', N]])
    const above = insertNodeBeside(d, 'B', 'above', { name: 'n' }).data
    expect(grid(above)).toEqual([['A', 'x'], ['n', N], ['B', N]])
    const below = insertNodeBeside(d, 'A', 'below', { name: 'n' }).data
    expect(grid(below)).toEqual([['A', 'x'], ['n', N], ['B', N]])
    const top = insertNodeBeside(d, 'A', 'above', { name: 'n' }).data
    expect(grid(top)).toEqual([['n', N], ['A', 'x'], ['B', N]])
    assertInvariants(top)
  })

  it('태그는 최대 5개, 공백 정리·중복 제거', () => {
    const d = build(['L'], [['A']])
    const ok = updateNode(d, 'A', { tags: [' a ', 'a', 'b'] }).data
    expect(ok.nodes[0].tags).toEqual(['a', 'b'])
    expect(() => updateNode(d, 'A', { tags: ['1', '2', '3', '4', '5', '6'] })).toThrow(/최대 5개/)
  })

  it('진행도는 0~100으로 보정되고 100이면 완료', () => {
    const d = build(['L'], [['A']])
    expect(updateNode(d, 'A', { progress: 140 }).data.nodes[0].progress).toBe(100)
    expect(updateNode(d, 'A', { progress: -3 }).data.nodes[0].progress).toBe(0)
  })

  it('이름을 비울 수 없다', () => {
    expect(() => updateNode(build(['L'], [['A']]), 'A', { name: '  ' })).toThrow(/이름/)
  })

  it('복제는 원본 아래 새 슬롯에 진행도 0으로 만든다', () => {
    let d = build(['L'], [['A'], ['B']])
    d = updateNode(d, 'A', { progress: 80, count: 3 }).data
    const r = duplicateNode(d, 'A').data
    expect(grid(r)).toEqual([['A'], ['A (복사)'], ['B']])
    const copy = r.nodes.find((n) => n.name === 'A (복사)')!
    expect(copy.progress).toBe(0)
    expect(copy.count).toBe(0)
    assertInvariants(r)
  })
})

describe('카테고리', () => {
  it('최대 5개, 이름 중복 불가, 공백 불가', () => {
    let d = createBoardData('x')
    for (const n of ['b', 'c', 'd', 'e']) d = addLane(d, n).data
    expect(() => addLane(d, 'f')).toThrow(/최대 5개/)
    expect(() => renameLane(d, d.lanes[1].id, 'Default')).toThrow(/이미 있는/)
    expect(() => renameLane(d, d.lanes[1].id, ' ')).toThrow(/입력/)
  })

  it('마지막 카테고리는 삭제할 수 없다', () => {
    const d = createBoardData('x')
    expect(() => deleteLane(d, d.lanes[0].id)).toThrow(/마지막/)
  })

  it('열 순서를 바꾼다 (FR-14)', () => {
    const d = build(['A', 'B', 'C'], [['a', 'b', 'c']])
    const r = reorderLane(d, 'lane-C', 0).data
    expect(grid(r)).toEqual([['c', 'a', 'b']])
  })

  it('삭제 시 노드도 삭제 (FR-16)', () => {
    const d = build(['A', 'B'], [['a', 'b'], ['a2', N]])
    const r = deleteLane(d, 'lane-B', 'deleteNodes').data
    expect(grid(r)).toEqual([['a'], ['a2']])
    assertInvariants(r)
  })

  it('삭제 시 다른 카테고리로 이동: 충돌은 밀어내기 규칙 (FR-17)', () => {
    const d = build(['A', 'B'], [['a1', 'b1'], ['a2', N], [N, 'b2']])
    const r = deleteLane(d, 'lane-B', 'moveTo', 'lane-A').data
    expect(r.lanes).toHaveLength(1)
    assertInvariants(r)
    expect(r.nodes.map((n) => n.name).sort()).toEqual(['a1', 'a2', 'b1', 'b2'])
    const names = grid(r).map((row) => row[0])
    expect(names.indexOf('b1')).toBeLessThan(names.indexOf('b2'))
  })

  it('삭제 시 링크 필터의 제외 목록에서도 제거된다', () => {
    const d = build(['A', 'B'], [['a', 'b']])
    d.nodes[0].linkFilter = { touched: true, excludedLaneIds: ['lane-B'] }
    const r = deleteLane(d, 'lane-B', 'deleteNodes').data
    expect(r.nodes[0].linkFilter.excludedLaneIds).toEqual([])
  })
})

describe('진행도', () => {
  it('일괄 진행: 지정 슬롯까지, 선택한 레인만 (FR-51)', () => {
    const d = build(['A', 'B'], [['a1', 'b1'], ['a2', 'b2'], ['a3', 'b3']])
    const r = bulkProgress(d, 'slot-2', ['lane-A']).data
    const p = Object.fromEntries(r.nodes.map((n) => [n.name, n.progress]))
    expect(p).toEqual({ a1: 100, b1: 0, a2: 100, b2: 0, a3: 0, b3: 0 })
  })

  it('레인 전체 리셋 (FR-52)', () => {
    let d = build(['A', 'B'], [['a1', 'b1']])
    d = bulkProgress(d, 'slot-1', ['lane-A', 'lane-B']).data
    const r = resetLaneProgress(d, 'lane-A').data
    expect(r.nodes.map((n) => [n.name, n.progress])).toEqual([['a1', 0], ['b1', 100]])
  })
})

describe('무작위 드래그 시나리오: 불변식 유지', () => {
  it('어떤 드롭을 해도 셀 유일성·슬롯 정합성이 깨지지 않고 노드가 사라지지 않는다', () => {
    let seed = 42
    const rand = (n: number) => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed % n
    }
    let d = build(
      ['A', 'B', 'C'],
      [['a1', 'b1', N], ['a2', N, 'c1'], [N, 'b2', N], ['a3', 'b3', 'c2'], ['a4', N, N]],
    )
    const total = d.nodes.length
    for (let i = 0; i < 500; i++) {
      const node = d.nodes[rand(d.nodes.length)]
      const lane = d.lanes[rand(d.lanes.length)]
      const slots = d.board.slotOrder
      const kind = rand(3)
      if (kind === 0) {
        d = dropOnCell(d, node.id, slots[rand(slots.length)], lane.id).data
      } else if (kind === 1) {
        const after = rand(slots.length + 1) === 0 ? null : slots[rand(slots.length)]
        d = dropOnBoundary(d, node.id, after, lane.id).data
      } else {
        d = moveSlot(d, slots[rand(slots.length)], rand(slots.length)).data
      }
      assertInvariants(d)
      expect(d.nodes).toHaveLength(total)
    }
  })
})
