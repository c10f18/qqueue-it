<script setup lang="ts">
import { computed } from 'vue'
import type { TaskNode } from '../../../domain'
import { useNodeDisplay, type AttrKey } from '../../../composables/useNodeDisplay'

// 심플 스킨 — 레이어별 모드: 칸 전체를 차지하고 선택한 속성을 모두 보여준다.
const props = defineProps<{ node: TaskNode; visibleAttrs: AttrKey[] }>()
const { fields, completed } = useNodeDisplay(
  () => props.node,
  () => props.visibleAttrs,
)
const has = (k: AttrKey) => props.visibleAttrs.includes(k)
const rest = computed(() => fields.value.filter((f) => !['name', 'icon', 'progress'].includes(f.key)))
</script>

<template>
  <div class="s-cell" :class="{ done: completed }">
    <div class="head">
      <span v-if="has('icon') && node.icon">{{ node.icon }}</span>
      <b v-if="has('name')" class="name">{{ node.name }}</b>
    </div>
    <div v-if="has('progress')" class="bar"><div class="fill" :style="{ width: node.progress + '%' }" /></div>
    <dl v-if="rest.length || has('progress')">
      <template v-if="has('progress')"><dt>진행도</dt><dd>{{ node.progress }}%</dd></template>
      <template v-for="f in rest" :key="f.key"><dt>{{ f.label }}</dt><dd>{{ f.value || '-' }}</dd></template>
    </dl>
  </div>
</template>

<style scoped>
.s-cell {
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--lane, var(--accent));
  border-radius: 8px;
  background: var(--surface);
}
.head {
  display: flex;
  gap: 6px;
  align-items: center;
}
.done .name {
  color: var(--text-dim);
  text-decoration: line-through;
}
.bar {
  height: 6px;
  border-radius: 3px;
  background: var(--surface-2);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--lane, var(--accent));
}
.done .fill {
  background: var(--ok);
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0 8px;
  margin: 0;
  font-size: 12px;
}
dt {
  color: var(--text-dim);
}
dd {
  margin: 0;
}
</style>
