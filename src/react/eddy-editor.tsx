import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Editor } from '../editor'
import { matchesKeybinding } from '../matches-keybinding'
import { defaultPlugins } from '../plugins/index'
import type { EditorAPI, EddyPlugin } from '../types'
import { EddyToolbar } from './eddy-toolbar'

export interface ToolbarSlotProps {
  editor: EditorAPI | null
  plugins: EddyPlugin[]
  disabled: boolean
}

export interface EddyEditorProps {
  value: string
  onChange?: (html: string) => void
  plugins?: EddyPlugin[]
  disabled?: boolean
  /**
   * Render function for a custom toolbar. Receives the current editor API,
   * merged plugins, and disabled flag. When omitted, the default
   * `<EddyToolbar>` is rendered.
   */
  renderToolbar?: (props: ToolbarSlotProps) => ReactNode
}

export function EddyEditor({
  value,
  onChange,
  plugins: consumerPlugins,
  disabled = false,
  renderToolbar,
}: EddyEditorProps) {
  const editorEl = useRef<HTMLDivElement>(null)
  const implRef = useRef<Editor | null>(null)
  const lastEmittedRef = useRef<string>('')
  const isComposingRef = useRef<boolean>(false)
  const [api, setApi] = useState<EditorAPI | null>(null)

  const mergedPlugins = useMemo<EddyPlugin[]>(() => {
    const extras = consumerPlugins ?? []
    const consumerNames = new Set(extras.map((p) => p.name))
    const builtins = defaultPlugins.filter((p) => !consumerNames.has(p.name))
    return [...builtins, ...extras]
  }, [consumerPlugins])
  const pluginsRef = useRef<EddyPlugin[]>(mergedPlugins)
  pluginsRef.current = mergedPlugins

  // Ref the onChange so the Editor's emit callback never goes stale — the
  // Editor is created once on mount and kept for the life of the component.
  const onChangeRef = useRef<typeof onChange>(onChange)
  onChangeRef.current = onChange

  // Mount: create the Editor, seed its content, own the contenteditable
  // attribute. The cleanup lets <React.StrictMode> double-invoke this effect
  // in dev without leaving a stale Editor instance behind.
  useEffect(() => {
    const el = editorEl.current
    if (!el) return
    const handleEmit = (html: string): void => {
      if (html === lastEmittedRef.current) return
      lastEmittedRef.current = html
      onChangeRef.current?.(html)
    }
    const impl = new Editor(el, handleEmit)
    impl.loadHTML(value)
    el.contentEditable = disabled ? 'false' : 'true'
    implRef.current = impl
    setApi(impl)

    return () => {
      implRef.current = null
      setApi(null)
    }
    // Intentionally empty deps — we want a single Editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep contentEditable imperative so React never patches it on re-render
  // (which can reset the browser's contenteditable selection).
  useEffect(() => {
    if (editorEl.current) {
      editorEl.current.contentEditable = disabled ? 'false' : 'true'
    }
  }, [disabled])

  useEffect(() => {
    const impl = implRef.current
    if (!impl) return
    if (value === lastEmittedRef.current) return
    impl.loadHTML(value)
  }, [value])

  function onInput(): void {
    const impl = implRef.current
    if (!impl || isComposingRef.current) return
    impl.syncFromDOM()
  }

  function onCompositionEnd(): void {
    isComposingRef.current = false
    onInput()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const impl = implRef.current
    if (!api || !impl) return

    const native = event.nativeEvent

    if (matchesKeybinding(native, 'mod+z')) {
      event.preventDefault()
      impl.undo()
      return
    }
    if (matchesKeybinding(native, 'mod+shift+z')) {
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

    for (const plugin of pluginsRef.current) {
      if (plugin.keybinding && matchesKeybinding(native, plugin.keybinding)) {
        event.preventDefault()
        plugin.command(api)
        return
      }
    }
  }

  const slotProps: ToolbarSlotProps = { editor: api, plugins: mergedPlugins, disabled: !!disabled }

  return (
    <div className="eddy-wrapper">
      {renderToolbar ? (
        renderToolbar(slotProps)
      ) : (
        <EddyToolbar editor={api} plugins={mergedPlugins} disabled={!!disabled} />
      )}
      <div
        ref={editorEl}
        className={`eddy-editor${disabled ? ' is-disabled' : ''}`}
        suppressContentEditableWarning
        onInput={onInput}
        onKeyDown={onKeyDown}
        onCompositionStart={() => {
          isComposingRef.current = true
        }}
        onCompositionEnd={onCompositionEnd}
      />
    </div>
  )
}
