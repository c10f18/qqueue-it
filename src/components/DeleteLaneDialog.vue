<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DeleteLaneMode, Lane } from '../domain'

// FR-16: 노드가 있으면 "노드도 삭제" 또는 "다른 카테고리로 이동" 중 선택
const props = defineProps<{ lane: Lane; others: Lane[]; nodeCount: number }>()
const emit = defineEmits<{
  confirm: [mode: DeleteLaneMode, targetLaneId?: string]
  close: []
}>()

const mode = ref<DeleteLaneMode>('moveTo')
const target = ref(props.others[0]?.id ?? '')
const hasNodes = computed(() => props.nodeCount > 0)

function confirm() {
  if (!hasNodes.value) return emit('confirm', 'deleteNodes')
  emit('confirm', mode.value, mode.value === 'moveTo' ? target.value : undefined)
}
</script>

<template>
  <div class="overlay" @pointerdown.self="emit('close')">
    <form class="dialog" @submit.prevent="confirm">
      <h2>카테고리 "{{ lane.name }}" 삭제</h2>
      <template v-if="hasNodes">
        <p>이 카테고리에 작업이 {{ nodeCount }}개 있습니다. 어떻게 할까요?</p>
        <label class="opt">
          <input v-model="mode" type="radio" value="moveTo" />
          다른 카테고리로 이동
          <select v-model="target" class="input" :disabled="mode !== 'moveTo'">
            <option v-for="l in others" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </label>
        <label class="opt">
          <input v-model="mode" type="radio" value="deleteNodes" />
          작업도 함께 삭제
        </label>
      </template>
      <p v-else>삭제하시겠습니까?</p>
      <p class="muted">되돌리기(Ctrl+Z)로 복구할 수 있습니다.</p>
      <div class="actions">
        <button type="button" class="btn" @click="emit('close')">취소</button>
        <button type="submit" class="btn danger">삭제</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 8px;
  align-items: center;
  margin-bottom: 8px;
  cursor: pointer;
}
.opt .input {
  grid-column: 1 / -1;
}
</style>
