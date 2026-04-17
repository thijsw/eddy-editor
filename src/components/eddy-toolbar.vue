<template>
  <div class="eddy-toolbar" role="toolbar" aria-label="Text formatting">
    <select
      class="eddy-toolbar-select"
      :value="currentBlockType"
      :disabled="disabled"
      @change="onBlockTypeChange"
    >
      <option value="paragraph">Normal</option>
      <option v-for="n in 6" :key="n" :value="`h${n}`">Heading {{ n }}</option>
    </select>

    <button
      v-for="plugin in nonHeadingPlugins"
      :key="plugin.name"
      type="button"
      class="eddy-toolbar-btn"
      :class="{ 'is-active': activeStates.get(plugin.name) }"
      :title="plugin.toolbar!.title"
      :aria-label="plugin.toolbar!.title"
      :aria-pressed="activeStates.get(plugin.name) ?? false"
      :disabled="disabled"
      @mousedown.prevent="plugin.command(editor!)"
    >
      <component :is="resolveIcon(plugin)" v-if="resolveIcon(plugin)" :size="16" />
      <span v-else>{{ plugin.toolbar!.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef, type Component } from 'vue'
import type { EditorAPI, EddyPlugin } from '../types'
import { useEditorState } from '../use-editor-state'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    editor: EditorAPI | null
    plugins: EddyPlugin[]
    disabled?: boolean
  }>(),
  { disabled: false },
)

const editorRef = toRef(props, 'editor')

const nonHeadingPlugins = computed(() =>
  props.plugins.filter((p) => p.toolbar != null && !p.name.startsWith('heading')),
)

const activeStates = useEditorState(editorRef, props.plugins)

const currentBlockType = computed(() => {
  for (let n = 1; n <= 6; n++) {
    if (activeStates.value.get(`heading${n}`)) return `h${n}`
  }
  return 'paragraph'
})

// Default icons for built-in plugins.
const defaultIcons: Record<string, Component> = {
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strikethrough: Strikethrough,
  unorderedList: List,
  orderedList: ListOrdered,
}

function resolveIcon(plugin: EddyPlugin): Component | undefined {
  return plugin.toolbar?.icon ?? defaultIcons[plugin.name]
}

function onBlockTypeChange(event: Event): void {
  if (!props.editor) return
  const value = (event.target as HTMLSelectElement).value
  if (value === 'paragraph') {
    props.editor.setBlockType('paragraph')
  } else {
    const level = parseInt(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6
    props.editor.setBlockType('heading', { level })
  }
  props.editor.el?.focus()
}
</script>
