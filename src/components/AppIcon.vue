<script setup lang="ts">
// 앱 전체가 쓰는 아이콘 한 벌. 모두 같은 굵기의 선 아이콘이고 색은 글자색(currentColor)을 따른다.
// main.ts에서 전역 등록하므로 어디서나 <AppIcon name="..." />로 쓴다.
export type IconName = keyof typeof ICONS

const ICONS = {
  back: '<path d="M9.5 3.5L5 8l4.5 4.5M5 8h8.5" />',
  undo: '<path d="M5.5 3.5L2.5 6.5l3 3M2.5 6.5h7a4 4 0 0 1 0 8H7" />',
  redo: '<path d="M10.5 3.5l3 3-3 3M13.5 6.5h-7a4 4 0 0 0 0 8H9" />',
  settings:
    '<path d="M2 4.5h6M11.5 4.5H14M2 11.5h2.5M8 11.5h6" /><circle cx="9.75" cy="4.5" r="1.75" /><circle cx="6.25" cy="11.5" r="1.75" />',
  pen: '<path d="M11.3 1.7a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L5.6 13.4l-3.7.8.8-3.7z" /><path d="M9.8 3.2l3 3" />',
  copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />',
  doc: '<path d="M4 1.8h5.2L12.5 5v9.2H4z" /><path d="M9 1.8V5.2h3.4M6 8.5h4.5M6 11h4.5" />',
  trash: '<path d="M2.8 4.2h10.4M6.3 4.2V2.6h3.4v1.6M4.2 4.2l.6 9.2h6.4l.6-9.2M6.7 6.8v4M9.3 6.8v4" />',
  search: '<circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />',
  close: '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />',
  menu: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />',
  more: '<circle cx="3.5" cy="8" r="0.6" /><circle cx="8" cy="8" r="0.6" /><circle cx="12.5" cy="8" r="0.6" />',
  plus: '<path d="M8 3v10M3 8h10" />',
  minus: '<path d="M3 8h10" />',
  check: '<path d="M3 8.5l3.2 3.2L13 4.8" />',
  grip:
    '<circle cx="6" cy="4" r="0.6" /><circle cx="10" cy="4" r="0.6" /><circle cx="6" cy="8" r="0.6" /><circle cx="10" cy="8" r="0.6" /><circle cx="6" cy="12" r="0.6" /><circle cx="10" cy="12" r="0.6" />',
  eye: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" />',
  'eye-off':
    '<path d="M6.3 3.7A6.6 6.6 0 0 1 8 3.5c4 0 6.5 4.5 6.5 4.500a11 11 0 0 1-1.9 2.400M10.8 11.700A6 6 0 0 1 8 12.500C4 12.5 1.5 8 1.5 8a11 11 0 0 1 2.7-3.100M2.5 2.500l11 11" />',
  palette: '<path d="M8 1.800S3.5 6.3 3.5 9.500a4.5 4.5 0 0 0 9 0C12.5 6.3 8 1.8 8 1.800z" />',
  reset: '<path d="M2.5 3v3.500H6M2.8 6.500A5.5 5.5 0 1 1 3 10" />',
  move: '<path d="M8 1.500v13M1.5 8h13M8 1.500L6 3.500M8 1.500l2 2M8 14.500l-2-2M8 14.500l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2" />',
  rotate: '<path d="M13.5 3v3.500H10M13.2 6.500A5.5 5.5 0 1 0 13 10" />',
  fit: '<path d="M2.5 6V2.500H6M10 2.500h3.500V6M13.5 10v3.500H10M6 13.500H2.500V10" />',
  camera: '<path d="M2 5.500h2.200l1-1.500h5.600l1 1.500H14v7H2z" /><circle cx="8" cy="9" r="2.2" />',
  label: '<path d="M2 8.300V2.500h5.800l6.2 6.2-5.8 5.800z" /><circle cx="5" cy="5.5" r="0.8" />',
  'chevron-down': '<path d="M4 6l4 4 4-4" />',
  'chevron-right': '<path d="M6 4l4 4-4 4" />',
  up: '<path d="M8 13V3M3.5 7.500L8 3l4.5 4.5" />',
  down: '<path d="M8 3v10M3.5 8.500L8 13l4.5-4.5" />',
  link: '<path d="M6.5 9.500a3 3 0 0 0 4.2 0l2.3-2.300a3 3 0 0 0-4.2-4.200L8 3.800M9.5 6.500a3 3 0 0 0-4.2 0L3 8.800a3 3 0 0 0 4.2 4.200L8 12.2" />',
  download: '<path d="M8 2v8.500M4.5 7L8 10.5 11.5 7M2.5 13.500h11" />',
  upload: '<path d="M8 10.500V2M4.5 5.500L8 2l3.5 3.500M2.5 13.500h11" />',
  tasks: '<path d="M2.5 4l1.2 1.200L6 3M2.5 9l1.2 1.200L6 8M8.5 4.500h5M8.5 9.500h5" />',
  hidden: '<path d="M2 6.500s2.3 3 6 3 6-3 6-3M4 9.300l-1 1.700M8 9.500v2M12 9.300l1 1.7" />',
} as const

withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 16 })
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- 위의 고정된 목록에서만 온다 -->
  <svg class="app-icon" viewBox="0 0 16 16" :width="size" :height="size" aria-hidden="true" v-html="ICONS[name]" />
</template>

<style>
.app-icon {
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  vertical-align: middle;
}
</style>
