<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { navigate } from '../composables/useRoute'
import { useBoardStore } from '../stores/board'

const store = useBoardStore()
const newName = ref('')
const confirmId = ref<string | null>(null)
const notice = ref('')

onMounted(() => {
  store.closeBoard()
  void store.refreshBoards()
  void store.refreshTemplates()
})

async function create() {
  const id = await store.createBoard(newName.value || '새 보드')
  newName.value = ''
  navigate({ name: 'edit', boardId: id })
}

async function remove(id: string) {
  confirmId.value = null
  await store.deleteBoard(id)
}

async function clone(id: string) {
  await store.cloneBoard(id)
  say('보드를 복제했습니다. 진행도와 횟수는 0으로 시작합니다.')
}

async function saveTemplate(id: string, boardName: string) {
  const name = window.prompt('템플릿 이름', `${boardName} 템플릿`)
  if (name === null) return
  await store.saveAsTemplate(id, name)
  say('템플릿으로 저장했습니다.')
}

async function fromTemplate(id: string, templateName: string) {
  const name = window.prompt('새 보드 이름', templateName)
  if (name === null) return
  const boardId = await store.createBoardFromTemplateId(id, name)
  if (boardId) navigate({ name: 'edit', boardId })
}

function say(msg: string) {
  notice.value = msg
  setTimeout(() => (notice.value = ''), 3000)
}

function fmt(ms: number) {
  return new Date(ms).toLocaleDateString('ko-KR')
}
</script>

<template>
  <main class="list-page">
    <form class="new" @submit.prevent="create">
      <input v-model="newName" class="input" placeholder="새 보드 이름 (예: 2026 하반기 공부)" maxlength="60" />
      <button class="btn primary" type="submit">+ 보드 만들기</button>
    </form>

    <p v-if="notice" class="notice" role="status">{{ notice }}</p>

    <p v-if="store.boards.length === 0" class="muted empty">
      아직 보드가 없습니다.<br />
      보드를 만들고 할 일을 슬롯에 배치해 순서대로 처리해 보세요.
    </p>

    <ul class="boards">
      <li v-for="b in store.boards" :key="b.id">
        <a class="board" :href="`#/b/${b.id}`">
          <strong>{{ b.name }}</strong>
          <span class="muted">{{ b.doneCount }} / {{ b.nodeCount }} 완료 · {{ fmt(b.updatedAt) }}</span>
          <span class="bar"><span :style="{ width: (b.nodeCount ? (b.doneCount / b.nodeCount) * 100 : 0) + '%' }" /></span>
        </a>
        <div class="row-actions">
          <a class="btn ghost small" :href="`#/b/${b.id}/view`">보기</a>
          <button class="btn ghost small" title="구조를 유지한 채 진행도 0으로 복제" @click="clone(b.id)">복제</button>
          <button class="btn ghost small" @click="saveTemplate(b.id, b.name)">템플릿 저장</button>
          <button v-if="confirmId !== b.id" class="btn ghost small" @click="confirmId = b.id">삭제</button>
          <button v-else class="btn danger small" @click="remove(b.id)">정말 삭제</button>
        </div>
      </li>
    </ul>

    <section v-if="store.templates.length" class="templates">
      <h2>템플릿</h2>
      <ul class="boards">
        <li v-for="t in store.templates" :key="t.id">
          <div class="board static">
            <strong>{{ t.name }}</strong>
            <span class="muted">
              카테고리 {{ t.snapshot.lanes.length }}개 · 슬롯 {{ t.snapshot.slotCount }}개 · 작업 {{ t.snapshot.nodes.length }}개
            </span>
          </div>
          <div class="row-actions">
            <button class="btn small" @click="fromTemplate(t.id, t.name)">이 템플릿으로 새 보드</button>
            <button class="btn ghost small" @click="store.deleteTemplate(t.id)">삭제</button>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.list-page {
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 16px;
}
.new {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}
.notice {
  margin: -8px 0 16px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--accent-soft);
}
.empty {
  padding: 48px 0;
  text-align: center;
  line-height: 1.8;
}
.boards {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.boards li {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.board {
  display: grid;
  flex: 1 1 280px;
  gap: 4px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: inherit;
  text-decoration: none;
}
a.board:hover {
  border-color: var(--accent);
}
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.templates {
  margin-top: 32px;
}
.templates h2 {
  margin: 0 0 10px;
  font-size: 15px;
  color: var(--text-dim);
}
.bar {
  height: 4px;
  border-radius: 2px;
  background: var(--surface-2);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: var(--ok);
}
</style>
