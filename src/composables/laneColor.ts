// 카테고리 순서별 강조색 (최대 5개)
const HUES = [215, 150, 32, 285, 350]

export function laneColor(index: number): string {
  const hue = HUES[((index % HUES.length) + HUES.length) % HUES.length]
  return `hsl(${hue} 62% 52%)`
}
