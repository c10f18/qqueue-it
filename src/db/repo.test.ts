import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createBoardData, createTemplateFromBoard, updateNode } from '../domain'
import { QQueueDB } from './db'
import { createDexieRepo } from './repo'

it('이름만 바꿔 저장하면 나머지 내용은 그대로다', async () => {
  const repo = createDexieRepo(new QQueueDB(`test-${crypto.randomUUID()}`))
  const data = createBoardData('처음')
  await repo.saveBoard(data)
  await repo.renameBoard(data.board.id, '바꿈')
  const loaded = await repo.loadBoard(data.board.id)
  expect(loaded!.board.name).toBe('바꿈')
  expect(loaded!.lanes).toHaveLength(1)
  expect(loaded!.board.slotOrder).toEqual(data.board.slotOrder)
})

describe('Dexie 어댑터', () => {
  it('저장 → 불러오기 → 목록 → 삭제', async () => {
    const repo = createDexieRepo(new QQueueDB('test-db'))
    let data = createBoardData('보드')
    // 새 보드에는 작업이 하나 들어 있다.
    data = updateNode(data, data.nodes[0].id, { name: 'a', tags: ['x'], progress: 100 }).data
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

  it('템플릿 저장 → 목록 → 삭제', async () => {
    const repo = createDexieRepo(new QQueueDB('test-db-templates'))
    const data = createBoardData('보드')
    const template = createTemplateFromBoard(data, '템플릿')
    await repo.saveTemplate(template)
    expect(await repo.listTemplates()).toEqual([template])
    await repo.deleteTemplate(template.id)
    expect(await repo.listTemplates()).toEqual([])
  })
})
