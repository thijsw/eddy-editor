<template>
  <div class="custom-toolbar" role="toolbar" aria-label="Text formatting">
    <button
      v-for="btn in buttons"
      :key="btn.name"
      type="button"
      class="custom-toolbar-btn"
      :class="{ 'is-active': activeStates[btn.name] }"
      :title="btn.title"
      :disabled="provision.disabled"
      @mousedown.prevent="btn.action()"
    >
      <component :is="btn.icon" :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { inject, ref, onMounted, onBeforeUnmount, type Component } from 'vue'
import { EDDY_INJECTION_KEY, type EditorAPI } from 'eddy-editor'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
} from '@lucide/vue'

const provision = inject(EDDY_INJECTION_KEY)
if (!provision) {
  throw new Error('<custom-toolbar> must be placed inside the #toolbar slot of <eddy-editor>.')
}

const { api } = provision

interface ToolbarButton {
  name: string
  icon: Component
  title: string
  action: () => void
  isActive: (api: EditorAPI) => boolean
}

function markButton(name: string, icon: Component, title: string): ToolbarButton {
  const type = name as 'bold' | 'italic' | 'underline' | 'strikethrough'
  return {
    name,
    icon,
    title,
    action: () => api.value?.toggleMark(type),
    isActive: (a) => a.isMarkActive(type),
  }
}

function headingButton(level: 1 | 2 | 3 | 4 | 5 | 6, icon: Component): ToolbarButton {
  return {
    name: `heading${level}`,
    icon,
    title: `Heading ${level}`,
    action: () => api.value?.setBlockType('heading', { level }),
    isActive: (a) => a.getHeadingLevel() === level,
  }
}

function listButton(name: string, icon: Component, title: string, ordered: boolean): ToolbarButton {
  return {
    name,
    icon,
    title,
    action: () => api.value?.toggleList(ordered),
    isActive: (a) => a.getListType() === (ordered ? 'ordered' : 'unordered'),
  }
}

const buttons: ToolbarButton[] = [
  markButton('bold', Bold, 'Bold'),
  markButton('italic', Italic, 'Italic'),
  markButton('underline', Underline, 'Underline'),
  markButton('strikethrough', Strikethrough, 'Strikethrough'),
  headingButton(1, Heading1),
  headingButton(2, Heading2),
  headingButton(3, Heading3),
  headingButton(4, Heading4),
  headingButton(5, Heading5),
  headingButton(6, Heading6),
  listButton('unorderedList', List, 'Bullet list', false),
  listButton('orderedList', ListOrdered, 'Numbered list', true),
]

const activeStates = ref<Record<string, boolean>>({})

function refresh(): void {
  const a = api.value
  if (!a) return
  for (const btn of buttons) {
    activeStates.value[btn.name] = btn.isActive(a)
  }
}

onMounted(() => {
  document.addEventListener('selectionchange', refresh)
  api.value?.el?.addEventListener('input', refresh)
  refresh()
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', refresh)
  api.value?.el?.removeEventListener('input', refresh)
})
</script>

<style scoped>
.custom-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid #e5e7eb;
  border-bottom: none;
  border-radius: 0.375rem 0.375rem 0 0;
  background: #f9fafb;
}

.custom-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  background: none;
  color: #374151;
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
