import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Editor } from '../editor'
import type { EditorAPI, EddyPlugin } from '../types'
import { EddyToolbar } from './eddy-toolbar'

const EMPTY_PLUGINS: EddyPlugin[] = []

export interface ToolbarSlotProps {
  editor: EditorAPI | null
  plugins: EddyPlugin[]
  disabled: boolean
}

export interface EddyEditorProps {
  value: string
  onChange?: (html: string) => void
  /**
   * Complete plugin list. No auto-merge with `defaultPlugins` — pass the
   * exact set you want. Import `defaultPlugins` from `eddy-editor` if you
   * want the full built-in set.
   */
  plugins?: EddyPlugin[]
  disabled?: boolean
  placeholder?: string
  /**
   * Render function for a custom toolbar. Receives the current editor API,
   * the plugin list, and disabled flag. When omitted, the default
   * `<EddyToolbar>` is rendered.
   */
  renderToolbar?: (props: ToolbarSlotProps) => ReactNode
}

export function EddyEditor({
  value,
  onChange,
  plugins,
  disabled = false,
  placeholder,
  renderToolbar,
}: EddyEditorProps) {
  const editorEl = useRef<HTMLDivElement>(null)
  const implRef = useRef<Editor | null>(null)
  const lastEmittedRef = useRef<string>('')
  const isComposingRef = useRef<boolean>(false)
  const [api, setApi] = useState<EditorAPI | null>(null)

  const ssrContent = useMemo(() => ({ __html: value }), [])

  const effectivePlugins = plugins ?? EMPTY_PLUGINS

  const onChangeRef = useRef<typeof onChange>(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const el = editorEl.current
    if (!el) return
    const handleEmit = (html: string): void => {
      if (html === lastEmittedRef.current) return
      lastEmittedRef.current = html
      onChangeRef.current?.(html)
    }
    const impl = new Editor(el, handleEmit, effectivePlugins)
    impl.loadHTML(value)
    el.contentEditable = disabled ? 'false' : 'true'
    implRef.current = impl
    setApi(impl)

    return () => {
      impl.destroy()
      implRef.current = null
      setApi(null)
    }
    // Intentionally empty deps — we want a single Editor instance. Changing
    // `plugins` after mount is not supported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function onPaste(event: ClipboardEvent<HTMLDivElement>): void {
    implRef.current?.handlePaste(event.nativeEvent)
  }

  function onCompositionEnd(): void {
    isComposingRef.current = false
    onInput()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    implRef.current?.handleKeydown(event.nativeEvent)
  }

  const slotProps: ToolbarSlotProps = {
    editor: api,
    plugins: effectivePlugins,
    disabled: !!disabled,
  }

  return (
    <div className="eddy-wrapper">
      {renderToolbar ? (
        renderToolbar(slotProps)
      ) : (
        <EddyToolbar editor={api} plugins={effectivePlugins} disabled={!!disabled} />
      )}
      <div
        ref={editorEl}
        className={`eddy-editor${disabled ? ' is-disabled' : ''}`}
        data-placeholder={placeholder || undefined}
        dangerouslySetInnerHTML={ssrContent}
        suppressContentEditableWarning
        onInput={onInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onCompositionStart={() => {
          isComposingRef.current = true
        }}
        onCompositionEnd={onCompositionEnd}
      />
    </div>
  )
}
