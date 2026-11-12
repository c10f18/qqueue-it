<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_TAGS, normalizeTags, type Lane, type NodePatch, type TaskNode } from '../domain'
import { fileToThumbnail } from '../composables/imageFile'
import ColorPicker from './ColorPicker.vue'

const props = defineProps<{ node: TaskNode; lane: Lane | undefined }>()
const emit = defineEmits<{
  save: [patch: NodePatch]
  duplicate: []
  remove: []
  close: []
}>()

const EMOJIS = ['📚', '📝', '💻', '🏃', '🎯', '🔥', '⭐', '🌱', '🎨', '🎧', '🧪', '✅']

const name = ref(props.node.name)
const description = ref(props.node.description ?? '')
const icon = ref(props.node.icon ?? '')
const color = ref<string | undefined>(props.node.color)
const image = ref<string | undefined>(props.node.image)
const imageError = ref('')

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    imageError.value = ''
    image.value = await fileToThumbnail(file)
  } catch (err) {
    imageError.value = err instanceof Error ? err.message : '이미지를 첨부할 수 없습니다.'
  }
}
const tagsText = ref(props.node.tags.join(', '))
const progress = ref(props.node.progress)
const visible = ref(props.node.visible)
const deadline = ref(props.node.deadline ? toDateInput(props.node.deadline) : '')

function toDateInput(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const tags = computed(() => tagsText.value.split(/[,\n]/).map((t) => t.trim()).filter(Boolean))
const tagError = computed(() => {
  try {
    normalizeTags(tags.value)
    return ''
  } catch {
    return `태그는 최대 ${MAX_TAGS}개입니다.`
  }
})
const canSave = computed(() => name.value.trim().length > 0 && !tagError.value)

function save() {
  if (!canSave.value) return
  emit('save', {
    name: name.value,
    description: description.value.trim() || undefined,
    icon: icon.value.trim() || undefined,
    color: color.value,
    image: image.value,
    tags: tags.value,
    progress: Number(progress.value),
    visible: visible.value,
    deadline: deadline.value ? new Date(deadline.value + 'T00:00:00').getTime() : undefined,
  })
}
</script>

<template>
  <div class="overlay" @pointerdown.self="emit('close')" @keydown.esc="emit('close')">
    <form class="dialog" @submit.prevent="save">
      <h2>작업 편집 <span v-if="lane" class="chip">{{ lane.name }}</span></h2>

      <div class="field">
        <label for="n-name">이름</label>
        <input id="n-name" v-model="name" class="input" maxlength="80" autofocus />
      </div>

      <div class="field">
        <label for="n-desc">설명</label>
        <textarea id="n-desc" v-model="description" class="input" rows="2" />
      </div>

      <div class="field">
        <span class="label">아이콘</span>
        <div class="emojis">
          <input v-model="icon" class="input icon-input" maxlength="4" placeholder="이모지" aria-label="아이콘" />
          <button v-for="e in EMOJIS" :key="e" type="button" class="btn ghost small" @click="icon = e">{{ e }}</button>
          <button type="button" class="btn ghost small" @click="icon = ''">지우기</button>
        </div>
      </div>

      <div class="field">
        <span class="label">단색 (그래프 노드와 카드의 원 색)</span>
        <ColorPicker v-model="color" default-label="색 없음" />
      </div>

      <div class="field">
        <span class="label">사진 (첨부하면 아이콘 대신 표시)</span>
        <div class="photo">
          <span v-if="image" class="photo-preview" :style="{ backgroundImage: `url(${image})` }" />
          <label class="btn small">
            {{ image ? '사진 바꾸기' : '사진 첨부' }}
            <input type="file" accept="image/*" hidden @change="onFile" />
          </label>
          <button v-if="image" type="button" class="btn ghost small" @click="image = undefined">사진 지우기</button>
        </div>
        <span v-if="imageError" class="err">{{ imageError }}</span>
      </div>

      <div class="field">
        <label for="n-tags">태그 (쉼표로 구분, 최대 {{ MAX_TAGS }}개)</label>
        <input id="n-tags" v-model="tagsText" class="input" placeholder="영어, 문법" />
        <span v-if="tagError" class="err">{{ tagError }}</span>
      </div>

      <div class="field">
        <label for="n-progress">진행도 {{ progress }}%</label>
        <input id="n-progress" v-model.number="progress" type="range" min="0" max="100" step="1" />
      </div>

      <div class="field">
        <label for="n-deadline">데드라인 (정렬용)</label>
        <input id="n-deadline" v-model="deadline" class="input" type="date" />
      </div>

      <label class="check-row">
        <input v-model="visible" type="checkbox" /> 뷰·export에 표시
      </label>

      <div class="actions">
        <button type="button" class="btn danger" @click="emit('remove')">삭제</button>
        <button type="button" class="btn" @click="emit('duplicate')">복제</button>
        <span style="flex: 1" />
        <button type="button" class="btn" @click="emit('close')">취소</button>
        <button type="submit" class="btn primary" :disabled="!canSave">저장</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.emojis {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
}
.icon-input {
  width: 72px;
}
.photo {
  display: flex;
  gap: 8px;
  align-items: center;
}
.photo-preview {
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background-size: cover;
  background-position: center;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.check-row {
  display: flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
}
.err {
  color: var(--danger);
  font-size: 12px;
}
</style>
