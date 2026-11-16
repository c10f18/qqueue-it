<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { navigate } from '../composables/useRoute'
import { DomainError } from '../domain'
import { saveBlob } from '../export/download'
import { useBoardStore } from '../stores/board'

const store = useBoardStore()
const notice = ref('')

// ── 검색·정렬 ────────────────────────────────────────────
const query = ref('')
type SortKey = 'updatedAt' | 'createdAt' | 'name'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'updatedAt', label: '수정일' },
  { key: 'createdAt', label: '생성일' },
  { key: 'name', label: '이름' },
]
const SORT_PREF = 'qqueue.boardSort'
// 기본: 최근에 수정한 보드가 위로
const sortKey = ref<SortKey>('updatedAt')
const sortDesc = ref(true)
try {
  const saved = JSON.parse(localStorage.getItem(SORT_PREF) ?? 'null')
  if (saved && SORTS.some((x) => x.key === saved.key)) {
    sortKey.value = saved.key
    sortDesc.value = saved.desc !== false
  }
} catch {
  // 기억해 둔 값이 없거나 못 읽으면 기본 정렬로 시작한다.
}
/** 정렬 기준을 누른다: 이미 고른 기준이면 오름차순↔내림차순을 뒤집고, 다른 기준이면 그 기준으로 바꾼다. */
function clickSort(key: SortKey) {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value
  else {
    sortKey.value = key
    // 처음 고를 때: 날짜는 내림차순(최신순), 이름은 오름차순(가나다순)
    sortDesc.value = key !== 'name'
  }
  rememberSort()
}

// 검색 칸은 돋보기를 눌러야 열린다. 닫으면 검색어도 지운다.
const searchOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
async function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (!searchOpen.value) {
    query.value = ''
    return
  }
  await nextTick()
  searchInput.value?.focus()
}
function rememberSort() {
  try {
    localStorage.setItem(SORT_PREF, JSON.stringify({ key: sortKey.value, desc: sortDesc.value }))
  } catch {
    // 기억하지 못해도 동작에는 지장이 없다.
  }
}
const sortHint = computed(() => (sortDesc.value ? '내림차순' : '오름차순'))

const shownBoards = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q ? store.boards.filter((b) => b.name.toLowerCase().includes(q)) : [...store.boards]
  const key = sortKey.value
  list.sort((a, b) => (key === 'name' ? a.name.localeCompare(b.name, 'ko') : a[key] - b[key]))
  return sortDesc.value ? list.reverse() : list
})

// ── 페이지 메뉴: 전체 백업·복원 ─────────────────────────────
const pageMenuOpen = ref(false)
const restoreInput = ref<HTMLInputElement | null>(null)
async function backup() {
  pageMenuOpen.value = false
  const file = await store.backupAll()
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
  saveBlob(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), `qqueue-backup-${stamp}.json`)
  say(`보드 ${file.boards.length}개와 템플릿 ${file.templates.length}개를 백업 파일로 내보냈습니다.`)
}
async function onRestoreFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      throw new DomainError('invalid-argument', '가져올 수 없는 파일입니다: JSON 형식이 아닙니다.')
    }
    const added = await store.restoreBackup(raw)
    say(`보드 ${added.boards}개${added.templates ? `와 템플릿 ${added.templates}개` : ''}를 추가했습니다.`)
  } catch (err) {
    store.error = err instanceof Error ? err.message : '가져오지 못했습니다.'
  }
}

// ── ⋯ 메뉴 ───────────────────────────────────────────────
const menuId = ref<string | null>(null)
function onDocDown(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.more-wrap')) menuId.value = null
  if (!target.closest('.page-menu')) pageMenuOpen.value = false
}

// ── 선택 삭제 모드 ───────────────────────────────────────
const selecting = ref(false)
const selected = ref(new Set<string>())
// 전체 선택은 지금 목록에 보이는(검색된) 보드를 대상으로 한다.
const allSelected = computed(() => shownBoards.value.length > 0 && shownBoards.value.every((b) => selected.value.has(b.id)))

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
  selected.value = allSelected.value ? new Set() : new Set(shownBoards.value.map((b) => b.id))
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

// 새 보드는 기본 이름으로 만들고 바로 수정 화면으로 간다(이름은 거기서 제목을 눌러 바꾼다).
async function create() {
  const id = await store.createBoard('새 보드')
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

/** 완료한 작업의 비율(%). 작업이 없으면 0 */
function percent(b: { nodeCount: number; doneCount: number }) {
  return b.nodeCount ? Math.round((b.doneCount / b.nodeCount) * 100) : 0
}
function fmt(ms: number) {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <main class="list-page">
    <div class="top">
      <button class="btn primary" type="button" @click="create">+ 새 보드</button>
      <span class="spacer" />
      <div class="page-menu">
        <button
          class="menu-btn"
          type="button"
          title="메뉴"
          aria-label="메뉴"
          aria-haspopup="true"
          :aria-expanded="pageMenuOpen"
          @click="pageMenuOpen = !pageMenuOpen"
        >
          <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
            <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
        <div v-if="pageMenuOpen" class="pop page-pop" role="menu">
          <button role="menuitem" :disabled="store.boards.length === 0 && store.templates.length === 0" @click="backup">
            전체 백업 <span class="muted">모든 보드·템플릿을 파일로</span>
          </button>
          <button role="menuitem" @click="((pageMenuOpen = false), restoreInput?.click())">
            백업에서 가져오기 <span class="muted">지금 목록에 추가</span>
          </button>
        </div>
        <input ref="restoreInput" type="file" accept=".json,application/json" hidden @change="onRestoreFile" />
      </div>
    </div>

    <p v-if="notice" class="notice" role="status">{{ notice }}</p>

    <p v-if="store.boards.length === 0" class="muted empty">
      아직 보드가 없습니다.<br />
      "+ 새 보드"로 보드를 만들고 할 일을 슬롯에 배치해 순서대로 처리해 보세요.
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
          <span class="muted">
            {{ query.trim() ? `검색 결과 ${shownBoards.length}개 / 전체 ${store.boards.length}개` : `보드 ${store.boards.length}개` }}
          </span>
          <!-- 돋보기 하나가 늘어나 검색 칸이 된다. 돋보기를 다시 누르면 도로 줄어든다. -->
          <div class="search" :class="{ open: searchOpen }">
            <input
              ref="searchInput"
              :value="query"
              type="text"
              @input="query = ($event.target as HTMLInputElement).value"
              placeholder="검색"
              aria-label="보드 검색"
              maxlength="60"
              :tabindex="searchOpen ? 0 : -1"
              @keydown.esc.prevent="searchOpen && toggleSearch()"
            />
            <button
              v-if="searchOpen && query"
              class="clear"
              type="button"
              title="검색어 지우기"
              aria-label="검색어 지우기"
              @click="((query = ''), searchInput?.focus())"
            >
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" fill="currentColor" />
                <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="var(--surface)" stroke-width="1.4" stroke-linecap="round" />
              </svg>
            </button>
            <button
              class="glass"
              type="button"
              :title="searchOpen ? '검색 닫기' : '검색'"
              :aria-label="searchOpen ? '검색 닫기' : '검색'"
              :aria-expanded="searchOpen"
              @click="toggleSearch"
            >
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <span class="spacer" />
          <div class="sort" role="group" aria-label="정렬">
            <button
              v-for="x in SORTS"
              :key="x.key"
              type="button"
              :class="{ on: sortKey === x.key }"
              :aria-pressed="sortKey === x.key"
              :title="sortKey === x.key ? `${x.label} ${sortHint} (누르면 ${sortDesc ? '오름차순' : '내림차순'}으로)` : `${x.label} 순으로 정렬`"
              @click="clickSort(x.key)"
            >
              {{ x.label }}<span v-if="sortKey === x.key" class="dir" :aria-label="sortHint">{{ sortDesc ? '↓' : '↑' }}</span>
            </button>
          </div>
          <button class="btn small" @click="toggleSelecting">보드 삭제</button>
        </template>
      </div>

      <p v-if="shownBoards.length === 0" class="muted empty">"{{ query.trim() }}"에 맞는 보드가 없습니다.</p>

      <ul class="boards">
        <li v-for="b in shownBoards" :key="b.id" :class="{ picked: selected.has(b.id) }">
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
            <span class="muted">
              {{ percent(b) }}%<template v-if="b.nodeCount"> · 작업 {{ b.nodeCount }}개 중 {{ b.doneCount }}개 완료</template>
            </span>
            <span class="muted dates">생성 {{ fmt(b.createdAt) }} · 수정 {{ fmt(b.updatedAt) }}</span>
            <span class="bar"><span :style="{ width: percent(b) + '%' }" /></span>
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
              <button role="menuitem" @click="navigate({ name: 'edit', boardId: b.id })"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 1.7a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L5.6 13.4l-3.7.8.8-3.7z" /><path d="M9.8 3.2l3 3" /></svg>수정</button>
              <button role="menuitem" @click="clone(b.id)"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" /></svg>복제</button>
              <button
                role="menuitem"
                @click="((menuId = null), (dialog = { kind: 'template', boardId: b.id, name: `${b.name} 템플릿` }))"
              >
                <svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h5.2L12.5 5v9.2H4z" /><path d="M9 1.8V5.2h3.4M6 8.5h4.5M6 11h4.5" /></svg>템플릿 저장
              </button>
              <button role="menuitem" class="danger" @click="askDeleteOne(b.id, b.name)"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.8 4.2h10.4M6.3 4.2V2.6h3.4v1.6M4.2 4.2l.6 9.2h6.4l.6-9.2M6.7 6.8v4M9.3 6.8v4" /></svg>삭제</button>
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
.top {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 24px;
}
/* 검색: 닫혀 있을 때는 돋보기만 한 크기, 열리면 옆으로 늘어나 입력 칸이 된다 */
.search {
  display: inline-flex;
  flex: none;
  align-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  transition:
    width 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}
.search.open {
  width: min(240px, 60vw);
  border-color: var(--border);
  background: var(--surface);
}
.search.open:focus-within {
  border-color: var(--accent);
}
.search input {
  flex: 1;
  width: 0;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  outline: none;
}
.search.open input {
  padding: 0 4px 0 10px;
}
.search button {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
}
.search button:hover {
  color: var(--text);
}
.search:not(.open) .glass:hover {
  background: var(--surface-2);
}
.search .clear {
  width: 22px;
}
.sort .dir {
  margin-left: 3px;
}
.page-menu {
  position: relative;
  flex: none;
}
.menu-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
.menu-btn:hover,
.menu-btn[aria-expanded='true'] {
  background: var(--surface-2);
}
.page-pop {
  min-width: 290px;
}
.page-pop button {
  display: flex !important;
  white-space: nowrap;
  gap: 8px;
  justify-content: space-between;
  align-items: baseline;
}
.page-pop button:disabled {
  opacity: 0.5;
  cursor: default;
}
.page-pop .muted,
.dates {
  font-size: 12px;
}
.sort {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.sort button {
  padding: 3px 10px;
  border: 0;
  background: var(--surface);
  font-size: 13px;
  cursor: pointer;
}
.sort button + button {
  border-left: 1px solid var(--border);
}
.sort button.on {
  background: var(--accent);
  color: #fff;
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
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
/* 메뉴 아이콘: 모두 같은 크기·같은 칸에 놓아 글자가 한 줄로 맞게 한다 */
.pop .ico {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
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
