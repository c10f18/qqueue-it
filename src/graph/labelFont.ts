// 라벨 그룹의 글꼴 설정 → CSS/Canvas 글꼴 문자열. 그래프와 글꼴 팝업의 미리 보기가 같이 쓴다.
// 기기 글꼴 몇 가지 + Google Fonts의 무료 글꼴(쓸 때만 내려받는다).

import { LABEL_SIZE, type LabelGroup } from '../domain'

export type FontCategory = '기본' | '고딕' | '명조' | '손글씨' | '디자인' | '고정폭' | '영문'
export const FONT_CATEGORIES: FontCategory[] = ['기본', '고딕', '명조', '손글씨', '디자인', '고정폭', '영문']

export interface FontOption {
  /** 저장되는 값. Google 글꼴은 글꼴 이름 그대로 */
  id: string
  label: string
  category: FontCategory
  /** CSS font-family 값 */
  family: string
  /** Google Fonts에서 내려받는 글꼴인지 */
  google: boolean
}

const system = (id: string, label: string, family: string): FontOption => ({ id, label, category: '기본', family, google: false })
const google = (category: FontCategory, name: string, label = name, fallback = 'sans-serif'): FontOption => ({
  id: name,
  label,
  category,
  family: `'${name}', system-ui, ${fallback}`,
  google: true,
})

export const FONT_OPTIONS: FontOption[] = [
  // 기기에 설치된 글꼴 (내려받지 않음)
  system('sans', '기본 고딕', 'system-ui, sans-serif'),
  system('serif', '기본 명조', "'Noto Serif KR', 'Nanum Myeongjo', Batang, Georgia, serif"),
  system('round', '기본 둥근', "'Nanum Gothic', 'Malgun Gothic', 'Apple SD Gothic Neo', ui-rounded, sans-serif"),
  system('mono', '기본 고정폭', "ui-monospace, 'D2Coding', Consolas, monospace"),

  google('고딕', 'Noto Sans KR', '노토 산스'),
  google('고딕', 'Nanum Gothic', '나눔고딕'),
  google('고딕', 'IBM Plex Sans KR', 'IBM 플렉스 산스'),
  google('고딕', 'Gowun Dodum', '고운돋움'),
  google('고딕', 'Do Hyeon', '도현'),
  google('고딕', 'Jua', '주아'),
  google('고딕', 'Sunflower', '해바라기'),
  google('고딕', 'Gothic A1', '고딕 A1'),
  google('고딕', 'Orbit', '오르빗'),
  google('고딕', 'Dongle', '동글'),

  google('명조', 'Noto Serif KR', '노토 세리프', 'serif'),
  google('명조', 'Nanum Myeongjo', '나눔명조', 'serif'),
  google('명조', 'Gowun Batang', '고운바탕', 'serif'),
  google('명조', 'Song Myung', '송명', 'serif'),
  google('명조', 'Hahmlet', '함렛', 'serif'),
  google('명조', 'Diphylleia', '산우산', 'serif'),
  google('명조', 'Grandiflora One', '그란디플로라', 'serif'),

  google('손글씨', 'Nanum Pen Script', '나눔손글씨 펜', 'cursive'),
  google('손글씨', 'Nanum Brush Script', '나눔손글씨 붓', 'cursive'),
  google('손글씨', 'Gaegu', '개구', 'cursive'),
  google('손글씨', 'Gamja Flower', '감자꽃', 'cursive'),
  google('손글씨', 'Hi Melody', '하이멜로디', 'cursive'),
  google('손글씨', 'Poor Story', '푸어스토리', 'cursive'),
  google('손글씨', 'Single Day', '싱글데이', 'cursive'),
  google('손글씨', 'Yeon Sung', '연성', 'cursive'),
  google('손글씨', 'Cute Font', '큐트', 'cursive'),
  google('손글씨', 'Dokdo', '독도', 'cursive'),
  google('손글씨', 'East Sea Dokdo', '동해독도', 'cursive'),

  google('디자인', 'Black Han Sans', '검은고딕'),
  google('디자인', 'Bagel Fat One', '베이글 팻'),
  google('디자인', 'Gasoek One', '가석'),
  google('디자인', 'Gugi', '구기'),
  google('디자인', 'Stylish', '스타일리시'),
  google('디자인', 'Kirang Haerang', '기랑해랑'),
  google('디자인', 'Black And White Picture', '흑백사진'),
  google('디자인', 'Moirai One', '모이라이'),

  google('고정폭', 'Nanum Gothic Coding', '나눔고딕코딩', 'monospace'),
  google('고정폭', 'JetBrains Mono', 'JetBrains Mono', 'monospace'),
  google('고정폭', 'Roboto Mono', 'Roboto Mono', 'monospace'),
  google('고정폭', 'Source Code Pro', 'Source Code Pro', 'monospace'),

  google('영문', 'Inter'),
  google('영문', 'Roboto'),
  google('영문', 'Montserrat'),
  google('영문', 'Poppins'),
  google('영문', 'Playfair Display', 'Playfair Display', 'serif'),
  google('영문', 'Lora', 'Lora', 'serif'),
  google('영문', 'Bebas Neue'),
  google('영문', 'Pacifico', 'Pacifico', 'cursive'),
  google('영문', 'Caveat', 'Caveat', 'cursive'),
]

const BY_ID = new Map(FONT_OPTIONS.map((f) => [f.id, f]))
const DEFAULT_FONT = FONT_OPTIONS[0]

/** 저장된 글꼴 값에 해당하는 글꼴. 모르는 값이면 기본 고딕 */
export function fontOption(id: string | undefined): FontOption {
  return (id && BY_ID.get(id)) || DEFAULT_FONT
}

// 이미 요청한 글꼴은 다시 요청하지 않는다.
const requested = new Map<string, Promise<void>>()
const READY = Promise.resolve()

/**
 * Google 글꼴이면 스타일시트를 붙인다. 기기 글꼴이면 아무것도 하지 않는다.
 * 돌려주는 Promise는 스타일시트가 준비되면(또는 받지 못해도) 끝난다.
 * 실제 글자 파일은 그 뒤에 그 글꼴로 글자를 그리거나 document.fonts.load를 부를 때 받아 온다.
 */
export function ensureFont(id: string | undefined): Promise<void> {
  const font = fontOption(id)
  if (!font.google || typeof document === 'undefined') return READY
  let ready = requested.get(font.id)
  if (!ready) {
    ready = new Promise<void>((resolve) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      // 굵게가 없는 글꼴도 있어서, 없는 굵기를 요청해도 되는 주소 형식을 쓴다.
      link.href = `https://fonts.googleapis.com/css?family=${encodeURIComponent(font.id).replace(/%20/g, '+')}:400,700&display=swap`
      link.onload = () => resolve()
      // 인터넷이 없으면 기기 글꼴로 대신 보인다.
      link.onerror = () => resolve()
      document.head.appendChild(link)
    })
    requested.set(font.id, ready)
  }
  return ready
}

/** Canvas의 ctx.font / CSS의 font 단축 속성에 넣을 문자열. scale은 확대에 따른 글자 배율 */
export function labelFontCss(group: LabelGroup, scale = 1): string {
  const size = Math.round((group.size ?? LABEL_SIZE.default) * scale)
  return `${group.italic ? 'italic ' : ''}${group.bold ? '700 ' : ''}${size}px ${fontOption(group.font).family}`
}
