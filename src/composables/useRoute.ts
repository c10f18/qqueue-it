import { computed, onMounted, onUnmounted, ref } from 'vue'

// 정적 호스팅(SPA 폴백 없음)이므로 hash 라우팅을 쓴다.
//   #/            보드 목록
//   #/b/:id       수정 모드
//   #/b/:id/view  보기 모드

export type Route =
  | { name: 'list' }
  | { name: 'edit'; boardId: string }
  | { name: 'view'; boardId: string }

function parse(hash: string): Route {
  const m = hash.match(/^#\/b\/([^/]+)(\/view)?$/)
  if (m) return m[2] ? { name: 'view', boardId: m[1] } : { name: 'edit', boardId: m[1] }
  return { name: 'list' }
}

export function href(route: Route): string {
  if (route.name === 'edit') return `#/b/${route.boardId}`
  if (route.name === 'view') return `#/b/${route.boardId}/view`
  return '#/'
}

export function navigate(route: Route) {
  location.hash = href(route)
}

export function useRoute() {
  const hash = ref(location.hash)
  const onChange = () => (hash.value = location.hash)
  onMounted(() => window.addEventListener('hashchange', onChange))
  onUnmounted(() => window.removeEventListener('hashchange', onChange))
  return computed(() => parse(hash.value))
}
