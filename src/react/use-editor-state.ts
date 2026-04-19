import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorAPI, EddyPlugin } from '../types'

export interface EditorStateResult {
  /** Plugin name → isActive boolean, synced with cursor and input events. */
  states: Map<string, boolean>
  /**
   * Manually re-read active states. Call this after running an editor command
   * so a custom toolbar reflects the result on the very next render — the
   * browser only fires `selectionchange` asynchronously, so without `refresh`
   * a React-controlled element (e.g. `<select value={currentBlockType}>`) can
   * revert to its previous value before the hook catches up.
   */
  refresh: () => void
}

/**
 * Tracks plugin active states for a toolbar. Re-renders only when a plugin's
 * `isActive` result actually flips — cursor moves within the same formatting
 * region do not.
 */
export function useEditorState(
  api: EditorAPI | null,
  plugins: EddyPlugin[],
): EditorStateResult {
  const [states, setStates] = useState<Map<string, boolean>>(() => new Map())

  // Latest-ref pattern so `refresh` (memoised below) always reads the current
  // api and plugins without needing to be re-created on every render.
  const apiRef = useRef<EditorAPI | null>(api)
  apiRef.current = api
  const pluginsRef = useRef<EddyPlugin[]>(plugins)
  pluginsRef.current = plugins

  const refresh = useCallback((): void => {
    const currentApi = apiRef.current
    if (!currentApi) return

    setStates((prev) => {
      const next = new Map<string, boolean>()
      const currentPlugins = pluginsRef.current
      let changed = prev.size === 0 && currentPlugins.some((p) => p.isActive)

      for (const plugin of currentPlugins) {
        if (!plugin.isActive) continue
        const value = plugin.isActive(currentApi)
        next.set(plugin.name, value)
        if (!changed && prev.get(plugin.name) !== value) changed = true
      }

      return changed ? next : prev
    })
  }, [])

  useEffect(() => {
    if (!api) return

    const el = api.el
    document.addEventListener('selectionchange', refresh)
    el?.addEventListener('input', refresh)
    refresh()

    return () => {
      document.removeEventListener('selectionchange', refresh)
      el?.removeEventListener('input', refresh)
    }
  }, [api, refresh])

  return { states, refresh }
}
