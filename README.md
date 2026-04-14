# Eddy Editor

A lightweight WYSIWYG text editor for Vue 3. AST-based, zero runtime dependencies, fully typed.

[Live demo](https://thijsw.github.io/eddy-editor/)

## Features

- **AST document model** -- content is a typed tree, not raw HTML. Schema rules enforce valid structure (e.g. lists cannot nest inside paragraphs).
- **No `execCommand`** -- all formatting uses modern Range/Selection APIs via pure AST transforms. No deprecated browser APIs.
- **Zero runtime dependencies** -- Vue 3 is the only peer dependency. <!-- BUNDLE_SIZE -->**37.93 kB** min / **9.20 kB** gzip<!-- /BUNDLE_SIZE -->.
- **v-model binding** -- two-way HTML string binding. Set content programmatically, read it reactively.
- **Plugin system** -- every feature (bold, headings, lists) is a plugin. Add custom plugins, override built-ins, or use only what you need.
- **Full TypeScript API** -- typed commands (`toggleMark`, `setBlockType`, `toggleList`) and state inspection (`isMarkActive`, `getBlockType`, `getHeadingLevel`).
- **Undo / Redo** -- built-in history stack with Mod+Z / Mod+Shift+Z.
- **SSR-safe** -- no browser API access at module evaluation time.
- **Themeable** -- all visual properties exposed as CSS custom properties.

## Installation

```bash
npm install eddy-editor
# or
pnpm add eddy-editor
```

Vue 3 is a peer dependency and must be installed separately.

## Basic usage

```vue
<template>
  <eddy-editor v-model="content">
    <template #toolbar>
      <eddy-toolbar />
    </template>
  </eddy-editor>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EddyEditor, EddyToolbar } from 'eddy-editor'
import 'eddy-editor/style.css'

const content = ref('<p>Hello world</p>')
</script>
```

The `v-model` value is an HTML string. On first render the editor is seeded with that string; every edit emits an updated HTML string back.

All built-in plugins (bold, italic, headings, lists, etc.) are included by default.

## Editor without the built-in toolbar

`<eddy-toolbar />` is optional. Use the scoped slot to build your own toolbar, or omit the slot entirely for a bare editor.

```vue
<template>
  <eddy-editor v-model="content">
    <template #toolbar="{ editor }">
      <button @mousedown.prevent="editor?.toggleMark('bold')">Bold</button>
    </template>
  </eddy-editor>
</template>
```

`@mousedown.prevent` is important -- it stops the click from blurring the editor before the command runs.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Mod+B | Bold |
| Mod+I | Italic |
| Mod+U | Underline |
| Mod+Z | Undo |
| Mod+Shift+Z | Redo |
| Enter | New paragraph (exits headings into `<p>`) |
| Shift+Enter | Line break (`<br>`) |

"Mod" means Cmd on macOS, Ctrl on Windows/Linux.

## Plugin system

Every feature in Eddy is a plugin. The full set of built-ins is loaded by default, but you can extend the editor with your own plugins or override any built-in by name.

### Writing a plugin

```ts
import { createPlugin } from 'eddy-editor'

const codePlugin = createPlugin({
  name: 'code',
  keybinding: 'mod+e',
  toolbar: {
    label: '<>',
    title: 'Inline code (Mod+E)',
  },
  command(api) {
    api.toggleMark('bold') // use any EditorAPI method
  },
  isActive(api) {
    return api.isMarkActive('bold')
  },
})
```

### Using custom plugins

Pass plugins via the `plugins` prop. Any plugin whose `name` matches a built-in replaces it; new names are appended.

```vue
<eddy-editor v-model="content" :plugins="[codePlugin]">
  <template #toolbar>
    <eddy-toolbar />
  </template>
</eddy-editor>
```

### Using built-in plugins individually

All built-in plugins are exported individually. Build a custom plugin list to control exactly which features are available:

```ts
import { bold, italic, heading1, heading2, unorderedList } from 'eddy-editor'

const plugins = [bold, italic, heading1, heading2, unorderedList]
```

```vue
<eddy-editor v-model="content" :plugins="plugins">
```

### Built-in plugins

| Plugin | Export name | Keybinding |
|---|---|---|
| Bold | `bold` | Mod+B |
| Italic | `italic` | Mod+I |
| Underline | `underline` | Mod+U |
| Strikethrough | `strikethrough` | |
| Heading 1--6 | `heading1` ... `heading6` | |
| Bullet list | `unorderedList` | |
| Numbered list | `orderedList` | |

## EditorAPI

The `api` object passed to plugin `command` and `isActive` callbacks:

### Commands

| Method | Description |
|---|---|
| `toggleMark(mark)` | Toggle bold, italic, underline, or strikethrough |
| `setBlockType(type, attrs?)` | Set block to `'paragraph'` or `'heading'` with optional `{ level: 1-6 }` |
| `toggleList(ordered)` | Toggle unordered (`false`) or ordered (`true`) list |
| `insertParagraph()` | Insert a new paragraph (Enter key behaviour) |
| `insertHardBreak()` | Insert a `<br>` line break (Shift+Enter behaviour) |

### State inspection

| Method | Returns | Description |
|---|---|---|
| `isMarkActive(mark)` | `boolean` | Whether the mark is active at the cursor or across the selection |
| `getBlockType()` | `'paragraph' \| 'heading' \| 'list' \| 'mixed'` | Block type at the cursor |
| `getHeadingLevel()` | `1-6 \| null` | Heading level, or `null` if not in a heading |
| `getListType()` | `'ordered' \| 'unordered' \| null` | List type, or `null` if not in a list |

### Properties

| Property | Type | Description |
|---|---|---|
| `el` | `HTMLElement \| null` | The underlying `contenteditable` element |
| `doc` | `DocumentNode` | The current AST document tree |
| `selection` | `ASTSelection \| null` | The current cursor/selection as AST positions |

`MarkType` is `'bold' | 'italic' | 'underline' | 'strikethrough'`.

## Styling

Import the default stylesheet:

```ts
import 'eddy-editor/style.css'
```

Override any aspect with CSS custom properties:

```css
:root {
  --eddy-border: 1px solid #e2e8f0;
  --eddy-border-radius: 0.5rem;
  --eddy-focus-ring-color: #6366f1;
  --eddy-toolbar-bg: #ffffff;
  --eddy-toolbar-btn-hover-bg: #f1f5f9;
  --eddy-toolbar-btn-active-bg: #e2e8f0;
  --eddy-toolbar-btn-active-color: inherit;
  --eddy-min-height: 200px;
  --eddy-padding: 0.75rem 1rem;
  --eddy-font-family: inherit;
  --eddy-font-size: inherit;
  --eddy-line-height: 1.6;
}
```

Or skip the default stylesheet entirely and style `.eddy-wrapper`, `.eddy-toolbar`, `.eddy-toolbar-btn`, and `.eddy-editor` yourself.

## AST utilities

The document model types and HTML conversion utilities are exported for server-side processing:

```ts
import { parseHTML, serializeToHTML } from 'eddy-editor'
import type { DocumentNode } from 'eddy-editor'

const doc: DocumentNode = parseHTML('<p>Hello <strong>world</strong></p>')
const html: string = serializeToHTML(doc)
```

The full set of AST node types (`DocumentNode`, `BlockNode`, `InlineNode`, `TextNode`, `Mark`, etc.) is exported as TypeScript types.

## API reference

### `<eddy-editor>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `modelValue` | `string` | -- | HTML content (use with `v-model`) |
| `plugins` | `EddyPlugin[]` | `[]` | Additional or replacement plugins |

| Slot | Slot props | Description |
|---|---|---|
| `toolbar` | `{ editor: EditorAPI \| null }` | Rendered above the editing area |

### `<eddy-toolbar>`

No props. Must be placed inside the `#toolbar` slot of `<eddy-editor>` -- it uses Vue's `inject` to receive the editor context.

### `EddyPlugin`

```ts
interface EddyPlugin {
  name: string
  keybinding?: string
  toolbar?: { label: string; title: string; icon?: Component }
  command(api: EditorAPI): void
  isActive?(api: EditorAPI): boolean
}
```

### `createPlugin(config)`

Type-safe factory for authoring plugins. Returns the config unchanged; the value is in TypeScript inference.

## License

MIT
