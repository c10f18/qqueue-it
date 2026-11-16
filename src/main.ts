import { createPinia } from 'pinia'
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import AppIcon from './components/AppIcon.vue'

// 아이콘은 모든 화면에서 쓰므로 전역으로 등록한다.
createApp(App).use(createPinia()).component('AppIcon', AppIcon).mount('#app')
