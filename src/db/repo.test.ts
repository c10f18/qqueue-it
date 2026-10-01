import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createBoardData, createNode, updateNode } from '../domain'
import { QQueueDB } from './db'
import { createDexieRepo } from './repo'

describe('Dexie 어댑터', () => {
  it('저장 → 불러오기 → 목록 → 삭제', async () => {
    const repo = createDexieRepo(new QQueueDB('test-db'))
    let data = createBoardData('보드')
    data = createNode(data, data.board.slotOrder[0], data.lanes[0].id, { name: 'a', tags: ['x'] }).data
    data = updateNode(data, data.nodes[0].id, { progress: 100 }).data
    await repo.saveBoard(data)

    expect(await repo.loadBoard(data.board.id)).toEqual(data)
    const [summary] = await repo.listBoards()
    expect(summary).toMatchObject({ name: '보드', nodeCount: 1, doneCount: 1 })

    // 다시 저장해도 중복이 생기지 않는다
    await repo.saveBoard(data)
    expect((await repo.loadBoard(data.board.id))!.nodes).toHaveLength(1)

    await repo.deleteBoard(data.board.id)
    expect(await repo.loadBoard(data.board.id)).toBeUndefined()
  })
})
