import { describe, expect, it } from 'vitest'
import { addLabelGroup, labelGroupsOf, setNodeLabel, updateLabelGroup, updateNode } from '../domain'
import { build } from '../domain/testUtils'
import { buildScene, renderSvg, svgPaint, type SceneInput, type Shape } from './scene'

const theme = { text: '#111', dim: '#777', surface: '#fff', accent: '#00f', ok: '#0a0', border: '#ccc' }

function input(data: ReturnType<typeof build>, over: Partial<SceneInput> = {}): SceneInput {
  const at = new Map(data.nodes.map((n, i) => [n.id, { x: 100 + i * 100, y: 100, scale: 1, depth: 0 }]))
  return {
    nodes: data.nodes,
    point: (id) => at.get(id)!,
    heads: [{ name: 'A', color: '#f00', point: { x: 100, y: 20, scale: 1, depth: 0 } }],
    edges: data.nodes.length > 1 ? [{ from: data.nodes[0].id, to: data.nodes[1].id }] : [],
    laneColorOf: () => '#f00',
    groups: labelGroupsOf(data),
    theme,
    nodeRadius: 16,
    doneMark: 'check',
    edgeWidth: 1.5,
    edgeHead: 'arrow',
    edgeHeadSize: 1,
    showProgress: false,
    showLabels: true,
    selectedId: null,
    ...over,
  }
}
const texts = (shapes: Shape[]) => shapes.filter((s) => s.kind === 'text').map((s) => (s as Extract<Shape, { kind: 'text' }>).text)

describe('그릴 목록', () => {
  it('머리글 → 화살표 → 노드 순으로 만들고, 화살표는 선과 촉으로 이뤄진다', () => {
    const d = build(['A'], [['a'], ['b']])
    const shapes = buildScene(input(d))
    expect(shapes[0]).toMatchObject({ kind: 'text', text: 'A' })
    expect(shapes[1].kind).toBe('line')
    expect(shapes[2]).toMatchObject({ kind: 'poly', closed: true })
    expect(texts(shapes)).toEqual(['A', 'a', 'b'])
  })

  it('백분율을 쓰지 않으면 진행률 링과 % 글자가 없다', () => {
    let d = build(['A'], [['a']])
    d = updateNode(d, 'a', { progress: 40 }).data
    const off = buildScene(input(d))
    expect(off.some((s) => s.kind === 'arc')).toBe(false)
    expect(texts(off)).toContain('a')
    const on = buildScene(input(d, { showProgress: true }))
    expect(on.some((s) => s.kind === 'arc')).toBe(true)
    expect(texts(on)).toContain('a 40%')
  })

  it('완료한 노드는 완료 색으로 덮고 완료 표시 글자를 넣는다', () => {
    let d = build(['A'], [['a']])
    d = updateNode(d, 'a', { progress: 100 }).data
    const shapes = buildScene(input(d, { doneMark: 'star', doneColor: '#123456' }))
    expect(shapes.some((s) => s.kind === 'circle' && s.fill === '#123456')).toBe(true)
    expect(texts(shapes)).toContain('★')
  })

  it('라벨은 순서가 앞선 그룹이 나중에(위에) 그려지고, 숨긴 그룹은 빠진다', () => {
    let d = build(['A'], [['a']])
    const g2 = addLabelGroup(d)
    d = setNodeLabel(g2.data, 'a', g2.id!, '메모').data
    expect(texts(buildScene(input(d))).slice(1)).toEqual(['메모', 'a'])
    d = updateLabelGroup(d, g2.id!, { visible: false }).data
    expect(texts(buildScene(input(d)))).not.toContain('메모')
  })

  it('선택한 노드와 이어진 화살표는 강조색이 된다', () => {
    const d = build(['A'], [['a'], ['b']])
    const line = buildScene(input(d, { selectedId: 'a' })).find((s) => s.kind === 'line')
    expect(line).toMatchObject({ stroke: theme.accent })
  })

  it('SVG: 글자를 안전하게 넣고, 투명도가 있는 색은 불투명도 속성으로 나눈다', () => {
    let d = build(['A'], [['a']])
    d = updateNode(d, 'a', { name: 'x<y&z' }).data
    const svg = renderSvg(buildScene(input(d)))
    expect(svg).toContain('x&lt;y&amp;z')
    expect(svgPaint('fill', '#11223380')).toBe('fill="#112233" fill-opacity="0.502"')
    expect(svgPaint('stroke', 'transparent')).toBe('stroke="none"')
  })
})
