// 수정 모드 레이아웃: 그래프를 카드 영역의 어느 쪽에 붙일지(도크 위치) 또는 한쪽만 볼지.

export type EditLayout = 'left' | 'right' | 'top' | 'bottom' | 'cards' | 'graph'

export interface LayoutOption {
  value: EditLayout
  label: string
  /** 아이콘(18×14) 안에서 그래프가 차지하는 칸. 없으면 카드만 */
  fill?: { x: number; y: number; w: number; h: number }
}

export const DOCK_LAYOUTS: LayoutOption[] = [
  { value: 'left', label: '그래프를 왼쪽에', fill: { x: 3, y: 3, w: 5, h: 8 } },
  { value: 'right', label: '그래프를 오른쪽에', fill: { x: 10, y: 3, w: 5, h: 8 } },
  { value: 'top', label: '그래프를 위에', fill: { x: 3, y: 3, w: 12, h: 3.5 } },
  { value: 'bottom', label: '그래프를 아래에', fill: { x: 3, y: 7.5, w: 12, h: 3.5 } },
]
export const FULL_LAYOUTS: LayoutOption[] = [
  { value: 'cards', label: '카드만' },
  { value: 'graph', label: '그래프만', fill: { x: 3, y: 3, w: 12, h: 8 } },
]
export const LAYOUTS = [...DOCK_LAYOUTS, ...FULL_LAYOUTS]

/** 화면 크기·방향에 맞는 기본 레이아웃 */
export function defaultLayout(): EditLayout {
  if (!window.matchMedia('(min-width: 640px)').matches) return 'cards'
  return window.matchMedia('(orientation: landscape)').matches ? 'top' : 'left'
}
