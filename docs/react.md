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
import { EddyEditor } from 'eddy-editor/react'
import 'eddy-editor/style.css'

export function MyEditor() {
  const [content, setContent] = useState('<p>Hello world</p>')
  return <EddyEditor value={content} onChange={setContent} />
}
```

`value` is an HTML string. On first render the editor is seeded with that string; every edit fires `onChange` with the updated canonical HTML. The editor ignores `value` updates that match the last HTML it emitted, so you don't need to worry about echo loops.

The default toolbar (bold, italic, underline, strikethrough, link, headings, lists) renders automatically. All built-in plugins are included unless you override them via the `plugins` prop.

## Custom toolbar

Replace the default toolbar by passing a `renderToolbar` render prop. It receives the live editor API, merged plugin list, and disabled flag, identical to Vue's `#toolbar` scoped slot.

### Inline render prop

```tsx
<EddyEditor
  value={content}
  onChange={setContent}
  renderToolbar={({ editor }) => (
    <div>
      <button onMouseDown={(e) => { e.preventDefault(); editor?.toggleMark('bold') }}>Bold</button>
      <button onMouseDown={(e) => { e.preventDefault(); editor?.toggleMark('italic') }}>Italic</button>
    </div>
  )}
/>
```

`onMouseDown` + `e.preventDefault()` is important — it stops the click from blurring the editor before the command runs.

This works for simple cases, but the closure is not reactive to selection changes — button active states won't update as the cursor moves. Use `useEditorState` (below) for that.

To render no toolbar at all, pass a function that returns `null`:

```tsx
<EddyEditor value={content} onChange={setContent} renderToolbar={() => null} />
```

### Custom toolbar component with reactive state

For a toolbar that reflects the current formatting at the cursor, build a component that uses the `useEditorState` hook:

```tsx
// MyToolbar.tsx
import { useEditorState, type EditorAPI, type EddyPlugin } from 'eddy-editor/react'

interface Props {
  editor: EditorAPI | null
  plugins: EddyPlugin[]
  disabled: boolean
}

export function MyToolbar({ editor, plugins, disabled }: Props) {
  // `states` is a Map<string, boolean> that re-renders on every selectionchange
  // + input event. `refresh()` lets you re-read the states synchronously after
  // running an editor command — needed for React-controlled elements that
  // otherwise revert to their previous value before the event loop catches up.
  const { states, refresh } = useEditorState(editor, plugins)

  function toggle(mark: 'bold' | 'italic'): void {
    editor?.toggleMark(mark)
    refresh()
  }

  return (
    <div className="my-toolbar">
      <button
        className={states.get('bold') ? 'active' : ''}
        aria-pressed={states.get('bold') ?? false}
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault()
          toggle('bold')
        }}
      >
        Bold
      </button>
      <button
        className={states.get('italic') ? 'active' : ''}
        aria-pressed={states.get('italic') ?? false}
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault()
          toggle('italic')
        }}
      >
        Italic
      </button>
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

`useEditorState(editor, plugins)` returns `{ states, refresh }`. `states` is a `Map<string, boolean>` keyed by plugin name; the hook listens to `selectionchange` and `input` events internally, so your buttons stay in sync as the user moves the cursor between formatted and plain text.

Call `refresh()` in any handler that runs an editor command (e.g. after `editor.toggleMark(...)` or `editor.setBlockType(...)`). The browser fires `selectionchange` asynchronously, but React re-renders controlled elements like `<select value={...}>` synchronously after an event handler — without `refresh()` the render would use stale active states and a controlled element can revert to its previous value.

The `plugins` argument gives you the full merged plugin list (built-ins + any consumer plugins), so you can also iterate over plugins dynamically instead of hardcoding each button.

## Using custom plugins

```ts
import { createPlugin } from 'eddy-editor'

const codePlugin = createPlugin({
  name: 'code',
  keybinding: 'mod+e',
  toolbar: { label: '<>', title: 'Inline code (Mod+E)' },
  command(api) {
    api.toggleMark('bold')
  },
  isActive(api) {
    return api.isMarkActive('bold')
  },
})
```

```tsx
<EddyEditor value={content} onChange={setContent} plugins={[codePlugin]} />
```

## Using built-in plugins individually

All built-in plugins are exported individually from `eddy-editor`. Build a custom plugin list to control exactly which features are available:

```ts
import { bold, italic, heading1, heading2, unorderedList } from 'eddy-editor'

const plugins = [bold, italic, heading1, heading2, unorderedList]
```

```tsx
<EddyEditor value={content} onChange={setContent} plugins={plugins} />
```

## API reference

### `<EddyEditor>` props

| Prop            | Type                                              | Default | Description                                                                |
| --------------- | ------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `value`         | `string`                                          | —       | HTML content                                                               |
| `onChange`      | `(html: string) => void`                          | —       | Called with canonical HTML on every edit                                   |
| `plugins`       | `EddyPlugin[]`                                    | `[]`    | Additional or replacement plugins                                          |
| `disabled`      | `boolean`                                         | `false` | Disables editing and toolbar controls                                      |
| `renderToolbar` | `(props: ToolbarSlotProps) => ReactNode`          | —       | Render prop for a custom toolbar. Falls back to the built-in `<EddyToolbar>` |

```ts
interface ToolbarSlotProps {
  editor: EditorAPI | null
  plugins: EddyPlugin[]
  disabled: boolean
}
```

### `<EddyToolbar>` props

| Prop       | Type                | Description                                |
| ---------- | ------------------- | ------------------------------------------ |
| `editor`   | `EditorAPI \| null` | The editor API instance                    |
| `plugins`  | `EddyPlugin[]`      | Merged plugin list                         |
| `disabled` | `boolean`           | Whether controls are disabled (optional)   |

### `EddyPlugin`

```ts
interface EddyPlugin {
  name: string
  keybinding?: string
  toolbar?: { label: string; title: string; icon?: unknown }
  command(api: EditorAPI): void
  isActive?(api: EditorAPI): boolean
}
```

The `icon` field accepts a React `ComponentType<{ size?: number }>` in this wrapper (the default toolbar renders it as `<Icon size={16} />`). For example, a `lucide-react` icon works directly.

### `createPlugin(config)`

Type-safe factory for authoring plugins. Returns the config unchanged; the value is in TypeScript inference.

### `useEditorState(api, plugins)`

Hook that returns `{ states, refresh }`:

- `states: Map<string, boolean>` — plugin-name → isActive. Updates on every `selectionchange` and `input` event. Triggers a re-render only when an active state actually changes.
- `refresh: () => void` — manually re-read active states. Call after running an editor command so React-controlled elements (like `<select value={...}>`) see the updated state on the next render without waiting for the async `selectionchange` event.

Pass the editor API directly (no ref wrapper).

See the [main README](../README.md) for the full `EditorAPI` surface, keyboard shortcuts, styling, and AST utilities.
