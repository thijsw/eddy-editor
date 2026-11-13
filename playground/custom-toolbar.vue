<template>
  <div class="custom-toolbar" role="toolbar" aria-label="Text formatting">
    <button
      v-for="btn in buttons"
      :key="btn.name"
      type="button"
      class="custom-toolbar-btn"
      :class="{ 'is-active': state?.[btn.name] }"
      :title="btn.title"
      :disabled="!state?.editable"
      @mousedown.prevent
      @click="editor && btn.run(editor)"
    >
      {{ btn.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useEditorState } from 'eddy-editor/vue'
import { promptLink, toggleList, type Editor } from 'eddy-editor'

const props = defineProps<{ editor: Editor | null }>()

interface Button {
  name: string
  label: string
  title: string
  run(ed: Editor): void
  active(ed: Editor): boolean
}

const mark = (type: string, label: string, title: string): Button => ({
  name: type,
  label,
  title,
  run: (ed) => ed.toggleMark(type),
  active: (ed) => type in ed.getMarks(),
})

const heading = (level: number): Button => ({
  name: `h${level}`,
  label: `H${level}`,
  title: `Heading ${level}`,
  run: (ed) => ed.setBlock('heading', { level }),
  active: (ed) => {
    const b = ed.getBlock()
    return b?.type === 'heading' && b.attrs.level === level
  },
})

const list = (ordered: boolean): Button => ({
  name: ordered ? 'ol' : 'ul',
  label: ordered ? '1.' : '•',
  title: ordered ? 'Numbered list' : 'Bullet list',
  run: (ed) => toggleList(ed, ordered),
  active: (ed) => {
    const b = ed.getBlock()
    return b?.type === 'listItem' && !!b.attrs.ordered === ordered
  },
})

const buttons: Button[] = [
  mark('bold', 'B', 'Bold'),
  mark('italic', 'I', 'Italic'),
  mark('underline', 'U', 'Underline'),
  mark('strikethrough', 'S', 'Strikethrough'),
  {
    name: 'link',
    label: '🔗',
    title: 'Link',
    run: promptLink,
    active: (ed) => 'link' in ed.getMarks(),
  },
  ...[1, 2, 3, 4, 5, 6].map(heading),
  list(false),
  list(true),
]

// One subscription for the whole toolbar: recomputed on every editor update.
const state = useEditorState(
  toRef(props, 'editor'),
  (ed): Record<string, boolean> => ({
    editable: ed.editable,
    ...Object.fromEntries(buttons.map((b) => [b.name, b.active(ed)])),
  }),
)
</script>

<style scoped>
.custom-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.custom-toolbar-btn {
  min-width: 1.75rem;
  height: 1.75rem;
  padding: 0 0.25rem;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  background: none;
  color: #374151;
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}

.custom-toolbar-btn:hover {
  background: #e5e7eb;
}

.custom-toolbar-btn.is-active {
  background: #e5e7eb;
  font-weight: 700;
}

.custom-toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
