import { describe, expect, it } from 'vitest'
import { cloneBoardData, setGraphStyle, setLaneColor, updateNode } from './index'
import { build } from './testUtils'

describe('색·모양 설정', () => {
  it('레인 색을 지정하고 기본값으로 되돌린다 (투명 포함)', () => {
    let d = build(['A', 'B'], [['a', 'b']])
    d = setLaneColor(d, 'lane-A', '#FF000080').data
    expect(d.lanes[0].color).toBe('#ff000080')
    d = setLaneColor(d, 'lane-A', 'transparent').data
    expect(d.lanes[0].color).toBe('transparent')
    d = setLaneColor(d, 'lane-A', undefined).data
    expect('color' in d.lanes[0]).toBe(false)
  })

  it('잘못된 색 값은 거부한다', () => {
    const d = build(['A'], [['a']])
    expect(() => setLaneColor(d, 'lane-A', 'red')).toThrow(/색/)
    expect(() => updateNode(d, 'a', { color: '#12' })).toThrow(/색/)
  })

  it('노드에 단색·사진을 지정하고 지운다', () => {
    let d = build(['A'], [['a']])
    d = updateNode(d, 'a', { color: '#3b7dd8', image: 'data:image/png;base64,AAAA' }).data
    expect(d.nodes[0]).toMatchObject({ color: '#3b7dd8', image: 'data:image/png;base64,AAAA' })
    d = updateNode(d, 'a', { color: undefined, image: undefined }).data
    expect(d.nodes[0].color).toBeUndefined()
    expect(d.nodes[0].image).toBeUndefined()
  })

  it('그래프 설정: 일부만 바꾸면 나머지는 유지되고, undefined는 기본값으로 되돌린다', () => {
    let d = build(['A'], [['a']])
    d = setGraphStyle(d, { direction: 'up-right', doneMark: 'x', edgeWidth: 3 }).data
    d = setGraphStyle(d, { edgeColor: '#00000000', showProgress: false }).data
    expect(d.board.settings.graph).toEqual({
      direction: 'up-right',
      doneMark: 'x',
      edgeWidth: 3,
      edgeColor: '#00000000',
      showProgress: false,
    })
    d = setGraphStyle(d, { direction: undefined, doneMark: undefined }).data
    expect(d.board.settings.graph).toEqual({ edgeWidth: 3, edgeColor: '#00000000', showProgress: false })
  })

  it('선 두께는 0.5~8로 제한되고, 잘못된 색은 거부한다', () => {
    const d = build(['A'], [['a']])
    expect(setGraphStyle(d, { edgeWidth: 99 }).data.board.settings.graph!.edgeWidth).toBe(8)
    expect(setGraphStyle(d, { edgeWidth: 0 }).data.board.settings.graph!.edgeWidth).toBe(0.5)
    expect(() => setGraphStyle(d, { background: 'blue' })).toThrow(/색/)
  })

  it('노드 크기·간격·화살표 끝 크기도 범위 안으로 제한된다', () => {
    const d = build(['A'], [['a']])
    const g = setGraphStyle(d, { nodeSize: 999, slotGap: 1, laneGap: 200, edgeHeadSize: 10 }).data.board.settings.graph!
    expect(g).toEqual({ nodeSize: 40, slotGap: 60, laneGap: 200, edgeHeadSize: 3 })
    expect(() => setGraphStyle(d, { nodeSize: NaN })).toThrow(/숫자/)
  })

  it('복제하면 레인 색·노드 색/사진·그래프 설정이 함께 복제된다', () => {
    let d = build(['A'], [['a']])
    d = setLaneColor(d, 'lane-A', '#112233').data
    d = updateNode(d, 'a', { color: '#445566', image: 'data:image/png;base64,AAAA' }).data
    d = setGraphStyle(d, { direction: 'left', background: 'transparent' }).data
    const copy = cloneBoardData(d, '복제')
    expect(copy.lanes[0].color).toBe('#112233')
    expect(copy.nodes[0]).toMatchObject({ color: '#445566', image: 'data:image/png;base64,AAAA' })
    expect(copy.board.settings.graph).toEqual({ direction: 'left', background: 'transparent' })
  })
})
