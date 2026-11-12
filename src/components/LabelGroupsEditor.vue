<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  addLabelGroup,
  labelGroupsOf,
  removeLabelGroup,
  updateLabelGroup,
  LABEL_SIZE,
  MAX_LABEL_GROUPS,
  NAME_LABEL_GROUP_ID,
  type BoardData,
  type GraphDirection,
  type LabelGroupPatch,
} from '../domain'
import { useBoardStore } from '../stores/board'
import ColorPicker from './ColorPicker.vue'

// 설정 패널의 "노드 라벨" 구역: 그룹 추가·삭제, 이름, 위치(8방향), 색, 크기.
const props = defineProps<{ data: BoardData }>()
const store = useBoardStore()

const groups = computed(() => labelGroupsOf(props.data))
const colorOpenId = ref<string | null>(null)

function patch(id: string, p: LabelGroupPatch) {
  store.apply((d) => updateLabelGroup(d, id, p))
}
function rename(id: string, e: Event) {
  const input = e.target as HTMLInputElement
  const current = groups.value.find((g) => g.id === id)?.name ?? ''
  if (input.value.trim() && input.value.trim() !== current) patch(id, { name: input.value })
  else input.value = current
}

// 3×3 위치 판: 가운데가 노드
const POSITIONS: (GraphDirection | null)[] = [
  'up-left', 'up', 'up-right',
  'left', null, 'right',
  'down-left', 'down', 'down-right',
]
const POSITION_LABEL: Record<GraphDirection, string> = {
  'up-left': '왼쪽 위',
  up: '위',
  'up-right': '오른쪽 위',
  left: '왼쪽',
  right: '오른쪽',
  'down-left': '왼쪽 아래',
  down: '아래',
  'down-right': '오른쪽 아래',
}
</script>

<template>
  <div class="groups">
    <div v-for="g in groups" :key="g.id" class="group">
      <div class="row">
        <input
          class="input name"
          :value="g.name"
          maxlength="20"
          :aria-label="`${g.name} 그룹 이름`"
          @change="rename(g.id, $event)"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        />
        <span v-if="g.id === NAME_LABEL_GROUP_ID" class="muted hint">작업 이름</span>
        <button
          v-else
          type="button"
          class="btn ghost small"
          title="그룹 삭제 (입력한 라벨도 지워집니다)"
          :aria-label="`${g.name} 그룹 삭제`"
          @click="store.apply((d) => removeLabelGroup(d, g.id))"
        >
          ✕
        </button>
      </div>

      <div class="row">
        <div class="pos-grid" role="radiogroup" :aria-label="`${g.name} 위치`">
          <template v-for="(p, i) in POSITIONS" :key="i">
            <button
              v-if="p"
              type="button"
              role="radio"
              :class="{ on: g.position === p }"
              :aria-checked="g.position === p"
              :title="`노드의 ${POSITION_LABEL[p]}`"
              :aria-label="`노드의 ${POSITION_LABEL[p]}`"
              @click="patch(g.id, { position: p })"
            />
            <span v-else class="node-dot" />
          </template>
        </div>

        <div class="side">
          <label class="size">
            <span class="muted">크기 {{ g.size ?? LABEL_SIZE.default }}</span>
            <input
              type="range"
              :min="LABEL_SIZE.min"
              :max="LABEL_SIZE.max"
              :step="LABEL_SIZE.step"
              :value="g.size ?? LABEL_SIZE.default"
              :aria-label="`${g.name} 글자 크기`"
              @change="patch(g.id, { size: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
          <button
            type="button"
            class="color-btn"
            :aria-expanded="colorOpenId === g.id"
            @click="colorOpenId = colorOpenId === g.id ? null : g.id"
          >
            <span class="swatch" :class="{ auto: !g.color }" :style="g.color ? { background: g.color } : undefined">
              {{ g.color ? '' : 'A' }}
            </span>
            색
          </button>
        </div>
      </div>

      <ColorPicker
        v-if="colorOpenId === g.id"
        :model-value="g.color"
        default-label="기본 글자색"
        @update:model-value="(c) => patch(g.id, { color: c })"
      />
    </div>

    <button
      type="button"
      class="btn small add"
      :disabled="groups.length >= MAX_LABEL_GROUPS"
      @click="store.apply((d) => addLabelGroup(d))"
    >
      + 라벨 그룹 추가 ({{ groups.length }}/{{ MAX_LABEL_GROUPS }})
    </button>
  </div>
</template>

<style scoped>
.groups {
  display: grid;
  gap: 8px;
}
.group {
  display: grid;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.name {
  flex: 1;
  min-width: 0;
}
.hint {
  flex: none;
  font-size: 12px;
}
.pos-grid {
  display: grid;
  flex: none;
  grid-template-columns: repeat(3, 20px);
  gap: 3px;
}
.pos-grid button,
.node-dot {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface);
}
.pos-grid button {
  cursor: pointer;
}
.pos-grid button.on {
  background: var(--accent);
  border-color: var(--accent);
}
.node-dot {
  border-radius: 50%;
  border-width: 2px;
  border-color: var(--text-dim);
}
.side {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 6px;
}
.size {
  display: grid;
  gap: 2px;
  font-size: 12px;
}
.size input {
  width: 100%;
}
.color-btn {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  justify-self: start;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-size: 12px;
  cursor: pointer;
}
.swatch {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 10px;
}
.add {
  justify-self: start;
}
</style>
