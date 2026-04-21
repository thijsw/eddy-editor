# Eddy Editor — React guide

## Installation

```bash
pnpm add eddy-editor react react-dom lucide-react
# or
npm install eddy-editor react react-dom lucide-react
```

`react`, `react-dom`, and `lucide-react` are peer dependencies. `lucide-react` is only required when you render the built-in toolbar. If you build a fully custom toolbar, you can skip it.

React 18 and 19 are both supported.

## Basic usage

```tsx
import { useState } from 'react'
import { EddyEditor, defaultPlugins } from 'eddy-editor/react'
import 'eddy-editor/style.css'

export function MyEditor() {
  const [content, setContent] = useState('<p>Hello world</p>')
  return <EddyEditor value={content} onChange={setContent} plugins={defaultPlugins} />
}
```

`value` is an HTML string. On first render the editor is seeded with that string; every edit fires `onChange` with the updated canonical HTML. The editor ignores `value` updates that match the last HTML it emitted, so you don't need to worry about echo loops.

The `plugins` prop is the **complete** plugin list — the wrapper does no auto-merging with `defaultPlugins`. Import and pass whichever subset you need. Omitting the prop gives you a minimally functional editor with the paragraph schema invariant but no formatting, Enter handling, paste handling, or undo/redo.

**Import paths.** `EddyEditor`, `EddyToolbar`, `useEditorState`, and the decorated `defaultPlugins` (and individual plugin exports) come from `eddy-editor/react`. Framework-specific Lucide icons are baked into those plugin toolbar items at this layer so unused plugins and their icons tree-shake out. Import plugins from the root `eddy-editor` if you want the undecorated versions (no icons — just labels).

## Custom toolbar

Replace the default toolbar by passing a `renderToolbar` render prop. It receives the live editor API, merged plugin list, and disabled flag — identical to Vue's `#toolbar` scoped slot.

### Inline render prop

```tsx
<EddyEditor
  value={content}
  onChange={setContent}
  renderToolbar={({ editor }) => (
    <div>
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          editor?.run('bold.toggle')
        }}
      >
        Bold
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          editor?.run('italic.toggle')
        }}
      >
        Italic
      </button>
    </div>
  )}
/>
```

`onMouseDown` + `e.preventDefault()` is important — it stops the click from blurring the editor before the command runs.

This works for simple cases, but the closure is not reactive to selection changes — button active states won't update as the cursor moves. Use `useEditorState` (below).

To render no toolbar at all, pass a function that returns `null`:

```tsx
<EddyEditor value={content} onChange={setContent} renderToolbar={() => null} />
```

### Custom toolbar component with reactive state

```tsx
// MyToolbar.tsx
import { useMemo } from 'react'
import { useEditorState, type EditorAPI, type EddyPlugin } from 'eddy-editor/react'

interface Props {
  editor: EditorAPI | null
  plugins: EddyPlugin[]
  disabled: boolean
}

export function MyToolbar({ editor, plugins, disabled }: Props) {
  const items = useMemo(
    () =>
      plugins.flatMap((p, pi) =>
        (p.toolbar ?? []).map((t, ti) => ({
          key: `${p.name}:${pi}:${ti}`,
          command: t.command,
          args: t.args ?? [],
          label: t.label,
          title: t.title,
          isActive: t.isActive,
        })),
      ),
    [plugins],
  )

  const states = useEditorState(editor, items)

  return (
    <div className="my-toolbar">
      {items.map((item) => {
        const active = states.get(item.key) ?? false
        return (
          <button
            key={item.key}
            className={active ? 'active' : ''}
            title={item.title}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault()
              editor?.run(item.command, ...item.args)
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
```

```tsx
<EddyEditor
  value={content}
  onChange={setContent}
  renderToolbar={(props) => <MyToolbar {...props} />}
/>
```

`useEditorState(editor, items)` returns a `Map<string, boolean>` keyed by each item's `key`. The hook subscribes to `editor.on('selectionchange')` and `editor.on('change')`, which fire synchronously from the editor's mutation path — React's batching flushes the state update in the same tick as the command that triggered it.

## Using custom plugins

Any plugin list is valid. Combine with the defaults:

```ts
import { defaultPlugins } from 'eddy-editor'
const plugins = [...defaultPlugins, highlight]
```

Plugins are plain objects typed as `EddyPlugin`:

```ts
import type { EddyPlugin } from 'eddy-editor'

const highlight: EddyPlugin = {
  name: 'highlight',
  marks: [
    {
      type: 'highlight',
      parseDOM: [{ tag: 'mark' }],
      toDOM: () => ['mark'],
    },
  ],
  commands: {
    'highlight.toggle': (api) => api.toggleMark('highlight'),
  },
  keybindings: { 'mod+shift+h': 'highlight.toggle' },
  toolbar: [
    {
      command: 'highlight.toggle',
      label: 'H',
      title: 'Highlight (Mod+Shift+H)',
      isActive: (api) => api.isMarkActive('highlight'),
    },
  ],
}
```

```tsx
<EddyEditor value={content} onChange={setContent} plugins={[...defaultPlugins, highlight]} />
```

See the [main README](../README.md#plugin-system) for the full plugin surface (blocks, `setup(ctx)`, transactions, schema rules).

## Using built-in plugins individually

All built-in plugins are exported individually from `eddy-editor`. Build an explicit plugin list to control exactly which features are available — and which chunks land in your bundle:

```ts
import { core, bold, italic, heading, list } from 'eddy-editor'

const plugins = [core, bold, italic, heading, list]
```

```tsx
<EddyEditor value={content} onChange={setContent} plugins={plugins} />
```

Tree-shaking works as expected: the plugins you don't import aren't in your bundle. Omitting `core` loses Enter / Shift+Enter / paste / Mod+Z handling but the `paragraph` schema invariant stays — parsing and serialising still work.

## API reference

### `<EddyEditor>` props

| Prop            | Type                                     | Default | Description                                                                  |
| --------------- | ---------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `value`         | `string`                                 | —       | HTML content                                                                 |
| `onChange`      | `(html: string) => void`                 | —       | Called with canonical HTML on every edit                                     |
| `plugins`       | `EddyPlugin[]`                           | `[]`    | Complete plugin list. No auto-merge — pass `defaultPlugins` for defaults     |
| `disabled`      | `boolean`                                | `false` | Disables editing and toolbar controls                                        |
| `placeholder`   | `string`                                 | —       | Hint shown when the editor is empty                                          |
| `renderToolbar` | `(props: ToolbarSlotProps) => ReactNode` | —       | Render prop for a custom toolbar. Falls back to the built-in `<EddyToolbar>` |

```ts
interface ToolbarSlotProps {
  editor: EditorAPI | null
  plugins: EddyPlugin[]
  disabled: boolean
}
```

### `<EddyToolbar>` props

| Prop       | Type                | Description                              |
| ---------- | ------------------- | ---------------------------------------- |
| `editor`   | `EditorAPI \| null` | The editor API instance                  |
| `plugins`  | `EddyPlugin[]`      | Merged plugin list                       |
| `disabled` | `boolean`           | Whether controls are disabled (optional) |

The default toolbar has one built-in element: a heading-level `<select>` (Normal / H1–H6). Headings are near-universal and a dropdown is better UX than six buttons. Every other control comes from plugin-contributed `ToolbarItem`s. If you want zero built-in UI, pass a `renderToolbar` prop.

### `EddyPlugin` essentials

```ts
interface EddyPlugin {
  name: string
  marks?: MarkSpec[]
  blocks?: BlockSpec[]
  commands?: Record<string, (api: EditorAPI, ...args: unknown[]) => void>
  keybindings?: Record<string, string> // "mod+b" → command name
  toolbar?: ToolbarItem[]
  schemaRules?: SchemaRule[]
  setup?(ctx: PluginContext): (() => void) | void
}

interface ToolbarItem {
  command: string
  args?: unknown[] // spread into editor.run(command, ...args)
  label: string
  title: string
  icon?: unknown // React `ComponentType<{ size?: number }>` in this wrapper
  isActive?(api: EditorAPI): boolean
}
```

Full schema details (`MarkSpec`, `BlockSpec`, `PluginContext`, `TransactionAPI`) are in the [root README](../README.md#plugin-system) and the exported TypeScript types.

### `useEditorState(editor, items)`

Hook returning a `Map<string, boolean>` — each `item.key` → `item.isActive(editor)`. Subscribes to `editor.on('selectionchange')` and `editor.on('change')` internally; both fire synchronously from the editor's mutation path, so state updates land within the same event handler as the command that caused them.

See the [main README](../README.md) for the full `EditorAPI` surface, keyboard shortcuts, styling, and AST utilities.
