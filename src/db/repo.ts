// 데이터 접근 어댑터. 화면/스토어는 Dexie를 직접 쓰지 않고 이 인터페이스만 쓴다.
// 후일 서버 동기화로 교체할 때 이 파일만 바꾸면 된다. (명세 16장)

import type { Board, BoardData } from '../domain'
import { QQueueDB } from './db'

export interface BoardSummary extends Board {
  nodeCount: number
  doneCount: number
}

export interface BoardRepo {
  listBoards(): Promise<BoardSummary[]>
  loadBoard(boardId: string): Promise<BoardData | undefined>
  saveBoard(data: BoardData): Promise<void>
  deleteBoard(boardId: string): Promise<void>
}

export function createDexieRepo(db: QQueueDB = new QQueueDB()): BoardRepo {
  return {
    async listBoards() {
      const boards = await db.boards.orderBy('updatedAt').reverse().toArray()
      return Promise.all(
        boards.map(async (b) => {
          const nodes = await db.nodes.where('boardId').equals(b.id).toArray()
          return {
            ...b,
            nodeCount: nodes.length,
            doneCount: nodes.filter((n) => n.progress === 100).length,
          }
        }),
      )
    },

    async loadBoard(boardId) {
      const board = await db.boards.get(boardId)
      if (!board) return undefined
      const [lanes, slots, nodes] = await Promise.all([
        db.lanes.where('boardId').equals(boardId).toArray(),
        db.slots.where('boardId').equals(boardId).toArray(),
        db.nodes.where('boardId').equals(boardId).toArray(),
      ])
      return { board, lanes, slots, nodes }
    },

    // 보드 하나는 수백 개 수준이라 통째로 갈아끼운다. 한 트랜잭션이라 중간 상태가 남지 않는다.
    async saveBoard(data) {
      const id = data.board.id
      await db.transaction('rw', [db.boards, db.lanes, db.slots, db.nodes], async () => {
        await db.boards.put(structuredClone(data.board))
        await db.lanes.where('boardId').equals(id).delete()
        await db.slots.where('boardId').equals(id).delete()
        await db.nodes.where('boardId').equals(id).delete()
        await db.lanes.bulkAdd(structuredClone(data.lanes))
        await db.slots.bulkAdd(structuredClone(data.slots))
        await db.nodes.bulkAdd(structuredClone(data.nodes))
      })
    },

    async deleteBoard(boardId) {
      await db.transaction('rw', [db.boards, db.lanes, db.slots, db.nodes], async () => {
        await db.boards.delete(boardId)
        await db.lanes.where('boardId').equals(boardId).delete()
        await db.slots.where('boardId').equals(boardId).delete()
        await db.nodes.where('boardId').equals(boardId).delete()
      })
    },
  }
}
