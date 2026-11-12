import { describe, expect, it } from 'vitest'
import {
  addLabelGroup,
  cloneBoardData,
  labelAngle,
  labelGroupsOf,
  removeLabelGroup,
  setGraphStyle,
  setNodeLabel,
  updateLabelGroup,
  MAX_LABEL_GROUPS,
  NAME_LABEL_GROUP_ID,
} from './index'
import { build } from './testUtils'

describe('노드 라벨 그룹', () => {
  it('기본은 이름 그룹 1개다', () => {
    const d = build(['A'], [['a']])
    expect(labelGroupsOf(d)).toEqual([{ id: NAME_LABEL_GROUP_ID, name: '이름', position: 'down' }])
  })

  it('추가할 때마다 기본 이름이 붙고, 아직 안 쓰인 방향에 놓인다 (최대 8개)', () => {
    let d = build(['A'], [['a']])
    for (let i = 1; i < MAX_LABEL_GROUPS; i++) d = addLabelGroup(d).data
    const groups = labelGroupsOf(d)
    expect(groups.map((g) => g.name)).toEqual(['이름', '라벨 2', '라벨 3', '라벨 4', '라벨 5', '라벨 6', '라벨 7', '라벨 8'])
    expect(new Set(groups.map((g) => g.position)).size).toBe(8)
    expect(() => addLabelGroup(d)).toThrow(/최대/)
  })

  it('추가 시점 기준으로 빈 방향을 고르고, 나중에는 방향이 겹쳐도 된다', () => {
    let d = build(['A'], [['a']])
    d = updateLabelGroup(d, NAME_LABEL_GROUP_ID, { position: 'up' }).data
    const r = addLabelGroup(d)
    d = r.data
    expect(labelGroupsOf(d)[1].position).toBe('down')
    d = updateLabelGroup(d, r.id!, { position: 'up' }).data
    expect(labelGroupsOf(d).map((g) => g.position)).toEqual(['up', 'up'])
  })

  it('그룹 이름·색·크기를 바꾼다', () => {
    let d = build(['A'], [['a']])
    const id = addLabelGroup(d).id!
    d = addLabelGroup(d).data
    const gid = labelGroupsOf(d)[1].id
    d = updateLabelGroup(d, gid, { name: ' 기한 ', color: '#FF000080', size: 99 }).data
    expect(labelGroupsOf(d)[1]).toMatchObject({ name: '기한', color: '#ff000080', size: 28 })
    d = updateLabelGroup(d, gid, { color: undefined, size: undefined }).data
    expect(labelGroupsOf(d)[1]).not.toHaveProperty('color')
    expect(labelGroupsOf(d)[1]).not.toHaveProperty('size')
    expect(() => updateLabelGroup(d, gid, { name: '  ' })).toThrow(/이름/)
    // 첫 그룹의 이름은 '이름'으로 고정
    expect(() => updateLabelGroup(d, NAME_LABEL_GROUP_ID, { name: '제목' })).toThrow(/바꿀 수 없/)
    expect(labelGroupsOf(d)[0].name).toBe('이름')
    expect(() => updateLabelGroup(d, id, { name: 'x' })).toThrow(/찾을 수/)
  })

  it('노드에 라벨을 입력하고, 그룹을 지우면 입력한 글자도 사라진다', () => {
    let d = build(['A'], [['a']])
    const r = addLabelGroup(d)
    d = setNodeLabel(r.data, 'a', r.id!, ' 30분 ').data
    expect(d.nodes[0].labels).toEqual({ [r.id!]: '30분' })
    expect(() => setNodeLabel(d, 'a', NAME_LABEL_GROUP_ID, 'x')).toThrow()
    expect(() => removeLabelGroup(d, NAME_LABEL_GROUP_ID)).toThrow(/지울 수 없/)
    d = removeLabelGroup(d, r.id!).data
    expect(d.nodes[0].labels).toBeUndefined()
    expect(labelGroupsOf(d)).toHaveLength(1)
  })

  it('각도로 위치를 정할 수 있고, 방향을 고르면 각도는 지워진다', () => {
    let d = build(['A'], [['a']])
    d = updateLabelGroup(d, NAME_LABEL_GROUP_ID, { angle: 372.4 }).data
    expect(labelGroupsOf(d)[0].angle).toBe(12)
    expect(labelAngle(labelGroupsOf(d)[0])).toBe(12)
    d = updateLabelGroup(d, NAME_LABEL_GROUP_ID, { angle: -90 }).data
    expect(labelGroupsOf(d)[0].angle).toBe(270)
    d = updateLabelGroup(d, NAME_LABEL_GROUP_ID, { position: 'right' }).data
    expect(labelGroupsOf(d)[0]).not.toHaveProperty('angle')
    expect(labelAngle(labelGroupsOf(d)[0])).toBe(90)
  })

  it('그룹을 숨기고 다시 보이게 한다 (입력한 글자는 유지)', () => {
    let d = build(['A'], [['a']])
    const r = addLabelGroup(d)
    d = setNodeLabel(r.data, 'a', r.id!, '메모').data
    d = updateLabelGroup(d, r.id!, { visible: false }).data
    expect(labelGroupsOf(d)[1].visible).toBe(false)
    expect(d.nodes[0].labels).toEqual({ [r.id!]: '메모' })
    d = updateLabelGroup(d, r.id!, { visible: true }).data
    expect(labelGroupsOf(d)[1]).not.toHaveProperty('visible')
    d = updateLabelGroup(d, NAME_LABEL_GROUP_ID, { visible: false }).data
    expect(labelGroupsOf(d)[0].visible).toBe(false)
  })

  it('빈 글자를 넣으면 라벨이 지워진다', () => {
    let d = build(['A'], [['a']])
    const r = addLabelGroup(d)
    d = setNodeLabel(r.data, 'a', r.id!, 'x').data
    d = setNodeLabel(d, 'a', r.id!, '').data
    expect(d.nodes[0].labels).toBeUndefined()
  })

  it('다른 그래프 설정을 바꿔도 유지되고, 복제하면 그룹과 글자가 함께 간다', () => {
    let d = build(['A'], [['a']])
    const r = addLabelGroup(d)
    d = setNodeLabel(r.data, 'a', r.id!, '메모').data
    d = setGraphStyle(d, { nodeSize: 20 }).data
    expect(labelGroupsOf(d)).toHaveLength(2)
    const copy = cloneBoardData(d, '복제')
    expect(labelGroupsOf(copy)).toEqual(labelGroupsOf(d))
    expect(copy.nodes[0].labels).toEqual({ [r.id!]: '메모' })
  })
})
