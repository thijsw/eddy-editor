import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createEditor } from './editor'
import { mountToolbar } from './toolbar'
import type { Editor, Plugin } from './types'

export interface EddyToolbarProps {
  editor: Editor | null
}

export function EddyToolbar({ editor }: EddyToolbarProps) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(
    () => (editor && host.current ? mountToolbar(host.current, editor) : undefined),
    [editor],
  )
  return <div ref={host} className="eddy-toolbar" role="toolbar" />
}

export interface EddyEditorProps {
  value: string
  onChange?: (html: string) => void
  /** The complete plugin list, e.g. `defaultPlugins`. Read once on mount. */
  plugins?: readonly Plugin[]
  disabled?: boolean
  placeholder?: string
  /** Replaces the default toolbar. */
  renderToolbar?: (props: { editor: Editor | null }) => ReactNode
  /** Receives the editor instance once mounted (and `null` on unmount). */
  onReady?: (editor: Editor | null) => void
}

export function EddyEditor({
  value,
  onChange,
  plugins,
  disabled,
  placeholder,
  renderToolbar,
  onReady,
}: EddyEditorProps) {
  const el = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [initial] = useState(() => ({ __html: value })) // SSR markup; the editor takes over on mount
  const latest = useRef({ onChange, onReady })
  latest.current = { onChange, onReady }

  useEffect(() => {
    const ed = createEditor(el.current!, {
      plugins: plugins || [],
      content: value,
      onChange: (h) => latest.current.onChange?.(h),
    })
    setEditor(ed)
    latest.current.onReady?.(ed)
    return () => {
      ed.destroy()
      setEditor(null)
      latest.current.onReady?.(null)
    }
    // One editor per mount; `plugins` changes after mount are not supported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (editor && value != editor.getHTML()) editor.setHTML(value)
  }, [editor, value])
  useEffect(() => {
    if (editor) editor.editable = !disabled
  }, [editor, disabled])

  return (
    <div className="eddy-wrapper">
      {renderToolbar ? renderToolbar({ editor }) : <EddyToolbar editor={editor} />}
      <div
        ref={el}
        className="eddy-editor"
        data-placeholder={placeholder || undefined}
        dangerouslySetInnerHTML={initial}
      />
    </div>
  )
}

/**
 * Editor state for custom toolbars. `select` must return a primitive (or a
 * stable reference): `useEditorState(editor, (ed) => 'bold' in ed.getMarks())`
 */
export function useEditorState<T>(editor: Editor | null, select: (ed: Editor) => T): T | undefined {
  const subscribe = useCallback(
    (f: () => void) => (editor ? editor.subscribe(f) : () => false),
    [editor],
  )
  return useSyncExternalStore(
    subscribe,
    () => (editor ? select(editor) : undefined),
    () => undefined,
  )
}
