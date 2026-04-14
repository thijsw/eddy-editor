<template>
  <div class="eddy-wrapper">
    <!--
      #toolbar is a scoped slot so consumers can place <eddy-toolbar /> here.
      eddy-toolbar uses inject() which requires it to be a descendant in the
      Vue component tree — this slot satisfies that requirement.
    -->
    <slot name="toolbar" :editor="api" />

    <div
      ref="editorEl"
      class="eddy-editor"
      contenteditable="true"
      @input="onInput"
      @keydown="onKeydown"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, provide, onMounted } from 'vue'
import { EditorAPIImpl } from '../editor-api'
import { matchesKeybinding } from '../matches-keybinding'
import { defaultPlugins } from '../plugins/index'
import { EDDY_INJECTION_KEY, type EditorAPI, type EddyPlugin } from '../types'

// ── Props & emits ─────────────────────────────────────────────────────────────

interface Props {
  modelValue: string
  plugins?: EddyPlugin[]
}

const props = withDefaults(defineProps<Props>(), {
  plugins: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// ── Refs ──────────────────────────────────────────────────────────────────────

const editorEl = ref<HTMLElement | null>(null)
const api = ref<EditorAPI | null>(null)

// ── Plugin merging ────────────────────────────────────────────────────────────

// Consumer plugins take priority: built-ins with the same name are removed.
const mergedPlugins = computed((): EddyPlugin[] => {
  const consumerNames = new Set(props.plugins.map((p) => p.name))
  const builtins = defaultPlugins.filter((p) => !consumerNames.has(p.name))
  return [...builtins, ...props.plugins]
})

// ── Provide context to eddy-toolbar ──────────────────────────────────────────

// The getter ensures the toolbar always sees the latest plugin list even when
// props.plugins changes after setup.
provide(EDDY_INJECTION_KEY, {
  api,
  get plugins() {
    return mergedPlugins.value
  },
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  if (!editorEl.value) return
  const impl = new EditorAPIImpl()
  impl.attach(editorEl.value)
  api.value = impl
  // Set initial HTML content without triggering the watcher fence
  editorEl.value.innerHTML = props.modelValue
  internalValue = props.modelValue
})

// ── Model sync ────────────────────────────────────────────────────────────────

// Tracks the last HTML string we emitted so the watcher can distinguish
// "parent echoing back what we just emitted" (skip DOM write) from
// "parent programmatically setting a new value" (update DOM).
let internalValue = props.modelValue

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== internalValue && editorEl.value) {
      editorEl.value.innerHTML = newVal
      internalValue = newVal
    }
  },
)

function onInput(): void {
  if (!editorEl.value) return
  internalValue = editorEl.value.innerHTML
  emit('update:modelValue', internalValue)
}

// ── Keyboard handling ─────────────────────────────────────────────────────────

function onKeydown(event: KeyboardEvent): void {
  if (!api.value) return

  if (event.key === 'Enter') {
    const blockTag = api.value.getCommandValue('formatBlock').toLowerCase()
    const inHeading = /^h[1-6]$/.test(blockTag)

    if (inHeading) {
      // Inside a heading, Enter (plain or Shift) always exits to a new paragraph.
      // insertParagraph splits the block at the cursor; formatBlock then converts
      // the new block (where the cursor lands) from a heading to a plain paragraph.
      event.preventDefault()
      api.value.execute('insertParagraph')
      api.value.execute('formatBlock', '<p>')
      return
    }

    // Shift+Enter outside headings → <br> line break
    if (event.shiftKey) {
      event.preventDefault()
      api.value.execute('insertLineBreak')
      return
    }
  }

  for (const plugin of mergedPlugins.value) {
    if (plugin.keybinding && matchesKeybinding(event, plugin.keybinding)) {
      event.preventDefault()
      plugin.command(api.value)
      return
    }
  }
}
</script>
