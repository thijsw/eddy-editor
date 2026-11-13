# Eddy Editor — React guide

## Installation

```bash
npm install eddy-editor
```

`react` (18 or 19) is the only peer dependency.

## Basic usage

```tsx
import { useState } from 'react'
import { EddyEditor } from 'eddy-editor/react'
import { defaultPlugins } from 'eddy-editor'
import 'eddy-editor/style.css'

export function MyEditor() {
  const [content, setContent] = useState('<p>Hello world</p>')
  return <EddyEditor value={content} onChange={setContent} plugins={defaultPlugins} />
}
```

`value` is an HTML string: the editor is seeded with it on mount, and `onChange` receives the canonical HTML after every edit (`''` when empty). Passing anything other than the last emitted value replaces the content.

`plugins` is the complete list and is read once on mount. Pass `defaultPlugins`, a subset (`[bold, italic, link]`), or add your own (`[...defaultPlugins, highlight]`). Define it outside the component or memoise it. Without plugins you still get paragraphs, Enter, Shift+Enter, paste and undo.

## Reaching the editor

```tsx
const [editor, setEditor] = useState<Editor | null>(null)

<EddyEditor value={content} onChange={setContent} plugins={defaultPlugins} onReady={setEditor} />
<button onClick={() => editor?.insertBlock('heading', { level: 2 })}>Add heading</button>
```

## Custom toolbar

`renderToolbar` replaces the default toolbar and receives `{ editor }` (`null` until mounted). Return `null` to render none.

`useEditorState(editor, select)` re-renders when `select(editor)` changes. `select` must return a primitive or a stable reference.

```tsx
import { useEditorState } from 'eddy-editor/react'
import { toggleList, type Editor } from 'eddy-editor'

function MyToolbar({ editor }: { editor: Editor | null }) {
  const bold = useEditorState(editor, (ed) => 'bold' in ed.getMarks())
  const list = useEditorState(editor, (ed) => ed.getBlock()?.type === 'listItem')
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()
  return (
    <div className="my-toolbar">
      <button
        className={bold ? 'active' : ''}
        onMouseDown={keepFocus}
        onClick={() => editor?.toggleMark('bold')}
      >
        B
      </button>
      <button
        className={list ? 'active' : ''}
        onMouseDown={keepFocus}
        onClick={() => editor && toggleList(editor, false)}
      >
        •
      </button>
    </div>
  )
}
```

```tsx
<EddyEditor
  value={content}
  onChange={setContent}
  plugins={defaultPlugins}
  renderToolbar={(p) => <MyToolbar {...p} />}
/>
```

Preventing default on `mousedown` keeps focus (and the selection) in the editor.

## API

### `<EddyEditor>`

| Prop            | Type                               | Description                              |
| --------------- | ---------------------------------- | ---------------------------------------- |
| `value`         | `string`                           | HTML content                             |
| `onChange`      | `(html: string) => void`           | Canonical HTML after every edit          |
| `plugins`       | `Plugin[]`                         | Complete plugin list, read once on mount |
| `disabled`      | `boolean`                          | Disables editing and the toolbar         |
| `placeholder`   | `string`                           | Shown while the editor is empty          |
| `renderToolbar` | `({ editor }) => ReactNode`        | Replaces the default toolbar             |
| `onReady`       | `(editor: Editor \| null) => void` | The instance on mount, `null` on unmount |

### `<EddyToolbar editor={editor} />`

The default toolbar: every plugin's `toolbar` items, kept in sync with the editor. Use it when you want the default toolbar somewhere else in your layout.

### `useEditorState(editor, select)`

Returns `T | undefined`, built on `useSyncExternalStore`.

See the [README](../README.md) for plugins, the editor API, and styling.
