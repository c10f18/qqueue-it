import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { createDexieRepo, type BoardRepo, type BoardSummary } from '../db/repo'
import {
  cloneBoardData,
  createBoardData,
  createBoardFromTemplate,
  createTemplateFromBoard,
  DomainError,
  type BoardData,
  type OpResult,
  type Template,
} from '../domain'

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
  const templates = shallowRef<Template[]>([])
  const current = shallowRef<BoardData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const histories = new Map<string, History>()
  const historyState = shallowRef({ cursor: 0, length: 0 })

  let gesture: string | null = null
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

  // 수정 모드에서는 자동 저장을 끄고, 사용자가 "저장"을 눌러야 저장한다.
  // 그 밖의 화면(보기 모드 등)에서는 바꾸는 즉시 저장한다.
  const autosave = ref(true)
  /** 아직 저장하지 않은 변경이 있는지 */
  const dirty = ref(false)

  function commit(data: BoardData) {
    if (autosave.value) void persist(data)
    else dirty.value = true
  }
  /** 저장하지 않은 변경을 저장한다. */
  function save(): Promise<void> {
    if (!dirty.value || !current.value) return saveQueue
    dirty.value = false
    return persist(current.value)
  }
  /** 자동 저장을 켜고 끈다. 켤 때 밀린 변경이 있으면 저장한다. */
  function setAutosave(on: boolean) {
    autosave.value = on
    if (on) void save()
  }
  /** 저장하지 않은 변경을 버리고 마지막으로 저장한 상태로 되돌린다. 되돌리기 기록도 비운다. */
  async function discard() {
    const id = current.value?.board.id
    if (!id) return
    dirty.value = false
    gesture = null
    await saveQueue
    const data = await repo.loadBoard(id)
    if (!data) return
    current.value = data
    const h = { stack: [data], cursor: 0 }
    histories.set(id, h)
    syncHistoryState(h)
  }

  function syncHistoryState(h: History | undefined) {
    historyState.value = h ? { cursor: h.cursor, length: h.stack.length } : { cursor: 0, length: 0 }
  }

  const canUndo = computed(() => historyState.value.cursor > 0)
  const canRedo = computed(() => historyState.value.cursor < historyState.value.length - 1)

  async function refreshBoards() {
    await saveQueue
    boards.value = await repo.listBoards()
  }

  async function createBoard(name: string): Promise<string> {
    const data = createBoardData(name)
    await persist(data)
    await refreshBoards()
    return data.board.id
  }

  async function refreshTemplates() {
    templates.value = await repo.listTemplates()
  }

  /** 보드 전체 복제 (FR-80): 슬롯 구조를 유지하고 진행도·횟수는 0으로 시작한다. */
  async function cloneBoard(boardId: string): Promise<string | undefined> {
    await saveQueue
    const data = await repo.loadBoard(boardId)
    if (!data) return undefined
    const copy = cloneBoardData(data, `${data.board.name} (복제)`)
    await persist(copy)
    await refreshBoards()
    return copy.board.id
  }

  /** 보드를 템플릿으로 저장 (FR-81) */
  async function saveAsTemplate(boardId: string, name: string) {
    await saveQueue
    const data = await repo.loadBoard(boardId)
    if (!data) return
    await repo.saveTemplate(createTemplateFromBoard(data, name))
    await refreshTemplates()
  }

  async function createBoardFromTemplateId(templateId: string, name: string): Promise<string | undefined> {
    const template = templates.value.find((t) => t.id === templateId)
    if (!template) return undefined
    const data = createBoardFromTemplate(template, name)
    await persist(data)
    await refreshBoards()
    return data.board.id
  }

  async function deleteTemplate(templateId: string) {
    await repo.deleteTemplate(templateId)
    await refreshTemplates()
  }

  async function deleteBoard(boardId: string) {
    await saveQueue
    await repo.deleteBoard(boardId)
    histories.delete(boardId)
    if (current.value?.board.id === boardId) {
      dirty.value = false
      current.value = null
      syncHistoryState(undefined)
    }
    await refreshBoards()
  }

  /** 여러 보드를 한 번에 삭제 (목록의 선택 삭제·전체 삭제) */
  async function deleteBoards(boardIds: string[]) {
    await saveQueue
    for (const id of boardIds) {
      await repo.deleteBoard(id)
      histories.delete(id)
    }
    if (current.value && boardIds.includes(current.value.board.id)) {
      dirty.value = false
      current.value = null
      syncHistoryState(undefined)
    }
    await refreshBoards()
  }

  async function openBoard(boardId: string): Promise<boolean> {
    if (current.value?.board.id === boardId) return true
    loading.value = true
    try {
      // 다른 보드로 넘어가기 전에 밀린 변경은 저장해 둔다.
      await save()
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
    // 저장하지 않은 변경이 남아 있으면 잃지 않도록 저장하고 닫는다.
    void save()
    gesture = null
    current.value = null
    syncHistoryState(undefined)
  }

  // 끌어서 조정하는 동작(노브 등)은 움직이는 동안 같은 gesture 이름으로 apply를 반복 호출한다.
  // 그동안은 되돌리기 기록을 한 칸만 쓰고 저장도 미뤘다가 endGesture()에서 한 번 저장한다.
  function endGesture() {
    if (gesture && current.value) commit(current.value)
    gesture = null
  }

  /** 모든 보드 변경은 이 함수를 거친다. 도메인 규칙 위반은 error로 알리고 상태는 그대로 둔다. */
  function apply(op: (data: BoardData) => OpResult, gestureKey?: string): string | undefined {
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
    if (gestureKey && gesture === gestureKey) {
      // 같은 동작이 이어지는 중: 직전 스냅샷을 바꿔 끼운다.
      h.stack[h.cursor] = result.data
      current.value = result.data
      return result.id
    }
    endGesture()
    gesture = gestureKey ?? null
    h.stack.splice(h.cursor + 1)
    h.stack.push(result.data)
    if (h.stack.length > MAX_HISTORY) h.stack.shift()
    h.cursor = h.stack.length - 1
    syncHistoryState(h)

    current.value = result.data
    if (!gestureKey) commit(result.data)
    return result.id
  }

  function jump(delta: -1 | 1) {
    const data = current.value
    if (!data) return
    const h = histories.get(data.board.id)
    if (!h) return
    endGesture()
    const next = h.cursor + delta
    if (next < 0 || next >= h.stack.length) return
    h.cursor = next
    syncHistoryState(h)
    current.value = h.stack[next]
    commit(h.stack[next])
  }

  const undo = () => jump(-1)
  const redo = () => jump(1)

  function clearError() {
    error.value = null
  }

  return {
    boards,
    templates,
    current,
    loading,
    error,
    canUndo,
    canRedo,
    refreshBoards,
    refreshTemplates,
    cloneBoard,
    saveAsTemplate,
    createBoardFromTemplateId,
    deleteTemplate,
    createBoard,
    deleteBoard,
    deleteBoards,
    openBoard,
    closeBoard,
    dirty,
    save,
    setAutosave,
    discard,
    apply,
    endGesture,
    undo,
    redo,
    clearError,
  }
})
