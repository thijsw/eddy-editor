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

/**
 * Returns true when the cursor (collapsed selection) sits at the very first
 * character position inside its containing block element.
 *
 * Strategy: cursor must be at offset 0, and every ancestor up to (but not
 * including) the block boundary must have no preceding siblings — meaning
 * there is no content before the cursor within the block.
 */
function isCursorAtBlockStart(): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !sel.getRangeAt(0).collapsed) return false
  const range = sel.getRangeAt(0)
  if (range.startOffset !== 0) return false

  // Walk up the tree; any preceding sibling at any level means content exists
  // before the cursor in its block. Stop when we reach a block element.
  let node: Node | null = range.startContainer
  while (node && node !== editorEl.value) {
    const tag = node.nodeType === Node.ELEMENT_NODE ? (node as Element).tagName.toLowerCase() : ''
    if (/^(p|h[1-6]|li|blockquote)$/.test(tag)) {
      // Reached the block boundary with no preceding content — cursor is at block start
      return true
    }
    if (node.previousSibling) return false
    node = node.parentNode
  }
  return false
}

function onKeydown(event: KeyboardEvent): void {
  if (!api.value) return

  if (event.key === 'Enter') {
    const blockTag = api.value.getCommandValue('formatBlock').toLowerCase()
    const inHeading = /^h[1-6]$/.test(blockTag)

    if (inHeading) {
      event.preventDefault()
      const atStart = isCursorAtBlockStart()
      api.value.execute('insertParagraph')

      if (atStart) {
        // Chrome's insertParagraph at position 0 creates an empty heading *before*
        // the content and leaves the cursor in the heading with content.
        // We want the cursor in that empty preceding block instead, so we redirect
        // the selection there and convert it to <p>.
        //
        // We call document.execCommand directly (not via api.execute) to avoid the
        // el.focus() call inside execute() which would reset our manual selection.
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const container = sel.getRangeAt(0).startContainer
          const headingEl = (container.nodeType === Node.TEXT_NODE
            ? (container as Text).parentElement
            : container as Element
          )?.closest('h1,h2,h3,h4,h5,h6')
          const emptyBlock = headingEl?.previousElementSibling
          if (emptyBlock) {
            const r = document.createRange()
            r.setStart(emptyBlock, 0)
            r.collapse(true)
            sel.removeAllRanges()
            sel.addRange(r)
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            document.execCommand('formatBlock', false, '<p>')
            return
          }
        }
      }

      // Middle/end of heading: cursor is in the new block after the split — convert it to <p>.
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
