<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import GraphSettingsDialog from '../components/GraphSettingsDialog.vue'
import ListView from '../components/ListView.vue'
import QueueGraph from '../components/QueueGraph.vue'
import Timetable from '../components/Timetable.vue'
import { navigate } from '../composables/useRoute'
import { renameBoard, setShowSlotNumbers, sortedLanes, toggleLaneActive } from '../domain'
import { useBoardStore } from '../stores/board'

const props = defineProps<{ boardId: string; mode: 'edit' | 'view' }>()
const store = useBoardStore()

const missing = ref(false)
const bulkOpen = ref(false)
const renaming = ref(false)
const graphSettingsOpen = ref(false)
const viewTab = ref<'list' | 'graph'>('list')
// 좁은 화면에서는 그래프 패널을 기본으로 접어 둔다 (타임테이블 공간 확보)
const showGraph = ref(window.matchMedia('(min-width: 640px)').matches)
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

      <button class="btn" title="방향·완료 표시·화살표·배경" @click="graphSettingsOpen = !graphSettingsOpen">🎨 그래프 설정</button>

      <template v-if="mode === 'edit'">
        <button class="btn" :disabled="!store.canUndo" title="되돌리기 (Ctrl+Z)" @click="store.undo()">↶</button>
        <button class="btn" :disabled="!store.canRedo" title="다시 실행 (Ctrl+Shift+Z)" @click="store.redo()">↷</button>
        <button class="btn" @click="bulkOpen = true">일괄 진행</button>
        <label class="check">
          <input v-model="showGraph" type="checkbox" />
          그래프
        </label>
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

    <!-- 수정 모드: 그래프 + 타임테이블. 가로 화면이면 위/아래, 세로 화면이면 좌/우 분할 (명세 23장) -->
    <div v-if="mode === 'edit'" class="body edit-layout">
      <section v-if="showGraph" class="graph-pane"><QueueGraph :data="data" /></section>
      <section class="timetable-pane"><Timetable v-model:bulk-open="bulkOpen" :data="data" /></section>
    </div>

    <div v-else class="body view-layout">
      <div class="view-tabs" role="tablist">
        <button role="tab" :class="{ on: viewTab === 'list' }" @click="viewTab = 'list'">리스트</button>
        <button role="tab" :class="{ on: viewTab === 'graph' }" @click="viewTab = 'graph'">큐 그래프</button>
      </div>
      <div class="view-body">
        <ListView v-if="viewTab === 'list'" :data="data" />
        <QueueGraph v-else :data="data" />
      </div>
    </div>

    <GraphSettingsDialog v-if="graphSettingsOpen" :data="data" @close="graphSettingsOpen = false" />
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
.edit-layout {
  display: flex;
  width: 100%;
}
/* 가로 > 세로 → 위/아래 분할, 세로 >= 가로 → 좌/우 분할 */
@media (orientation: landscape) {
  .edit-layout {
    flex-direction: column;
  }
}
@media (orientation: portrait) {
  .edit-layout {
    flex-direction: row;
  }
}
.graph-pane {
  flex: 1 1 40%;
  min-height: 160px;
  min-width: 140px;
  overflow: hidden;
}
.timetable-pane {
  flex: 1 1 60%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.view-layout {
  display: flex;
  flex-direction: column;
}
.view-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px 0;
}
.view-tabs button {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: var(--surface-2);
  cursor: pointer;
}
.view-tabs button.on {
  background: var(--surface);
  font-weight: 700;
}
.view-body {
  flex: 1;
  min-height: 0;
  border-top: 1px solid var(--border);
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
