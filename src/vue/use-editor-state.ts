import { shallowRef, watchEffect, onBeforeUnmount, type Ref } from 'vue'
import type { EditorAPI } from '../types'

interface ActiveStateItem {
  key: string
  isActive: ((api: EditorAPI) => boolean) | undefined
}

/**
 * Returns a reactive Map of toolbar-item key → isActive boolean, synced with
 * the editor's `selectionchange` and `change` events.
 */
export function useEditorState(
  api: Ref<EditorAPI | null>,
  items: Ref<ActiveStateItem[]>,
): Ref<Map<string, boolean>> {
  const activeStates = shallowRef<Map<string, boolean>>(new Map())

  function refresh(currentApi: EditorAPI | null): void {
    if (!currentApi) return
    const prev = activeStates.value
    const next = new Map<string, boolean>()
    const list = items.value
    let changed = prev.size === 0 && list.some((i) => i.isActive)

    for (const item of list) {
      if (!item.isActive) continue
      const value = item.isActive(currentApi)
      next.set(item.key, value)
      if (!changed && prev.get(item.key) !== value) changed = true
    }

    if (changed) activeStates.value = next
  }

  let offs: Array<() => void> = []
  watchEffect(() => {
    for (const off of offs) off()
    offs = []
    const currentApi = api.value
    if (!currentApi) return

    const listener = () => refresh(currentApi)
    offs.push(currentApi.on('selectionchange', listener))
    offs.push(currentApi.on('change', listener))
    refresh(currentApi)
  })

  onBeforeUnmount(() => {
    for (const off of offs) off()
    offs = []
  })

  return activeStates
}
