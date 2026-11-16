// 전역으로 등록한 컴포넌트의 타입 (템플릿에서 import 없이 쓴다)
import type AppIcon from './components/AppIcon.vue'

declare module 'vue' {
  interface GlobalComponents {
    AppIcon: typeof AppIcon
  }
}
export {}
