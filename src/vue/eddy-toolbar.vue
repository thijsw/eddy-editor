<!--
  The heading-level `<select>` below is the default toolbar's one opinionated
  built-in: headings are near-universal, and a dropdown is better UX than six
  buttons. Everything else comes from plugin-contributed ToolbarItems. If you
  want zero built-in UI, render your own toolbar via the `toolbar` slot.
-->
<template>
  <div class="eddy-toolbar" role="toolbar" aria-label="Text formatting">
    <select
      class="eddy-toolbar-select"
      :value="currentBlockValue"
      :disabled="disabled"
      @change="onBlockTypeChange"
    >
      <option value="paragraph">Normal</option>
      <option v-for="n in 6" :key="n" :value="`h${n}`">Heading {{ n }}</option>
    </select>

    <button
      v-for="(item, idx) in items"
      :key="item.key"
      type="button"
      class="eddy-toolbar-btn"
      :class="{ 'is-active': activeStates.get(item.key) }"
      :title="item.title"
      :aria-label="item.title"
      :aria-pressed="activeStates.get(item.key) ?? false"
      :disabled="disabled"
      @mousedown.prevent="run(idx)"
    >
      <component :is="item.icon" v-if="item.icon" :size="16" />
      <span v-else>{{ item.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef, type Component } from 'vue'
import type { EditorAPI, EddyPlugin, ToolbarItem } from '../types'
import { useEditorState } from './use-editor-state'

const props = withDefaults(
  defineProps<{
    editor: EditorAPI | null
    plugins: EddyPlugin[]
    disabled?: boolean
  }>(),
  { disabled: false },
)

const editorRef = toRef(props, 'editor')

interface ResolvedItem {
  key: string
  command: string
  args: unknown[]
  label: string
  title: string
  icon: Component | undefined
  isActive: ((api: EditorAPI) => boolean) | undefined
}

const items = computed((): ResolvedItem[] => {
  const out: ResolvedItem[] = []
  for (const plugin of props.plugins) {
    if (!plugin.toolbar) continue
    plugin.toolbar.forEach((item: ToolbarItem, i: number) => {
      out.push({
        key: `${plugin.name}:${item.command}:${i}`,
        command: item.command,
        args: item.args ?? [],
        label: item.label,
        title: item.title,
        icon: item.icon as Component | undefined,
        isActive: item.isActive,
      })
    })
  }
  return out
})

const activeStates = useEditorState(editorRef, items)

const currentBlockValue = computed(() => {
  if (!props.editor) return 'paragraph'
  const block = props.editor.getBlockAt()
  if (block?.type === 'heading') {
    const level = block.attrs.level
    if (typeof level === 'number' && level >= 1 && level <= 6) return `h${level}`
  }
  return 'paragraph'
})

function run(idx: number): void {
  if (!props.editor) return
  const item = items.value[idx]
  props.editor.run(item.command, ...item.args)
}

function onBlockTypeChange(event: Event): void {
  if (!props.editor) return
  const value = (event.target as HTMLSelectElement).value
  if (value === 'paragraph') {
    props.editor.setBlockType('paragraph')
  } else {
    const level = parseInt(value.replace('h', ''))
    props.editor.setBlockType('heading', { level })
  }
  props.editor.el?.focus()
}
</script>
