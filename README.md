# Eddy Editor

A lightweight WYSIWYG text editor for Vue 3. AST-based, zero runtime dependencies, fully typed.

[Live demo](https://thijsw.github.io/eddy-editor/)

## Features

- **AST document model** -- content is a typed tree, not raw HTML. Schema rules enforce valid structure (e.g. lists cannot nest inside paragraphs).
- **No `execCommand`** -- all formatting uses modern Range/Selection APIs via pure AST transforms. No deprecated browser APIs.
- **Zero runtime dependencies** -- Vue 3 is the only peer dependency. <!-- BUNDLE_SIZE -->**28.59 kB** min / **8.31 kB** gzip<!-- /BUNDLE_SIZE -->.
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

Vue 3 is a peer dependency. If you use the built-in `<eddy-toolbar>`, also install `@lucide/vue` for its icons. If you render a custom toolbar, it is not required.

## Basic usage

```vue
<template>
  <eddy-editor v-model="content">
    <template #toolbar="{ editor, plugins, disabled }">
      <eddy-toolbar :editor="editor" :plugins="plugins" :disabled="disabled" />
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

## Custom toolbar

`<eddy-toolbar />` is optional. You can build a fully custom toolbar in two ways.

### Inline via scoped slot

The `#toolbar` slot exposes the `EditorAPI` directly:

```vue
<template>
  <eddy-editor v-model="content">
    <template #toolbar="{ editor }">
      <button @mousedown.prevent="editor?.toggleMark('bold')">Bold</button>
      <button @mousedown.prevent="editor?.toggleMark('italic')">Italic</button>
    </template>
  </eddy-editor>
</template>
```

`@mousedown.prevent` is important -- it stops the click from blurring the editor before the command runs.

This works for simple cases, but the slot prop is not reactive to selection changes -- button active states won't update as the cursor moves.

### Custom toolbar component with reactive state

For a toolbar that reflects the current formatting at the cursor, create a component that receives the slot props and uses the `useEditorState` composable:

```vue
<!-- MyToolbar.vue -->
<template>
  <div class="my-toolbar">
    <button
      :class="{ active: states.get('bold') }"
      :aria-pressed="states.get('bold') ?? false"
      @mousedown.prevent="editor?.toggleMark('bold')"
    >
      Bold
    </button>
    <button
      :class="{ active: states.get('italic') }"
      :aria-pressed="states.get('italic') ?? false"
      @mousedown.prevent="editor?.toggleMark('italic')"
    >
      Italic
    </button>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useEditorState, type EditorAPI, type EddyPlugin } from 'eddy-editor'

const props = defineProps<{
  editor: EditorAPI | null
  plugins: EddyPlugin[]
  disabled: boolean
}>()

// Reactive Map<string, boolean> — updates on every selectionchange and input event
const states = useEditorState(toRef(props, 'editor'), props.plugins)
</script>
```

Pass the slot props through to your component:

```vue
<eddy-editor v-model="content">
  <template #toolbar="{ editor, plugins, disabled }">
    <my-toolbar :editor="editor" :plugins="plugins" :disabled="disabled" />
  </template>
</eddy-editor>
```

`useEditorState` returns a reactive `Ref<Map<string, boolean>>` keyed by plugin name. It listens to `selectionchange` and `input` events, so your toolbar buttons stay in sync as the user moves the cursor between formatted and plain text.

The `plugins` prop gives you the full merged plugin list (built-ins + any consumer plugins), so you can also iterate over plugins dynamically instead of hardcoding each button.

## Keyboard shortcuts

| Shortcut    | Action                                    |
| ----------- | ----------------------------------------- |
| Mod+B       | Bold                                      |
| Mod+I       | Italic                                    |
| Mod+U       | Underline                                 |
| Mod+Z       | Undo                                      |
| Mod+Shift+Z | Redo                                      |
| Enter       | New paragraph (exits headings into `<p>`) |
| Shift+Enter | Line break (`<br>`)                       |

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
  <template #toolbar="{ editor, plugins, disabled }">
    <eddy-toolbar :editor="editor" :plugins="plugins" :disabled="disabled" />
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

| Plugin        | Export name               | Keybinding |
| ------------- | ------------------------- | ---------- |
| Bold          | `bold`                    | Mod+B      |
| Italic        | `italic`                  | Mod+I      |
| Underline     | `underline`               | Mod+U      |
| Strikethrough | `strikethrough`           |            |
| Heading 1--6  | `heading1` ... `heading6` |            |
| Bullet list   | `unorderedList`           |            |
| Numbered list | `orderedList`             |            |

## EditorAPI

The `api` object passed to plugin `command` and `isActive` callbacks:

### Commands

| Method                       | Description                                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| `toggleMark(mark)`           | Toggle bold, italic, underline, or strikethrough                         |
| `setBlockType(type, attrs?)` | Set block to `'paragraph'` or `'heading'` with optional `{ level: 1-6 }` |
| `toggleList(ordered)`        | Toggle unordered (`false`) or ordered (`true`) list                      |
| `insertParagraph()`          | Insert a new paragraph (Enter key behaviour)                             |
| `insertHardBreak()`          | Insert a `<br>` line break (Shift+Enter behaviour)                       |

### State inspection

| Method               | Returns                                         | Description                                                      |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| `isMarkActive(mark)` | `boolean`                                       | Whether the mark is active at the cursor or across the selection |
| `getBlockType()`     | `'paragraph' \| 'heading' \| 'list' \| 'mixed'` | Block type at the cursor                                         |
| `getHeadingLevel()`  | `1-6 \| null`                                   | Heading level, or `null` if not in a heading                     |
| `getListType()`      | `'ordered' \| 'unordered' \| null`              | List type, or `null` if not in a list                            |

### Properties

| Property    | Type                   | Description                                   |
| ----------- | ---------------------- | --------------------------------------------- |
| `el`        | `HTMLElement \| null`  | The underlying `contenteditable` element      |
| `doc`       | `DocumentNode`         | The current AST document tree                 |
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

| Prop         | Type           | Default | Description                           |
| ------------ | -------------- | ------- | ------------------------------------- |
| `modelValue` | `string`       | --      | HTML content (use with `v-model`)     |
| `plugins`    | `EddyPlugin[]` | `[]`    | Additional or replacement plugins     |
| `disabled`   | `boolean`      | `false` | Disables editing and toolbar controls |

| Slot      | Slot props                                                                | Description                     |
| --------- | ------------------------------------------------------------------------- | ------------------------------- |
| `toolbar` | `{ editor: EditorAPI \| null, plugins: EddyPlugin[], disabled: boolean }` | Rendered above the editing area |

### `<eddy-toolbar>`

| Prop       | Type                | Description                                    |
| ---------- | ------------------- | ---------------------------------------------- |
| `editor`   | `EditorAPI \| null` | The editor API instance (from slot prop)       |
| `plugins`  | `EddyPlugin[]`      | Merged plugin list (from slot prop)            |
| `disabled` | `boolean`           | Whether controls are disabled (from slot prop) |

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

### `useEditorState(api, plugins)`

Composable that returns a reactive `Ref<Map<string, boolean>>` of plugin active states. The `api` argument should be a `Ref<EditorAPI | null>` — use `toRef(props, 'editor')` to create one from a prop. Listens to `selectionchange` and `input` events so toolbar buttons stay in sync with the cursor position. Must be called inside a component's `setup` (requires lifecycle hooks).

## License

MIT
