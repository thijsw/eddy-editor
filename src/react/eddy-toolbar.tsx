import { useMemo, type ComponentType, type MouseEvent, type ChangeEvent } from 'react'
import { Bold, Italic, Underline, Strikethrough, Code, List, ListOrdered, Link } from 'lucide-react'
import type { EditorAPI, EddyPlugin } from '../types'
import { useEditorState } from './use-editor-state'

type IconComponent = ComponentType<{ size?: number }>

const defaultIcons: Record<string, IconComponent> = {
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strikethrough: Strikethrough,
  code: Code,
  link: Link,
  unorderedList: List,
  orderedList: ListOrdered,
}

function resolveIcon(plugin: EddyPlugin): IconComponent | undefined {
  return (plugin.toolbar?.icon as IconComponent | undefined) ?? defaultIcons[plugin.name]
}

export interface EddyToolbarProps {
  editor: EditorAPI | null
  plugins: EddyPlugin[]
  disabled?: boolean
}

export function EddyToolbar({ editor, plugins, disabled = false }: EddyToolbarProps) {
  const { states, refresh } = useEditorState(editor, plugins)

  const nonHeadingPlugins = useMemo(
    () => plugins.filter((p) => p.toolbar != null && !p.name.startsWith('heading')),
    [plugins],
  )

  const currentBlockType = (() => {
    for (let n = 1; n <= 6; n++) {
      if (states.get(`heading${n}`)) return `h${n}`
    }
    return 'paragraph'
  })()

  function onBlockTypeChange(event: ChangeEvent<HTMLSelectElement>): void {
    if (!editor) return
    const value = event.target.value
    if (value === 'paragraph') {
      editor.setBlockType('paragraph')
    } else {
      const level = parseInt(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6
      editor.setBlockType('heading', { level })
    }
    editor.el?.focus()
    refresh()
  }

  function onButtonMouseDown(event: MouseEvent<HTMLButtonElement>, plugin: EddyPlugin): void {
    event.preventDefault()
    if (editor) plugin.command(editor)
    refresh()
  }

  return (
    <div className="eddy-toolbar" role="toolbar" aria-label="Text formatting">
      <select
        className="eddy-toolbar-select"
        value={currentBlockType}
        disabled={disabled}
        onChange={onBlockTypeChange}
      >
        <option value="paragraph">Normal</option>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <option key={n} value={`h${n}`}>
            Heading {n}
          </option>
        ))}
      </select>

      {nonHeadingPlugins.map((plugin) => {
        const Icon = resolveIcon(plugin)
        const active = states.get(plugin.name) ?? false
        return (
          <button
            key={plugin.name}
            type="button"
            className={`eddy-toolbar-btn${active ? ' is-active' : ''}`}
            title={plugin.toolbar!.title}
            aria-label={plugin.toolbar!.title}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(e) => onButtonMouseDown(e, plugin)}
          >
            {Icon ? <Icon size={16} /> : <span>{plugin.toolbar!.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
