import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { createDexieRepo, type BoardRepo, type BoardSummary } from '../db/repo'
import { createBoardData, DomainError, type BoardData, type OpResult } from '../domain'

const MAX_HISTORY = 50 // 명세 19.3

interface History {
  stack: BoardData[]
  cursor: number
}

/**
 * 보드 상태 저장소. 도메인 연산은 불변 BoardData를 돌려주므로,
 * 변경 = 새 스냅샷을 history에 쌓는 것이고 undo/redo = cursor 이동이다. (명세 19장)
 * 화면은 도메인 연산을 반드시 apply()를 통해서만 실행해야 undo 기록에서 빠지지 않는다.
 */
export const useBoardStore = defineStore('board', () => {
  const repo: BoardRepo = createDexieRepo()

  const boards = shallowRef<BoardSummary[]>([])
  const current = shallowRef<BoardData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const histories = new Map<string, History>()
  const historyState = shallowRef({ cursor: 0, length: 0 })

  let saveQueue: Promise<void> = Promise.resolve()
  function persist(data: BoardData) {
    saveQueue = saveQueue
      .then(() => repo.saveBoard(data))
      .catch((e) => {
        console.error(e)
        error.value = '저장에 실패했습니다. 브라우저 저장소를 확인해 주세요.'
      })
    return saveQueue
  }

  function syncHistoryState(h: History | undefined) {
    historyState.value = h ? { cursor: h.cursor, length: h.stack.length } : { cursor: 0, length: 0 }
  }

  const canUndo = computed(() => historyState.value.cursor > 0)
  const canRedo = computed(() => historyState.value.cursor < historyState.value.length - 1)

  async function refreshBoards() {
    boards.value = await repo.listBoards()
  }

  async function createBoard(name: string): Promise<string> {
    const data = createBoardData(name)
    await persist(data)
    await refreshBoards()
    return data.board.id
  }

  async function deleteBoard(boardId: string) {
    await saveQueue
    await repo.deleteBoard(boardId)
    histories.delete(boardId)
    if (current.value?.board.id === boardId) {
      current.value = null
      syncHistoryState(undefined)
    }
    await refreshBoards()
  }

  async function openBoard(boardId: string): Promise<boolean> {
    if (current.value?.board.id === boardId) return true
    loading.value = true
    try {
      await saveQueue
      const data = await repo.loadBoard(boardId)
      if (!data) {
        current.value = null
        syncHistoryState(undefined)
        return false
      }
      current.value = data
      let h = histories.get(boardId)
      if (!h) {
        h = { stack: [data], cursor: 0 }
        histories.set(boardId, h)
      }
      syncHistoryState(h)
      return true
    } finally {
      loading.value = false
    }
  }

  function closeBoard() {
    current.value = null
    syncHistoryState(undefined)
  }

  /** 모든 보드 변경은 이 함수를 거친다. 도메인 규칙 위반은 error로 알리고 상태는 그대로 둔다. */
  function apply(op: (data: BoardData) => OpResult): string | undefined {
    const data = current.value
    if (!data) return undefined
    let result: OpResult
    try {
      result = op(data)
    } catch (e) {
      if (e instanceof DomainError) {
        error.value = e.message
        return undefined
      }
      throw e
    }
    if (result.data === data) return result.id

    const h = histories.get(data.board.id)!
    h.stack.splice(h.cursor + 1)
    h.stack.push(result.data)
    if (h.stack.length > MAX_HISTORY) h.stack.shift()
    h.cursor = h.stack.length - 1
    syncHistoryState(h)

    current.value = result.data
    void persist(result.data)
    return result.id
  }

  function jump(delta: -1 | 1) {
    const data = current.value
    if (!data) return
    const h = histories.get(data.board.id)
    if (!h) return
    const next = h.cursor + delta
    if (next < 0 || next >= h.stack.length) return
    h.cursor = next
    syncHistoryState(h)
    current.value = h.stack[next]
    void persist(h.stack[next])
  }

  const undo = () => jump(-1)
  const redo = () => jump(1)

  function clearError() {
    error.value = null
  }

  return {
    boards,
    current,
    loading,
    error,
    canUndo,
    canRedo,
    refreshBoards,
    createBoard,
    deleteBoard,
    openBoard,
    closeBoard,
    apply,
    undo,
    redo,
    clearError,
  }
})
