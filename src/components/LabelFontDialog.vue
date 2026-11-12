<script setup lang="ts">
import { LABEL_SIZE, type LabelFont, type LabelGroup, type LabelGroupPatch } from '../domain'
import { LABEL_FONTS, labelFontCss } from '../graph/labelFont'
import ColorPicker from './ColorPicker.vue'

// 라벨 그룹 하나의 글꼴 디자인 팝업: 글꼴, 굵게·기울임·밑줄, 크기, 색. 바꾸는 즉시 그래프에 반영된다.
defineProps<{ group: LabelGroup }>()
const emit = defineEmits<{ change: [patch: LabelGroupPatch]; close: [] }>()

const FONT_IDS = Object.keys(LABEL_FONTS) as LabelFont[]
</script>

<template>
  <div class="font-pop" role="dialog" :aria-label="`${group.name} 글꼴`">
    <div class="head">
      <h3>글꼴 — {{ group.name }}</h3>
      <button type="button" class="btn ghost small" aria-label="글꼴 팝업 닫기" @click="emit('close')">✕</button>
    </div>

    <div class="preview checker">
      <span
        :style="{
          font: labelFontCss(group),
          color: group.color,
          textDecoration: group.underline ? 'underline' : undefined,
        }"
      >
        가나다 Abc 123
      </span>
    </div>

    <div class="field">
      <span class="label">글꼴</span>
      <div class="slots" role="radiogroup" aria-label="글꼴">
        <button
          v-for="id in FONT_IDS"
          :key="id"
          type="button"
          role="radio"
          class="slot font"
          :class="{ on: (group.font ?? 'sans') === id }"
          :aria-checked="(group.font ?? 'sans') === id"
          :style="{ fontFamily: LABEL_FONTS[id].family }"
          @click="emit('change', { font: id })"
        >
          {{ LABEL_FONTS[id].label }}
        </button>
      </div>
    </div>

    <div class="field">
      <span class="label">스타일</span>
      <div class="slots">
        <button
          type="button"
          class="slot"
          :class="{ on: group.bold }"
          :aria-pressed="!!group.bold"
          title="굵게"
          aria-label="굵게"
          @click="emit('change', { bold: !group.bold })"
        >
          <b>가</b>
        </button>
        <button
          type="button"
          class="slot"
          :class="{ on: group.italic }"
          :aria-pressed="!!group.italic"
          title="기울임"
          aria-label="기울임"
          @click="emit('change', { italic: !group.italic })"
        >
          <i>가</i>
        </button>
        <button
          type="button"
          class="slot"
          :class="{ on: group.underline }"
          :aria-pressed="!!group.underline"
          title="밑줄"
          aria-label="밑줄"
          @click="emit('change', { underline: !group.underline })"
        >
          <u>가</u>
        </button>
      </div>
    </div>

    <div class="field">
      <label :for="`f-size-${group.id}`">크기 {{ group.size ?? LABEL_SIZE.default }}px</label>
      <input
        :id="`f-size-${group.id}`"
        type="range"
        :min="LABEL_SIZE.min"
        :max="LABEL_SIZE.max"
        :step="LABEL_SIZE.step"
        :value="group.size ?? LABEL_SIZE.default"
        @change="emit('change', { size: Number(($event.target as HTMLInputElement).value) })"
      />
    </div>

    <div class="field">
      <span class="label">색</span>
      <ColorPicker :model-value="group.color" default-label="기본 글자색" @update:model-value="(c) => emit('change', { color: c })" />
    </div>

    <div class="actions">
      <button
        type="button"
        class="btn small"
        @click="emit('change', { font: undefined, bold: false, italic: false, underline: false, size: undefined, color: undefined })"
      >
        기본값으로
      </button>
      <span style="flex: 1" />
      <button type="button" class="btn primary small" @click="emit('close')">닫기</button>
    </div>
  </div>
</template>

<style scoped>
/* 설정 패널 왼쪽에 따로 뜨는 팝업. 좁은 화면에서는 아래쪽에 붙인다. */
.font-pop {
  position: fixed;
  top: 72px;
  right: 372px;
  z-index: 45;
  width: 290px;
  max-height: calc(100dvh - 88px);
  overflow: auto;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
@media (max-width: 720px) {
  .font-pop {
    top: auto;
    right: 16px;
    bottom: 16px;
    left: 16px;
    width: auto;
    max-height: 70dvh;
  }
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
h3 {
  margin: 0;
  font-size: 14px;
}
.preview {
  display: grid;
  place-items: center;
  min-height: 56px;
  margin-bottom: 12px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text-dim);
  overflow: hidden;
}
.slots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.slot {
  display: grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-size: 15px;
  cursor: pointer;
}
.slot.font {
  font-size: 13px;
}
.slot.on {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
input[type='range'] {
  width: 100%;
}
</style>
