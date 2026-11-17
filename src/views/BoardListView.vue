<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { navigate } from '../composables/useRoute'
import { importBackup } from '../domain'
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
// 복구: 파일을 먼저 고르면 바로 검사하고, 통과해야 복구할 수 있다.
const restoreOpen = ref(false)
/** 기존 데이터 전체 삭제 후 복구 (기본: 꺼짐 = 지금 목록에 더하기) */
const restoreReplace = ref(false)
type RestoreFile =
  | { name: string; ok: true; raw: unknown; boards: number; templates: number }
  | { name: string; ok: false; message: string }
const restoreFile = ref<RestoreFile | null>(null)
function openRestore() {
  pageMenuOpen.value = false
  restoreReplace.value = false
  restoreFile.value = null
  restoreOpen.value = true
}
/** 파일을 고르면 내용을 읽어 복구할 수 있는 파일인지 검사한다. */
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
      throw new Error('JSON 형식이 아닙니다.')
    }
    const parsed = importBackup(raw)
    restoreFile.value = { name: file.name, ok: true, raw, boards: parsed.boards.length, templates: parsed.templates.length }
  } catch (err) {
    const message = (err instanceof Error ? err.message : '읽을 수 없는 파일입니다.').replace(/^가져올 수 없는 파일입니다: /, '')
    restoreFile.value = { name: file.name, ok: false, message }
  }
}
async function doRestore() {
  const file = restoreFile.value
  if (!file?.ok) return
  const replace = restoreReplace.value
  restoreOpen.value = false
  try {
    const added = await store.restoreBackup(file.raw, replace)
    selected.value = new Set()
    selecting.value = false
    const what = `보드 ${added.boards}개${added.templates ? `와 템플릿 ${added.templates}개` : ''}`
    say(replace ? `기존 데이터를 모두 지우고 ${what}를 복구했습니다.` : `${what}를 복구해 목록에 더했습니다.`)
  } catch (err) {
    store.error = err instanceof Error ? err.message : '복구하지 못했습니다.'
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
  say('보드를 복제했습니다.')
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
          class="icon-btn"
          type="button"
          title="메뉴"
          aria-label="메뉴"
          aria-haspopup="true"
          :aria-expanded="pageMenuOpen"
          @click="pageMenuOpen = !pageMenuOpen"
        >
          <AppIcon name="menu" :size="18" />
        </button>
        <div v-if="pageMenuOpen" class="menu pop page-pop" role="menu">
          <button role="menuitem" :disabled="store.boards.length === 0 && store.templates.length === 0" @click="backup">
            <AppIcon name="download" /> 백업 <span class="hint">모든 보드·템플릿을 파일로</span>
          </button>
          <button role="menuitem" @click="openRestore">
            <AppIcon name="upload" /> 복구 <span class="hint">백업 파일에서 되살리기</span>
          </button>
          <hr />
          <button role="menuitem" class="danger" :disabled="store.boards.length === 0" @click="((pageMenuOpen = false), selecting || toggleSelecting())">
            <AppIcon name="trash" /> 보드 삭제 <span class="hint">골라서 또는 전부</span>
          </button>
        </div>
        <input ref="restoreInput" type="file" accept=".json,application/json" hidden @change="onRestoreFile" />
      </div>
    </div>

    <p v-if="notice" class="notice" role="status">{{ notice }}</p>

    <p v-if="store.boards.length === 0" class="muted empty">
      뀨잇
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
              :title="sortKey === x.key ? `${x.label} ${sortHint}` : `${x.label} 순으로 정렬`"
              @click="clickSort(x.key)"
            >
              {{ x.label }}<AppIcon v-if="sortKey === x.key" class="dir" :name="sortDesc ? 'down' : 'up'" :size="12" :aria-label="sortHint" />
            </button>
          </div>
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
            <span class="meta">
              <span class="muted" :title="`작업 ${b.nodeCount}개 중 ${b.doneCount}개 완료`">작업 {{ b.doneCount }}/{{ b.nodeCount }}</span>
              <span class="muted dates">생성 {{ fmt(b.createdAt) }} · 수정 {{ fmt(b.updatedAt) }}</span>
            </span>
            <span class="bar"><span :style="{ width: percent(b) + '%' }" /></span>
          </button>

          <div v-if="!selecting" class="more-wrap">
            <button
              class="icon-btn"
              type="button"
              aria-label="보드 메뉴"
              :aria-expanded="menuId === b.id"
              @click="menuId = menuId === b.id ? null : b.id"
            >
              <AppIcon name="more" />
            </button>
            <div v-if="menuId === b.id" class="menu pop" role="menu">
              <button role="menuitem" @click="navigate({ name: 'edit', boardId: b.id })"><AppIcon name="pen" />수정</button>
              <button role="menuitem" @click="clone(b.id)"><AppIcon name="copy" />복제</button>
              <button
                role="menuitem"
                @click="((menuId = null), (dialog = { kind: 'template', boardId: b.id, name: `${b.name} 템플릿` }))"
              >
                <AppIcon name="doc" />템플릿 저장
              </button>
              <button role="menuitem" class="danger" @click="askDeleteOne(b.id, b.name)"><AppIcon name="trash" />삭제</button>
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

    <div v-if="restoreOpen" class="overlay" @pointerdown.self="restoreOpen = false">
      <div class="dialog" role="dialog" aria-label="복구">
        <h2>복구</h2>
        <p class="muted">백업 파일(.json)의 보드와 템플릿 데이터를 복구합니다.</p>

        <div class="file-row">
          <button type="button" class="btn" @click="restoreInput?.click()">
            <AppIcon name="upload" /> {{ restoreFile ? '다른 파일 선택' : '파일 선택' }}
          </button>
          <template v-if="restoreFile">
            <span class="file-name" :title="restoreFile.name">{{ restoreFile.name }}</span>
            <span
              class="verdict"
              :class="restoreFile.ok ? 'ok' : 'bad'"
              role="img"
              :aria-label="restoreFile.ok ? '검사 통과' : '검사 실패'"
              :title="restoreFile.ok ? '검사 통과' : '검사 실패'"
            >
              <AppIcon :name="restoreFile.ok ? 'check' : 'cross'" :size="12" />
            </span>
          </template>
          <span v-else class="muted">선택한 파일 없음</span>
        </div>
        <p v-if="restoreFile" class="small-note" :class="{ warn: !restoreFile.ok }" role="status">
          {{
            restoreFile.ok
              ? `복구할 수 있는 파일입니다: 보드 ${restoreFile.boards}개, 템플릿 ${restoreFile.templates}개`
              : `복구할 수 없는 파일입니다: ${restoreFile.message}`
          }}
        </p>

        <label class="replace-row">
          <input v-model="restoreReplace" type="checkbox" />
          기존 데이터 전체 삭제 후 복구
        </label>
        <p class="muted small-note" :class="{ warn: restoreReplace }">
          {{
            restoreReplace
              ? `지금 있는 보드 ${store.boards.length}개와 템플릿 ${store.templates.length}개를 모두 지운 뒤 복구합니다. 되돌릴 수 없습니다.`
              : '지금 있는 보드는 그대로 두고, 백업 보드를 목록에 추가합니다.'
          }}
        </p>
        <div class="actions">
          <button type="button" class="btn" @click="restoreOpen = false">취소</button>
          <button type="button" class="btn" :class="restoreReplace ? 'danger' : 'primary'" :disabled="!restoreFile?.ok" @click="doRestore">복구</button>
        </div>
      </div>
    </div>

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
.page-pop {
  min-width: 290px;
}
.dates {
  font-size: 12px;
}
/* 작업 수(왼쪽)와 날짜(오른쪽)를 한 줄에 */
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  justify-content: space-between;
  align-items: baseline;
}
.meta .dates {
  margin-left: auto;
  text-align: right;
}
.file-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 12px 0 4px;
}
.file-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 검사 결과: 초록 동그라미 체크 / 빨간 동그라미 엑스 */
.verdict {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: #fff;
}
.verdict.ok {
  background: var(--ok);
}
.verdict.bad {
  background: var(--danger);
}
.replace-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 12px 0 4px;
  cursor: pointer;
}
.small-note {
  margin: 0 0 12px;
  font-size: 12px;
}
.small-note.warn {
  color: var(--danger);
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
  padding: 10px 16px;
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
/* 버튼 아래에 뜨는 메뉴의 위치 (모양은 공통 .menu) */
.pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
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
