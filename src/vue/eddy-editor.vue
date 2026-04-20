<template>
  <div class="eddy-wrapper">
    <slot name="toolbar" :editor="api" :plugins="mergedPlugins" :disabled="!!disabled">
      <eddy-toolbar :editor="api" :plugins="mergedPlugins" :disabled="!!disabled" />
    </slot>

    <div
      ref="editorEl"
      class="eddy-editor"
      :class="{ 'is-disabled': disabled }"
      :data-placeholder="placeholder || null"
      contenteditable="true"
      v-html="ssrHTML"
      @input="onInput"
      @keydown="onKeydown"
      @paste="onPaste"
      @compositionstart="isComposing = true"
      @compositionend="onCompositionEnd"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch, onMounted } from 'vue'
import EddyToolbar from './eddy-toolbar.vue'
import { Editor } from '../editor'
import { matchesKeybinding } from '../matches-keybinding'
import { defaultPlugins } from '../plugins/index'
import type { EditorAPI, EddyPlugin } from '../types'

interface Props {
  modelValue: string
  plugins?: EddyPlugin[]
  disabled?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  plugins: () => [],
  disabled: false,
  placeholder: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Captured once so Vue sees a stable value on re-renders and never overwrites
// innerHTML after the Editor takes over on mount.
const ssrHTML = props.modelValue

const editorEl = shallowRef<HTMLElement | null>(null)
// shallowRef: the Editor holds a deep AST. We never want Vue to wrap it in a
// reactive proxy — the editor manages its own DOM and notifies via events.
const api = shallowRef<EditorAPI | null>(null)
let impl: Editor | null = null
let isComposing = false
// The last canonical HTML we emitted — used to ignore v-model echoes.
let lastEmitted = ''

// Consumer plugins take priority: built-ins with the same name are dropped.
const mergedPlugins = computed((): EddyPlugin[] => {
  const consumerNames = new Set(props.plugins.map((p) => p.name))
  const builtins = defaultPlugins.filter((p) => !consumerNames.has(p.name))
  return [...builtins, ...props.plugins]
})

function handleEmit(html: string): void {
  if (html === lastEmitted) return
  lastEmitted = html
  emit('update:modelValue', html)
}

onMounted(() => {
  if (!editorEl.value) return
  impl = new Editor(editorEl.value, handleEmit)
  impl.loadHTML(props.modelValue)
  if (props.disabled) editorEl.value.contentEditable = 'false'
  api.value = impl
})

// Set contenteditable imperatively to avoid Vue patching the attribute on
// every re-render, which can reset the browser selection inside contenteditable.
watch(
  () => props.disabled,
  (isDisabled) => {
    if (editorEl.value) {
      editorEl.value.contentEditable = isDisabled ? 'false' : 'true'
    }
  },
)

watch(
  () => props.modelValue,
  (newVal) => {
    if (!impl || newVal === lastEmitted) return
    impl.loadHTML(newVal)
  },
)

function onInput(): void {
  if (!impl || isComposing) return
  impl.syncFromDOM()
}

function onPaste(event: ClipboardEvent): void {
  if (!impl) return
  event.preventDefault()
  const data = event.clipboardData
  if (!data) return
  const html = data.getData('text/html')
  if (html) {
    impl.insertHTML(html)
  } else {
    impl.insertText(data.getData('text/plain'))
  }
}

function onCompositionEnd(): void {
  isComposing = false
  onInput()
}

function onKeydown(event: KeyboardEvent): void {
  if (!api.value || !impl) return

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

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    impl.insertParagraph()
    return
  }
  if (event.key === 'Enter' && event.shiftKey) {
    // Browser handles Shift+Enter natively — <br> insertion and cursor
    // placement. onInput() then re-syncs the AST.
    impl.pushHistory()
    return
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
