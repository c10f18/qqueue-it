<script setup lang="ts">
import { computed, ref } from 'vue'
import { sortedLanes, type BoardData } from '../domain'

// FR-51: 지정한 슬롯까지 진행 처리. 기본은 모든 레인, 특정 레인만 선택 가능.
const props = defineProps<{ data: BoardData }>()
const emit = defineEmits<{
  apply: [upToSlotId: string, laneIds: string[]]
  resetAll: []
  close: []
}>()

const lanes = computed(() => sortedLanes(props.data))
const slotOptions = computed(() =>
  props.data.board.slotOrder.map((id, i) => {
    const names = props.data.nodes.filter((n) => n.slotId === id).map((n) => n.name)
    return { id, label: `${i + 1}번 슬롯 — ${names.join(', ') || '(비어 있음)'}` }
  }),
)

const upTo = ref(slotOptions.value[0]?.id ?? '')
const selected = ref(new Set(lanes.value.map((l) => l.id)))

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}
</script>

<template>
  <div class="overlay" @pointerdown.self="emit('close')">
    <form class="dialog" @submit.prevent="emit('apply', upTo, [...selected])">
      <h2>일괄 진행</h2>
      <div class="field">
        <label for="b-slot">이 슬롯까지 완료 처리</label>
        <select id="b-slot" v-model="upTo" class="input">
          <option v-for="o in slotOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
      </div>
      <div class="field">
        <span class="label">대상 카테고리</span>
        <label v-for="l in lanes" :key="l.id" class="row">
          <input type="checkbox" :checked="selected.has(l.id)" @change="toggle(l.id)" />
          {{ l.name }}
        </label>
      </div>
      <div class="actions">
        <button type="button" class="btn danger" @click="emit('resetAll')">전체 진행도 리셋</button>
        <span style="flex: 1" />
        <button type="button" class="btn" @click="emit('close')">취소</button>
        <button type="submit" class="btn primary" :disabled="selected.size === 0">적용</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
}
</style>
