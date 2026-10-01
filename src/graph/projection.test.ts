import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEW, clampPitch, fitZoom, makeProjector } from './projection'

describe('큐 그래프 투영', () => {
  it('회전이 없으면 평면 그대로 화면 중앙 기준으로 놓인다', () => {
    const project = makeProjector({ ...DEFAULT_VIEW }, 400, 300)
    const p = project({ x: 10, y: -20, z: 0 })
    expect(p.x).toBeCloseTo(210)
    expect(p.y).toBeCloseTo(130)
    expect(p.scale).toBeCloseTo(1)
  })

  it('pan과 zoom이 반영된다', () => {
    const project = makeProjector({ ...DEFAULT_VIEW, zoom: 2, panX: 30, panY: -10 }, 400, 300)
    const p = project({ x: 10, y: 0, z: 0 })
    expect(p.x).toBeCloseTo(200 + 30 + 20)
    expect(p.y).toBeCloseTo(150 - 10)
  })

  it('Y축으로 90도 돌리면 x축 좌표가 깊이로 간다 (원근으로 멀어지면 작아진다)', () => {
    const project = makeProjector({ ...DEFAULT_VIEW, yaw: Math.PI / 2 }, 400, 300)
    const p = project({ x: 100, y: 0, z: 0 })
    expect(p.x).toBeCloseTo(200, 0)
    expect(p.depth).toBeCloseTo(-100, 0)
    expect(p.scale).toBeGreaterThan(1) // z가 음수 → 가까워짐
  })

  it('pitch는 수직으로 눕지 않게 제한된다', () => {
    expect(clampPitch(10)).toBeLessThan(Math.PI / 2)
    expect(clampPitch(-10)).toBeGreaterThan(-Math.PI / 2)
  })

  it('fitZoom은 영역에 맞고 범위가 제한된다', () => {
    expect(fitZoom([], 400, 300)).toBe(1)
    const z = fitZoom([{ x: 0, y: 0, z: 0 }, { x: 1000, y: 500, z: 0 }], 400, 300)
    expect(z).toBeLessThan(0.5)
    expect(z).toBeGreaterThanOrEqual(0.2)
  })
})
