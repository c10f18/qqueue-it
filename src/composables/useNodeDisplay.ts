// 명세 24.2: 포맷팅은 한 곳에, 레이아웃은 스킨별로 분리한다.
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { isCompleted, type TaskNode } from '../domain'

export type AttrKey =
  | 'name'
  | 'description'
  | 'tags'
  | 'icon'
  | 'progress'
  | 'count'
  | 'completed'
  | 'deadline'
  | 'createdAt'

export const ATTR_LABELS: Record<AttrKey, string> = {
  name: '이름',
  description: '설명',
  tags: '태그',
  icon: '아이콘',
  progress: '진행도',
  count: '횟수',
  completed: '완료',
  deadline: '데드라인',
  createdAt: '생성일',
}

export const DEFAULT_ATTRS: AttrKey[] = ['icon', 'name', 'progress']

function formatDate(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function formatAttr(key: AttrKey, node: TaskNode): string {
  switch (key) {
    case 'progress':
      return `${node.progress}%`
    case 'completed':
      return isCompleted(node) ? '완료' : '진행중'
    case 'deadline':
      return node.deadline ? formatDate(node.deadline) : '-'
    case 'createdAt':
      return formatDate(node.createdAt)
    case 'tags':
      return node.tags.join(', ')
    case 'count':
      return String(node.count)
    default:
      return node[key] ?? ''
  }
}

export function useNodeDisplay(
  node: MaybeRefOrGetter<TaskNode>,
  visibleAttrs: MaybeRefOrGetter<AttrKey[]>,
) {
  const fields = computed(() =>
    toValue(visibleAttrs).map((key) => ({
      key,
      label: ATTR_LABELS[key],
      value: formatAttr(key, toValue(node)),
    })),
  )
  const completed = computed(() => isCompleted(toValue(node)))
  return { fields, completed }
}
