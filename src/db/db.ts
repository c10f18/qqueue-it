import Dexie, { type EntityTable } from 'dexie'
import type { Board, Lane, Slot, TaskNode, Template } from '../domain'

// 명세 17.2 스토어 정의
export class QQueueDB extends Dexie {
  boards!: EntityTable<Board, 'id'>
  lanes!: EntityTable<Lane, 'id'>
  slots!: EntityTable<Slot, 'id'>
  nodes!: EntityTable<TaskNode, 'id'>
  templates!: EntityTable<Template, 'id'>

  constructor(name = 'qqueue-it') {
    super(name)
    this.version(1).stores({
      boards: 'id, updatedAt',
      lanes: 'id, boardId, [boardId+order]',
      slots: 'id, boardId',
      nodes: 'id, boardId, slotId, laneId, [slotId+laneId], *tags, visible',
      templates: 'id, updatedAt',
    })
  }
}
