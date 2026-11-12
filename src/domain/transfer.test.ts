import { describe, expect, it } from 'vitest'
import { addLabelGroup, exportBoard, importBoardData, setGraphStyle, setLinkFilter, setNodeLabel, updateNode } from './index'
import { assertInvariants, build } from './testUtils'

describe('JSON 내보내기·가져오기', () => {
  it('내보낸 보드를 가져오면 내용은 같고 id는 모두 새로 발급된다', () => {
    let d = build(['A', 'B'], [['a', 'b'], ['c', null]])
    d = updateNode(d, 'a', { progress: 40, tags: ['x'], color: '#112233' }).data
    d = setGraphStyle(d, { direction: 'left', nodeSize: 20 }).data
    d = setLinkFilter(d, 'a', ['lane-B']).data
    const group = addLabelGroup(d)
    d = setNodeLabel(group.data, 'a', group.id!, '메모').data

    const copy = importBoardData(JSON.parse(JSON.stringify(exportBoard(d))))
    assertInvariants(copy)
    expect(copy.board.id).not.toBe(d.board.id)
    expect(copy.board.name).toBe(d.board.name)
    expect(copy.board.settings.graph).toEqual(d.board.settings.graph)
    expect(copy.lanes.map((l) => l.name)).toEqual(['A', 'B'])
    expect(copy.nodes).toHaveLength(3)

    const a = copy.nodes.find((n) => n.name === 'a')!
    expect(a).toMatchObject({ progress: 40, tags: ['x'], color: '#112233', labels: { [group.id!]: '메모' } })
    expect(a.id).not.toBe('a')
    // 링크 필터의 레인 id도 새 id로 바뀐다
    expect(a.linkFilter).toEqual({ touched: true, excludedLaneIds: [copy.lanes[1].id] })
    // 슬롯 순서 유지
    const c = copy.nodes.find((n) => n.name === 'c')!
    expect(copy.board.slotOrder.indexOf(a.slotId)).toBe(0)
    expect(copy.board.slotOrder.indexOf(c.slotId)).toBe(1)
  })

  it('감싸지 않은 보드 데이터도 받는다', () => {
    const d = build(['A'], [['a']])
    expect(importBoardData(JSON.parse(JSON.stringify(d))).nodes[0].name).toBe('a')
  })

  it('형식이 맞지 않으면 거부한다', () => {
    const d = build(['A'], [['a']])
    expect(() => importBoardData('문자열')).toThrow(/가져올 수 없는/)
    expect(() => importBoardData({ format: 'other', data: d })).toThrow(/뀨잇 보드 파일이 아닙니다/)
    expect(() => importBoardData({ board: { name: 'x' } })).toThrow(/보드 정보/)
    const broken = JSON.parse(JSON.stringify(d))
    broken.nodes[0].laneId = 'nope'
    expect(() => importBoardData(broken)).toThrow(/찾을 수 없습니다/)
  })
})
