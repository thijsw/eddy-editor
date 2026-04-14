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
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, provide, onMounted } from 'vue'
import { EditorAPIImpl } from '../editor-api'
import { matchesKeybinding } from '../matches-keybinding'
import { defaultPlugins } from '../plugins/index'
import { EDDY_INJECTION_KEY, type EditorAPI, type EddyPlugin } from '../types'
import { parseHTML } from '../ast/parse'
import { serializeToHTML } from '../ast/serialize'

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
let impl: EditorAPIImpl | null = null
let isComposing = false

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
  const apiImpl = new EditorAPIImpl()
  apiImpl.attach(editorEl.value)

  // Parse initial HTML into AST and initialise
  editorEl.value.innerHTML = props.modelValue
  const initialDoc = parseHTML(props.modelValue)
  apiImpl.initDoc(initialDoc, null)

  // Whenever a command modifies the doc, emit updated v-model.
  // This is necessary because _renderDOM() sets innerHTML directly,
  // which (unlike execCommand) does not fire a browser input event.
  apiImpl.onChange(() => {
    internalValue = serializeToHTML(apiImpl.doc)
    emit('update:modelValue', internalValue)
  })

  impl = apiImpl
  api.value = apiImpl
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
    if (newVal !== internalValue && editorEl.value && impl) {
      editorEl.value.innerHTML = newVal
      const doc = parseHTML(newVal)
      impl.initDoc(doc, null)
      internalValue = newVal
    }
  },
)

function onInput(): void {
  if (!impl || isComposing) return
  const html = impl.syncFromDOM()
  if (html !== null) {
    internalValue = html
    emit('update:modelValue', internalValue)
  }
}

function onCompositionStart(): void {
  isComposing = true
}

function onCompositionEnd(): void {
  isComposing = false
  onInput()
}

// ── Keyboard handling ─────────────────────────────────────────────────────────

function onKeydown(event: KeyboardEvent): void {
  if (!api.value || !impl) return

  // Undo / Redo
  if (matchesKeybinding(event, 'mod+z')) {
    event.preventDefault()
    impl.undo()
    return
  }
  if (matchesKeybinding(event, 'mod+shift+z')) {
    event.preventDefault()
    impl.redo()
    return
  }

  // Enter key
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    impl.insertParagraph()
    return
  }
  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault()
    impl.insertHardBreak()
    return
  }

  // Plugin keybindings
  for (const plugin of mergedPlugins.value) {
    if (plugin.keybinding && matchesKeybinding(event, plugin.keybinding)) {
      event.preventDefault()
      plugin.command(api.value)
      return
    }
  }
}
</script>
