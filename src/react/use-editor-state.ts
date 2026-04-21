import { useEffect, useRef, useState } from 'react'
import type { EditorAPI } from '../types'

interface ActiveStateItem {
  key: string
  isActive: ((api: EditorAPI) => boolean) | undefined
}

/**
 * Returns a `Map<string, boolean>` of active states keyed by each item's
 * `key`. Subscribes to `editor.on('selectionchange')` and
 * `editor.on('change')`, which fire synchronously from `_apply` — so the
 * state is up-to-date within the same event tick as the command that
 * triggered the change.
 */
export function useEditorState(
  api: EditorAPI | null,
  items: ActiveStateItem[],
): Map<string, boolean> {
  const [states, setStates] = useState<Map<string, boolean>>(() => new Map())

  const apiRef = useRef<EditorAPI | null>(api)
  apiRef.current = api
  const itemsRef = useRef<ActiveStateItem[]>(items)
  itemsRef.current = items

  useEffect(() => {
    if (!api) return

    function refresh(): void {
      const currentApi = apiRef.current
      if (!currentApi) return
      setStates((prev) => {
        const next = new Map<string, boolean>()
        const currentItems = itemsRef.current
        let changed = prev.size === 0 && currentItems.some((i) => i.isActive)
        for (const item of currentItems) {
          if (!item.isActive) continue
          const value = item.isActive(currentApi)
          next.set(item.key, value)
          if (!changed && prev.get(item.key) !== value) changed = true
        }
        return changed ? next : prev
      })
    }

    const offSel = api.on('selectionchange', refresh)
    const offChange = api.on('change', refresh)
    refresh()
    return () => {
      offSel()
      offChange()
    }
  }, [api])

  return states
}
