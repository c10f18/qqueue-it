<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ListView from '../components/ListView.vue'
import Timetable from '../components/Timetable.vue'
import { navigate } from '../composables/useRoute'
import { renameBoard, setShowSlotNumbers, sortedLanes, toggleLaneActive } from '../domain'
import { useBoardStore } from '../stores/board'

const props = defineProps<{ boardId: string; mode: 'edit' | 'view' }>()
const store = useBoardStore()

const missing = ref(false)
const bulkOpen = ref(false)
const renaming = ref(false)
const nameDraft = ref('')

watch(
  () => props.boardId,
  async (id) => {
    missing.value = !(await store.openBoard(id))
  },
  { immediate: true },
)

const data = computed(() => (store.current?.board.id === props.boardId ? store.current : null))
const lanes = computed(() => (data.value ? sortedLanes(data.value) : []))
const inactiveLanes = computed(() => lanes.value.filter((l) => !l.active))

function startRename() {
  if (!data.value) return
  nameDraft.value = data.value.board.name
  renaming.value = true
}
function commitRename() {
  if (!renaming.value) return
  renaming.value = false
  if (nameDraft.value.trim()) store.apply((d) => renameBoard(d, nameDraft.value))
}
</script>

<template>
  <div v-if="missing" class="missing">
    <p>보드를 찾을 수 없습니다.</p>
    <a class="btn" href="#/">목록으로</a>
  </div>

  <div v-else-if="data" class="board-page">
    <div class="toolbar">
      <a class="btn ghost" href="#/" title="보드 목록">←</a>

      <input
        v-if="renaming"
        v-model="nameDraft"
        class="input title-input"
        maxlength="60"
        autofocus
        @keydown.enter.prevent="commitRename"
        @keydown.esc.prevent="renaming = false"
        @blur="commitRename"
      />
      <h1 v-else class="title" title="클릭하여 이름 수정" @click="startRename">{{ data.board.name }}</h1>

      <div class="seg-toggle" role="group" aria-label="화면 모드">
        <button :class="{ on: mode === 'edit' }" @click="navigate({ name: 'edit', boardId })">수정</button>
        <button :class="{ on: mode === 'view' }" @click="navigate({ name: 'view', boardId })">보기</button>
      </div>

      <template v-if="mode === 'edit'">
        <button class="btn" :disabled="!store.canUndo" title="되돌리기 (Ctrl+Z)" @click="store.undo()">↶</button>
        <button class="btn" :disabled="!store.canRedo" title="다시 실행 (Ctrl+Shift+Z)" @click="store.redo()">↷</button>
        <button class="btn" @click="bulkOpen = true">일괄 진행</button>
        <label class="check">
          <input
            type="checkbox"
            :checked="data.board.settings.showSlotNumbers"
            @change="store.apply((d) => setShowSlotNumbers(d, ($event.target as HTMLInputElement).checked))"
          />
          슬롯 번호
        </label>
        <span v-if="inactiveLanes.length" class="inactive">
          <span class="muted">숨긴 카테고리</span>
          <button
            v-for="l in inactiveLanes"
            :key="l.id"
            class="chip"
            title="다시 보이기"
            @click="store.apply((d) => toggleLaneActive(d, l.id))"
          >
            🚫 {{ l.name }}
          </button>
        </span>
      </template>
    </div>

    <div class="body">
      <Timetable v-if="mode === 'edit'" v-model:bulk-open="bulkOpen" :data="data" />
      <ListView v-else :data="data" />
    </div>
  </div>

  <p v-else class="muted loading">불러오는 중…</p>
</template>

<style scoped>
.board-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.title {
  margin: 0 8px 0 0;
  font-size: 18px;
  cursor: text;
}
.title-input {
  width: 220px;
}
.body {
  flex: 1;
  min-height: 0;
}
.seg-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.seg-toggle button {
  padding: 6px 14px;
  border: 0;
  background: var(--surface);
  cursor: pointer;
}
.seg-toggle button.on {
  background: var(--accent);
  color: #fff;
}
.check {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
}
.inactive {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.inactive .chip {
  border: 0;
  cursor: pointer;
}
.missing,
.loading {
  padding: 48px 16px;
  text-align: center;
}
</style>
