import { useMemo, type ComponentType, type MouseEvent, type ChangeEvent } from 'react'
import type { EditorAPI, EddyPlugin } from '../types'
import { useEditorState } from './use-editor-state'

type IconComponent = ComponentType<{ size?: number }>

interface ResolvedItem {
  key: string
  command: string
  args: unknown[]
  label: string
  title: string
  icon: IconComponent | undefined
  isActive: ((api: EditorAPI) => boolean) | undefined
}

export interface EddyToolbarProps {
  editor: EditorAPI | null
  plugins: EddyPlugin[]
  disabled?: boolean
}

export function EddyToolbar({ editor, plugins, disabled = false }: EddyToolbarProps) {
  const items = useMemo((): ResolvedItem[] => {
    const out: ResolvedItem[] = []
    for (const plugin of plugins) {
      if (!plugin.toolbar) continue
      plugin.toolbar.forEach((item, i) => {
        out.push({
          key: `${plugin.name}:${item.command}:${i}`,
          command: item.command,
          args: item.args ?? [],
          label: item.label,
          title: item.title,
          icon: item.icon as IconComponent | undefined,
          isActive: item.isActive,
        })
      })
    }
    return out
  }, [plugins])

  const states = useEditorState(editor, items)

  const currentBlockValue = (() => {
    const block = editor?.getBlockAt()
    if (block?.type === 'heading') {
      const level = block.attrs.level
      if (typeof level === 'number' && level >= 1 && level <= 6) return `h${level}`
    }
    return 'paragraph'
  })()

  function onBlockTypeChange(event: ChangeEvent<HTMLSelectElement>): void {
    if (!editor) return
    const value = event.target.value
    if (value === 'paragraph') {
      editor.setBlockType('paragraph')
    } else {
      const level = parseInt(value.replace('h', ''))
      editor.setBlockType('heading', { level })
    }
    editor.el?.focus()
  }

  function onButtonMouseDown(event: MouseEvent<HTMLButtonElement>, item: ResolvedItem): void {
    event.preventDefault()
    if (editor) editor.run(item.command, ...item.args)
  }

  // The heading-level <select> below is the default toolbar's one opinionated
  // built-in: headings are near-universal, and a dropdown is better UX than
  // six buttons. Everything else comes from plugin-contributed ToolbarItems.
  // If you want zero built-in UI, render your own toolbar via `renderToolbar`.
  return (
    <div className="eddy-toolbar" role="toolbar" aria-label="Text formatting">
      <select
        className="eddy-toolbar-select"
        value={currentBlockValue}
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

      {items.map((item) => {
        const Icon = item.icon
        const active = states.get(item.key) ?? false
        return (
          <button
            key={item.key}
            type="button"
            className={`eddy-toolbar-btn${active ? ' is-active' : ''}`}
            title={item.title}
            aria-label={item.title}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(e) => onButtonMouseDown(e, item)}
          >
            {Icon ? <Icon size={16} /> : <span>{item.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
