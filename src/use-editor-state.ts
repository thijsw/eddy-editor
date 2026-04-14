import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'
import type { EditorAPI, EddyPlugin } from './types'

/**
 * Returns a reactive Map of plugin name → isActive boolean.
 *
 * Refreshes on every `selectionchange` (document-level) and `input` event so
 * toolbar buttons reflect the formatting at the current cursor position.
 *
 * Must be called inside a component setup that has access to lifecycle hooks
 * (i.e., inside eddy-toolbar.vue setup).
 */
export function useEditorState(
  api: Ref<EditorAPI | null>,
  plugins: EddyPlugin[],
): Ref<Map<string, boolean>> {
  const activeStates = ref<Map<string, boolean>>(new Map())

  function refresh(): void {
    const currentApi = api.value
    if (!currentApi) return

    const next = new Map<string, boolean>()
    for (const plugin of plugins) {
      if (plugin.isActive) {
        next.set(plugin.name, plugin.isActive(currentApi))
      }
    }
    activeStates.value = next
  }

  onMounted(() => {
    document.addEventListener('selectionchange', refresh)
    api.value?.el?.addEventListener('input', refresh)
    refresh()
  })

  onBeforeUnmount(() => {
    document.removeEventListener('selectionchange', refresh)
    api.value?.el?.removeEventListener('input', refresh)
  })

  return activeStates
}
