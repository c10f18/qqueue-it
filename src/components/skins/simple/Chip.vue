<script setup lang="ts">
import type { TaskNode } from '../../../domain'
import { useNodeDisplay, type AttrKey } from '../../../composables/useNodeDisplay'

// 심플 스킨 — 플랫 모드: 한 행에 여러 개가 나란히 놓이는 압축 표현.
const props = defineProps<{ node: TaskNode; visibleAttrs: AttrKey[] }>()
const { fields, completed } = useNodeDisplay(
  () => props.node,
  () => props.visibleAttrs,
)
</script>

<template>
  <span class="s-chip" :class="{ done: completed }">
    <template v-for="f in fields" :key="f.key">
      <span v-if="f.key === 'icon'">{{ f.value }}</span>
      <b v-else-if="f.key === 'name'">{{ f.value }}</b>
      <span v-else-if="f.key === 'progress'" class="pct">{{ f.value }}</span>
      <span v-else-if="f.value" class="extra">{{ f.label }} {{ f.value }}</span>
    </template>
  </span>
</template>

<style scoped>
.s-chip {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--lane, var(--accent));
  border-radius: 999px;
  background: var(--surface);
}
.done b {
  color: var(--text-dim);
  text-decoration: line-through;
}
.pct,
.extra {
  color: var(--text-dim);
  font-size: 12px;
}
</style>
