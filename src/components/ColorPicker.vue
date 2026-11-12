<script setup lang="ts">
import { computed } from 'vue'

// 색 선택기: 기본값(지정 안 함) / 투명 / 팔레트 / 직접 선택 + 불투명도.
// 값 형식은 '#rrggbb', '#rrggbbaa', 'transparent', 또는 undefined(기본값).
const props = defineProps<{
  modelValue: string | undefined
  /** "기본값" 버튼의 설명 (예: 테마 색) */
  defaultLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const SWATCHES = [
  '#22221f', '#6c6c64', '#ffffff', '#d84a6b', '#e2703a', '#d9a62b',
  '#35b37a', '#2aa8a8', '#3b7dd8', '#5b5fe0', '#9a55d6', '#d455b0',
]

const isTransparent = computed(() => props.modelValue === 'transparent')
const rgb = computed(() => {
  const v = props.modelValue
  return v && v.startsWith('#') ? v.slice(0, 7) : '#3b7dd8'
})
const alpha = computed(() => {
  const v = props.modelValue
  if (v === 'transparent') return 0
  if (v && v.length === 9) return Math.round((parseInt(v.slice(7, 9), 16) / 255) * 100)
  return 100
})

function compose(hex: string, percent: number): string {
  if (percent >= 100) return hex
  const a = Math.round((Math.max(0, percent) / 100) * 255)
  return hex + a.toString(16).padStart(2, '0')
}
function pick(hex: string) {
  emit('update:modelValue', compose(hex, isTransparent.value ? 100 : alpha.value))
}
function setAlpha(e: Event) {
  emit('update:modelValue', compose(rgb.value, Number((e.target as HTMLInputElement).value)))
}
</script>

<template>
  <div class="cp">
    <div class="swatches">
      <button
        type="button"
        class="sw default"
        :class="{ on: modelValue === undefined }"
        :title="defaultLabel ?? '기본값'"
        @click="emit('update:modelValue', undefined)"
      >
        A
      </button>
      <button
        type="button"
        class="sw checker"
        :class="{ on: isTransparent }"
        title="투명"
        @click="emit('update:modelValue', 'transparent')"
      />
      <button
        v-for="c in SWATCHES"
        :key="c"
        type="button"
        class="sw"
        :class="{ on: !isTransparent && modelValue?.slice(0, 7) === c }"
        :style="{ background: c }"
        :title="c"
        @click="pick(c)"
      />
      <label class="sw custom" title="직접 선택">
        <input type="color" :value="rgb" @change="pick(($event.target as HTMLInputElement).value)" />
        🎨
      </label>
    </div>
    <label class="alpha">
      <span class="muted">불투명도 {{ alpha }}%</span>
      <input type="range" min="0" max="100" step="5" :value="alpha" :disabled="modelValue === undefined" @change="setAlpha" />
      <span class="preview checker"><span :style="{ background: modelValue ?? 'transparent' }" /></span>
    </label>
  </div>
</template>

<style scoped>
.cp {
  display: grid;
  gap: 6px;
}
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.sw {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-size: 11px;
  cursor: pointer;
  overflow: hidden;
}
.sw.on {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.checker {
  background-image:
    linear-gradient(45deg, #bbb 25%, transparent 25%, transparent 75%, #bbb 75%),
    linear-gradient(45deg, #bbb 25%, #fff 25%, #fff 75%, #bbb 75%);
  background-size: 10px 10px;
  background-position:
    0 0,
    5px 5px;
}
.custom {
  position: relative;
}
.custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.alpha {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
.preview {
  width: 36px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.preview span {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
