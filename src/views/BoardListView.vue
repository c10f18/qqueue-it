<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { navigate } from '../composables/useRoute'
import { useBoardStore } from '../stores/board'

const store = useBoardStore()
const newName = ref('')
const confirmId = ref<string | null>(null)

onMounted(() => {
  store.closeBoard()
  void store.refreshBoards()
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
        <a class="btn ghost small" :href="`#/b/${b.id}/view`">보기</a>
        <button v-if="confirmId !== b.id" class="btn ghost small" @click="confirmId = b.id">삭제</button>
        <button v-else class="btn danger small" @click="remove(b.id)">정말 삭제</button>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.list-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px;
}
.new {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
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
  gap: 4px;
  align-items: center;
}
.board {
  display: grid;
  flex: 1;
  gap: 4px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: inherit;
  text-decoration: none;
}
.board:hover {
  border-color: var(--accent);
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
