// 예전 버전이 저장해 둔 데이터에서 지금은 쓰지 않는 항목을 걷어 낸다.
// 저장소에서 읽을 때와 파일을 가져올 때 거친다. 받은 값을 직접 고쳐서 돌려준다.

import type { BoardData } from './types'

export function cleanLegacy(data: BoardData): BoardData {
  const settings = data.board.settings as Record<string, unknown>
  // 슬롯 번호는 항상 표시한다 (옵션 없음)
  delete settings.showSlotNumbers
  // 그래프의 진행률 표시는 보드의 "백분율" 옵션 하나로 합쳤다
  const graph = data.board.settings.graph as Record<string, unknown> | undefined
  if (graph) delete graph.showProgress
  // 횟수 기능은 없앴다
  for (const node of data.nodes) delete (node as unknown as Record<string, unknown>).count
  return data
}
