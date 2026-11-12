import { describe, expect, it } from 'vitest'
import { DIRECTIONS, axes, place } from './layout'

describe('그래프 방향 배치', () => {
  it('8방향을 지원한다', () => {
    expect(DIRECTIONS).toHaveLength(8)
  })

  it('아래로 진행하면 레인은 오른쪽으로 늘어난다', () => {
    expect(place('down', 2, 1, 100, 150)).toEqual({ x: 150, y: 200 })
  })

  it('오른쪽으로 진행하면 레인은 아래쪽으로 늘어난다', () => {
    expect(place('right', 2, 1, 100, 150)).toEqual({ x: 200, y: 150 })
  })

  it('위/왼쪽으로 진행해도 레인은 오른쪽/아래쪽으로 늘어난다', () => {
    expect(place('up', 1, 1, 100, 150)).toEqual({ x: 150, y: -100 })
    expect(place('left', 1, 1, 100, 150)).toEqual({ x: -100, y: 150 })
  })

  it('모든 방향에서 슬롯 축과 레인 축은 수직인 단위 벡터다', () => {
    for (const d of DIRECTIONS) {
      const { u, v } = axes(d)
      expect(u.x * v.x + u.y * v.y).toBeCloseTo(0)
      expect(Math.hypot(u.x, u.y)).toBeCloseTo(1)
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(1)
    }
  })

  it('대각선: 오른쪽 아래로 진행', () => {
    const p = place('down-right', 1, 0, 100, 150)
    expect(p.x).toBeCloseTo(70.71, 1)
    expect(p.y).toBeCloseTo(70.71, 1)
  })
})
