<template>
  <div class="eddy-wrapper">
    <slot name="toolbar" :editor="api" :plugins="props.plugins" :disabled="!!disabled">
      <eddy-toolbar :editor="api" :plugins="props.plugins" :disabled="!!disabled" />
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
import { shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'
import EddyToolbar from './eddy-toolbar.vue'
import { Editor } from '../editor'
import type { EditorAPI, EddyPlugin } from '../types'

interface Props {
  modelValue: string
  /**
   * Complete plugin list. No auto-merge with `defaultPlugins` — pass the
   * exact set you want. Import `defaultPlugins` from `eddy-editor/vue` if
   * you want the full built-in set with icons.
   */
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

const ssrHTML = props.modelValue

const editorEl = shallowRef<HTMLElement | null>(null)
const api = shallowRef<EditorAPI | null>(null)
let impl: Editor | null = null
let isComposing = false
let lastEmitted = ''

function handleEmit(html: string): void {
  if (html === lastEmitted) return
  lastEmitted = html
  emit('update:modelValue', html)
}

onMounted(() => {
  if (!editorEl.value) return
  impl = new Editor(editorEl.value, handleEmit, props.plugins)
  impl.loadHTML(props.modelValue)
  if (props.disabled) editorEl.value.contentEditable = 'false'
  api.value = impl
})

onBeforeUnmount(() => {
  impl?.destroy()
  impl = null
  api.value = null
})

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
  impl.handlePaste(event)
}

function onCompositionEnd(): void {
  isComposing = false
  onInput()
}

function onKeydown(event: KeyboardEvent): void {
  if (!impl) return
  impl.handleKeydown(event)
}
</script>
