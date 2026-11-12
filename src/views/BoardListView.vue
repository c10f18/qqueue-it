<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { navigate } from '../composables/useRoute'
import { useBoardStore } from '../stores/board'

const store = useBoardStore()
const newName = ref('')
const notice = ref('')

// ── ⋯ 메뉴 ───────────────────────────────────────────────
const menuId = ref<string | null>(null)
function onDocDown(e: PointerEvent) {
  if (!(e.target as HTMLElement).closest('.more-wrap')) menuId.value = null
}

// ── 선택 삭제 모드 ───────────────────────────────────────
const selecting = ref(false)
const selected = ref(new Set<string>())
const allSelected = computed(() => store.boards.length > 0 && selected.value.size === store.boards.length)

function toggleSelecting() {
  selecting.value = !selecting.value
  selected.value = new Set()
  menuId.value = null
}
function toggleOne(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}
function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(store.boards.map((b) => b.id))
}

// ── 확인/이름 입력 대화상자 ──────────────────────────────
type Dialog =
  | { kind: 'delete'; ids: string[]; title: string }
  | { kind: 'template'; boardId: string; name: string }
  | { kind: 'fromTemplate'; templateId: string; name: string }
const dialog = ref<Dialog | null>(null)

function askDelete(ids: string[], title: string) {
  menuId.value = null
  if (ids.length) dialog.value = { kind: 'delete', ids, title }
}
function askDeleteOne(id: string, name: string) {
  askDelete([id], `"${name}" 보드를 삭제할까요?`)
}
function askDeleteSelected() {
  askDelete([...selected.value], `선택한 보드 ${selected.value.size}개를 삭제할까요?`)
}
function askDeleteAll() {
  askDelete(
    store.boards.map((b) => b.id),
    `보드 ${store.boards.length}개를 전부 삭제할까요?`,
  )
}

async function confirmDialog() {
  const d = dialog.value
  dialog.value = null
  if (!d) return
  if (d.kind === 'delete') {
    await store.deleteBoards(d.ids)
    selected.value = new Set()
    if (store.boards.length === 0) selecting.value = false
    say(`보드 ${d.ids.length}개를 삭제했습니다.`)
  } else if (d.kind === 'template') {
    await store.saveAsTemplate(d.boardId, d.name)
    say('템플릿으로 저장했습니다.')
  } else {
    const boardId = await store.createBoardFromTemplateId(d.templateId, d.name)
    if (boardId) navigate({ name: 'edit', boardId })
  }
}

// ── 동작 ─────────────────────────────────────────────────
onMounted(() => {
  store.closeBoard()
  void store.refreshBoards()
  void store.refreshTemplates()
  document.addEventListener('pointerdown', onDocDown)
})
onUnmounted(() => document.removeEventListener('pointerdown', onDocDown))

async function create() {
  const id = await store.createBoard(newName.value || '새 보드')
  newName.value = ''
  navigate({ name: 'edit', boardId: id })
}

async function clone(id: string) {
  menuId.value = null
  await store.cloneBoard(id)
  say('보드를 복제했습니다. 진행도와 횟수는 0으로 시작합니다.')
}

// 보드 사각형을 누르면 보기 화면으로 이동한다. 선택 모드에서는 체크만 바뀐다.
function openBoard(id: string) {
  if (selecting.value) toggleOne(id)
  else navigate({ name: 'view', boardId: id })
}

let noticeTimer = 0
function say(msg: string) {
  notice.value = msg
  clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => (notice.value = ''), 3000)
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

    <template v-else>
      <div class="list-bar">
        <template v-if="selecting">
          <label class="check-all">
            <input type="checkbox" :checked="allSelected" @change="toggleAll" /> 전체 선택
          </label>
          <span class="muted">{{ selected.size }}개 선택</span>
          <span class="spacer" />
          <button class="btn danger small" :disabled="selected.size === 0" @click="askDeleteSelected">선택 삭제</button>
          <button class="btn danger small" @click="askDeleteAll">전체 삭제</button>
          <button class="btn small" @click="toggleSelecting">취소</button>
        </template>
        <template v-else>
          <span class="muted">보드 {{ store.boards.length }}개</span>
          <span class="spacer" />
          <button class="btn small" @click="toggleSelecting">선택 삭제…</button>
        </template>
      </div>

      <ul class="boards">
        <li v-for="b in store.boards" :key="b.id" :class="{ picked: selected.has(b.id) }">
          <input
            v-if="selecting"
            type="checkbox"
            class="pick"
            :checked="selected.has(b.id)"
            :aria-label="`${b.name} 선택`"
            @change="toggleOne(b.id)"
          />
          <button class="board" type="button" @click="openBoard(b.id)">
            <strong>{{ b.name }}</strong>
            <span class="muted">{{ b.doneCount }} / {{ b.nodeCount }} 완료 · {{ fmt(b.updatedAt) }}</span>
            <span class="bar"><span :style="{ width: (b.nodeCount ? (b.doneCount / b.nodeCount) * 100 : 0) + '%' }" /></span>
          </button>

          <div v-if="!selecting" class="more-wrap">
            <button
              class="more"
              type="button"
              aria-label="보드 메뉴"
              :aria-expanded="menuId === b.id"
              @click="menuId = menuId === b.id ? null : b.id"
            >
              ⋯
            </button>
            <div v-if="menuId === b.id" class="pop" role="menu">
              <button role="menuitem" @click="navigate({ name: 'edit', boardId: b.id })">✏ 수정</button>
              <button role="menuitem" @click="clone(b.id)">⧉ 복제</button>
              <button
                role="menuitem"
                @click="((menuId = null), (dialog = { kind: 'template', boardId: b.id, name: `${b.name} 템플릿` }))"
              >
                📄 템플릿 저장
              </button>
              <button role="menuitem" class="danger" @click="askDeleteOne(b.id, b.name)">🗑 삭제</button>
            </div>
          </div>
        </li>
      </ul>
    </template>

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
            <button class="btn small" @click="dialog = { kind: 'fromTemplate', templateId: t.id, name: t.name }">
              이 템플릿으로 새 보드
            </button>
            <button class="btn ghost small" @click="store.deleteTemplate(t.id)">삭제</button>
          </div>
        </li>
      </ul>
    </section>

    <div v-if="dialog" class="overlay" @pointerdown.self="dialog = null">
      <form class="dialog" @submit.prevent="confirmDialog">
        <template v-if="dialog.kind === 'delete'">
          <h2>{{ dialog.title }}</h2>
          <p class="muted">삭제한 보드는 되돌릴 수 없습니다.</p>
        </template>
        <template v-else>
          <h2>{{ dialog.kind === 'template' ? '템플릿으로 저장' : '템플릿으로 새 보드' }}</h2>
          <div class="field">
            <label for="d-name">{{ dialog.kind === 'template' ? '템플릿 이름' : '보드 이름' }}</label>
            <input id="d-name" v-model="dialog.name" class="input" maxlength="60" autofocus />
          </div>
        </template>
        <div class="actions">
          <button type="button" class="btn" @click="dialog = null">취소</button>
          <button type="submit" class="btn" :class="dialog.kind === 'delete' ? 'danger' : 'primary'">
            {{ dialog.kind === 'delete' ? '삭제' : '확인' }}
          </button>
        </div>
      </form>
    </div>
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
.list-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-height: 30px;
  margin-bottom: 10px;
}
.spacer {
  flex: 1;
}
.check-all {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
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
  gap: 8px;
  align-items: center;
}
.pick {
  flex: none;
  width: 18px;
  height: 18px;
  cursor: pointer;
}
.board {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 4px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  text-align: left;
}
button.board {
  cursor: pointer;
}
button.board:hover,
.picked .board {
  border-color: var(--accent);
}
.picked .board {
  background: var(--accent-soft);
}
.more-wrap {
  position: relative;
  flex: none;
}
.more {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
}
.more:hover,
.more[aria-expanded='true'] {
  background: var(--surface-2);
}
/* 말풍선처럼 ⋯ 버튼 아래에 뜨는 메뉴 */
.pop {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  min-width: 150px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.pop::before {
  content: '';
  position: absolute;
  top: -6px;
  right: 12px;
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  border-top: 1px solid var(--border);
  border-left: 1px solid var(--border);
  background: var(--surface);
}
.pop button {
  display: block;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.pop button:hover {
  background: var(--surface-2);
}
.danger {
  color: var(--danger);
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
