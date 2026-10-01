import { describe, expect, it } from 'vitest'
import {
  cloneBoardData,
  computeDerivedEdges,
  createBoardFromTemplate,
  createTemplateFromBoard,
  setLinkFilter,
  toggleLaneActive,
  updateNode,
} from './index'
import { assertInvariants, build, grid } from './testUtils'

const N = null
const pairs = (edges: { from: string; to: string }[]) => edges.map((e) => `${e.from}>${e.to}`).sort()

describe('파생 엣지', () => {
  it('필터를 건드리지 않으면 다음 슬롯 전체에 연결 (FR-30)', () => {
    const d = build(['A', 'B'], [['a1', 'b1'], ['a2', N], [N, 'b3']])
    expect(pairs(computeDerivedEdges(d))).toEqual(['a1>a2', 'a2>b3', 'b1>a2'])
  })

  it('필터를 건드리면 체크된 레인마다 가장 가까운 노드에 연결 (FR-31)', () => {
    let d = build(['A', 'B'], [['a1', N], [N, 'b2'], ['a3', N], [N, 'b4']])
    d = setLinkFilter(d, 'a1', []).data // 전체 선택이어도 touched=true
    expect(pairs(computeDerivedEdges(d))).toContain('a1>a3')
    expect(pairs(computeDerivedEdges(d))).toContain('a1>b2')
    d = setLinkFilter(d, 'a1', ['lane-B']).data // B 제외
    const p = pairs(computeDerivedEdges(d))
    expect(p).toContain('a1>a3')
    expect(p).not.toContain('a1>b2')
  })

  it('제외 목록 방식이라 전체 선택은 빈 제외 목록으로 저장된다 (FR-32)', () => {
    let d = build(['A'], [['a1'], ['a2']])
    d = setLinkFilter(d, 'a1', []).data
    expect(d.nodes.find((n) => n.id === 'a1')!.linkFilter).toEqual({ touched: true, excludedLaneIds: [] })
  })

  it('비활성 레인·숨김 노드는 엣지에서 제외되고, 숨겨진 슬롯은 건너뛴다', () => {
    let d = build(['A', 'B'], [['a1', N], [N, 'b2'], ['a3', N]])
    d = toggleLaneActive(d, 'lane-B').data
    expect(pairs(computeDerivedEdges(d))).toEqual(['a1>a3'])
    d = updateNode(d, 'a3', { visible: false }).data
    expect(computeDerivedEdges(d)).toEqual([])
  })
})

describe('템플릿·복제', () => {
  it('슬롯 구조를 유지하고 진행도·횟수를 0으로 리셋한다 (FR-80, FR-81)', () => {
    let d = build(['A', 'B'], [['a1', 'b1'], ['a2', N], [N, 'b3']])
    d = updateNode(d, 'a1', { progress: 100, count: 5, tags: ['x'] }).data
    d = setLinkFilter(d, 'a1', ['lane-B']).data
    const copy = cloneBoardData(d, '복제본')
    assertInvariants(copy)
    expect(copy.board.id).not.toBe(d.board.id)
    expect(grid(copy)).toEqual(grid(d))
    expect(copy.nodes.every((n) => n.progress === 0 && n.count === 0)).toBe(true)
    const a1 = copy.nodes.find((n) => n.name === 'a1')!
    expect(a1.tags).toEqual(['x'])
    // 링크 필터의 제외 레인이 새 레인 ID로 다시 매핑된다
    const laneB = copy.lanes.find((l) => l.name === 'B')!
    expect(a1.linkFilter).toEqual({ touched: true, excludedLaneIds: [laneB.id] })
    // 원본은 그대로
    expect(d.nodes.find((n) => n.id === 'a1')!.progress).toBe(100)
  })

  it('템플릿에서 새 보드를 만든다', () => {
    const d = build(['A'], [['a1'], ['a2']])
    const t = createTemplateFromBoard(d, '템플릿')
    const b = createBoardFromTemplate(t, '')
    expect(b.board.name).toBe('템플릿')
    expect(grid(b)).toEqual([['a1'], ['a2']])
    assertInvariants(b)
  })
})
