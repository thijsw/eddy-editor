<template>
  <div class="eddy-toolbar" role="toolbar" aria-label="Text formatting">
    <button
      v-for="plugin in toolbarPlugins"
      :key="plugin.name"
      type="button"
      class="eddy-toolbar-btn"
      :class="{ 'is-active': activeStates.get(plugin.name) }"
      :title="plugin.toolbar!.title"
      :aria-pressed="activeStates.get(plugin.name) ?? false"
      @mousedown.prevent="plugin.command(api!)"
    >
      {{ plugin.toolbar!.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { EDDY_INJECTION_KEY } from '../types'
import { useEditorState } from '../use-editor-state'

const provision = inject(EDDY_INJECTION_KEY)
if (!provision) {
  throw new Error(
    '[eddy] <eddy-toolbar> must be placed inside the #toolbar slot of <eddy-editor>.',
  )
}

const { api } = provision

// Access plugins through the provision object (not destructured) so the
// computed always reads the getter, preserving reactivity.
const toolbarPlugins = computed(() =>
  provision.plugins.filter((p) => p.toolbar != null),
)

// Reactive Map of plugin.name → isActive; refreshes on selectionchange / input
const activeStates = useEditorState(api, provision.plugins)
</script>
