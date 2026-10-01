// Pointer Events 기반 드래그 (명세 16장: 직접 구현). 마우스·터치를 같은 코드로 처리한다.
// 세 종류: 노드(셀/경계선에 드롭), 슬롯 행(순서 이동), 카테고리 열(순서 이동).

import { onUnmounted, reactive } from 'vue'

export type DropTarget =
  | { kind: 'cell'; slotId: string; laneId: string }
  | { kind: 'boundary'; afterSlotId: string | null; laneId: string }

export interface DragState {
  active: boolean
  kind: 'node' | 'slot' | 'lane' | null
  id: string | null
  label: string
  x: number
  y: number
  /** 노드 드래그 중 현재 드롭 후보 */
  target: DropTarget | null
  /** 슬롯/레인 드래그 중 놓일 위치 (제거 후 배열 기준 index) */
  index: number | null
}

export interface DragHandlers {
  dropNode(nodeId: string, target: DropTarget): void
  moveSlot(slotId: string, toIndex: number): void
  moveLane(laneId: string, toIndex: number): void
}

const THRESHOLD = 5
const EDGE = 48
const SCROLL_SPEED = 14

export function useTimetableDrag(
  getScroller: () => HTMLElement | null,
  handlers: DragHandlers,
) {
  const drag = reactive<DragState>({
    active: false,
    kind: null,
    id: null,
    label: '',
    x: 0,
    y: 0,
    target: null,
    index: null,
  })

  let pending: { kind: 'node' | 'slot' | 'lane'; id: string; label: string; x: number; y: number } | null = null
  let raf = 0

  function reset() {
    pending = null
    drag.active = false
    drag.kind = null
    drag.id = null
    drag.target = null
    drag.index = null
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey)
    document.body.classList.remove('is-dragging')
  }

  function start(
    e: PointerEvent,
    kind: 'node' | 'slot' | 'lane',
    id: string,
    label: string,
  ) {
    if (e.button !== 0) return
    pending = { kind, id, label, x: e.clientX, y: e.clientY }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') reset()
  }

  function onCancel() {
    reset()
  }

  function onMove(e: PointerEvent) {
    if (!pending) return
    if (!drag.active) {
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < THRESHOLD) return
      drag.active = true
      drag.kind = pending.kind
      drag.id = pending.id
      drag.label = pending.label
      document.body.classList.add('is-dragging')
      autoScrollLoop()
    }
    drag.x = e.clientX
    drag.y = e.clientY
    updateTarget()
  }

  function updateTarget() {
    if (drag.kind === 'node') {
      const el = document.elementFromPoint(drag.x, drag.y) as HTMLElement | null
      const cell = el?.closest<HTMLElement>('[data-cell]')
      if (cell) {
        drag.target = { kind: 'cell', slotId: cell.dataset.slot!, laneId: cell.dataset.lane! }
        return
      }
      const seg = el?.closest<HTMLElement>('[data-boundary]')
      if (seg) {
        drag.target = {
          kind: 'boundary',
          afterSlotId: seg.dataset.after ? seg.dataset.after : null,
          laneId: seg.dataset.lane!,
        }
        return
      }
      drag.target = null
    } else if (drag.kind === 'slot') {
      drag.index = indexAmong('[data-row-slot]', drag.id!, 'rowSlot', 'y')
    } else if (drag.kind === 'lane') {
      drag.index = indexAmong('[data-lane-head]', drag.id!, 'laneHead', 'x')
    }
  }

  /** 드래그 중인 요소를 뺀 나머지 중, 중점이 포인터보다 앞쪽에 있는 개수 = 놓일 index */
  function indexAmong(selector: string, selfId: string, dataKey: string, axis: 'x' | 'y'): number {
    const items = [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (el) => el.dataset[dataKey] !== selfId,
    )
    const pos = axis === 'x' ? drag.x : drag.y
    let index = 0
    for (const el of items) {
      const r = el.getBoundingClientRect()
      const mid = axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2
      if (mid < pos) index++
    }
    return index
  }

  function onUp() {
    if (drag.active && drag.id) {
      if (drag.kind === 'node' && drag.target) handlers.dropNode(drag.id, drag.target)
      else if (drag.kind === 'slot' && drag.index !== null) handlers.moveSlot(drag.id, drag.index)
      else if (drag.kind === 'lane' && drag.index !== null) handlers.moveLane(drag.id, drag.index)
    }
    reset()
  }

  // 포인터가 스크롤 영역 가장자리에 있으면 계속 스크롤한다.
  function autoScrollLoop() {
    const tick = () => {
      if (!drag.active) return
      const scroller = getScroller()
      if (scroller) {
        const r = scroller.getBoundingClientRect()
        if (drag.y < r.top + EDGE) scroller.scrollTop -= SCROLL_SPEED
        else if (drag.y > r.bottom - EDGE) scroller.scrollTop += SCROLL_SPEED
        if (drag.x < r.left + EDGE) scroller.scrollLeft -= SCROLL_SPEED
        else if (drag.x > r.right - EDGE) scroller.scrollLeft += SCROLL_SPEED
        updateTarget()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  onUnmounted(reset)

  return {
    drag,
    startNode: (e: PointerEvent, id: string, label: string) => start(e, 'node', id, label),
    startSlot: (e: PointerEvent, id: string, label: string) => start(e, 'slot', id, label),
    startLane: (e: PointerEvent, id: string, label: string) => start(e, 'lane', id, label),
  }
}
