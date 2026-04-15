<template>
  <div class="eddy-toolbar" role="toolbar" aria-label="Text formatting">
    <select
      class="eddy-toolbar-select"
      :value="currentBlockType"
      :disabled="provision.disabled"
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
      :disabled="provision.disabled"
      @mousedown.prevent="plugin.command(api!)"
    >
      <component :is="resolveIcon(plugin)" v-if="resolveIcon(plugin)" :size="16" />
      <span v-else>{{ plugin.toolbar!.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, type Component } from 'vue'
import { EDDY_INJECTION_KEY, type EddyPlugin } from '../types'
import { useEditorState } from '../use-editor-state'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
} from '@lucide/vue'

const provision = inject(EDDY_INJECTION_KEY)
if (!provision) {
  throw new Error(
    '[eddy] <eddy-toolbar> must be placed inside the #toolbar slot of <eddy-editor>.',
  )
}

const { api } = provision

const nonHeadingPlugins = computed(() =>
  provision.plugins.filter((p) => p.toolbar != null && !p.name.startsWith('heading')),
)

const activeStates = useEditorState(api, provision.plugins)

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
  const a = api.value
  if (!a) return
  const value = (event.target as HTMLSelectElement).value
  if (value === 'paragraph') {
    a.setBlockType('paragraph')
  } else {
    const level = parseInt(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6
    a.setBlockType('heading', { level })
  }
  a.el?.focus()
}
</script>
