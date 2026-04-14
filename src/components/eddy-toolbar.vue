<template>
  <div class="eddy-toolbar" role="toolbar" aria-label="Text formatting">
    <button
      v-for="plugin in toolbarPlugins"
      :key="plugin.name"
      type="button"
      class="eddy-toolbar-btn"
      :class="{ 'is-active': activeStates.get(plugin.name) }"
      :title="plugin.toolbar!.title"
      :aria-label="plugin.toolbar!.title"
      :aria-pressed="activeStates.get(plugin.name) ?? false"
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
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
} from '@lucide/vue'

const provision = inject(EDDY_INJECTION_KEY)
if (!provision) {
  throw new Error(
    '[eddy] <eddy-toolbar> must be placed inside the #toolbar slot of <eddy-editor>.',
  )
}

const { api } = provision

const toolbarPlugins = computed(() =>
  provision.plugins.filter((p) => p.toolbar != null),
)

const activeStates = useEditorState(api, provision.plugins)

// Default icons for built-in plugins. Consumers can override by setting
// toolbar.icon on their plugin — that takes priority.
const defaultIcons: Record<string, Component> = {
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strikethrough: Strikethrough,
  unorderedList: List,
  orderedList: ListOrdered,
  heading1: Heading1,
  heading2: Heading2,
  heading3: Heading3,
  heading4: Heading4,
  heading5: Heading5,
  heading6: Heading6,
}

function resolveIcon(plugin: EddyPlugin): Component | undefined {
  return plugin.toolbar?.icon ?? defaultIcons[plugin.name]
}
</script>
