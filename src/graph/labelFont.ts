// 라벨 그룹의 글꼴 설정 → CSS/Canvas 글꼴 문자열. 그래프와 글꼴 팝업의 미리 보기가 같이 쓴다.

import { LABEL_SIZE, type LabelFont, type LabelGroup } from '../domain'

export const LABEL_FONTS: Record<LabelFont, { label: string; family: string }> = {
  sans: { label: '고딕', family: 'system-ui, sans-serif' },
  serif: { label: '명조', family: "'Noto Serif KR', 'Nanum Myeongjo', Batang, Georgia, serif" },
  round: { label: '둥근', family: "'Nanum Gothic', 'Malgun Gothic', 'Apple SD Gothic Neo', ui-rounded, sans-serif" },
  mono: { label: '고정폭', family: "ui-monospace, 'D2Coding', Consolas, monospace" },
}

/** Canvas의 ctx.font / CSS의 font 단축 속성에 넣을 문자열. scale은 확대에 따른 글자 배율 */
export function labelFontCss(group: LabelGroup, scale = 1): string {
  const size = Math.round((group.size ?? LABEL_SIZE.default) * scale)
  const family = LABEL_FONTS[group.font ?? 'sans'].family
  return `${group.italic ? 'italic ' : ''}${group.bold ? '700 ' : ''}${size}px ${family}`
}
