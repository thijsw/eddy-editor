# Eddy

A lightweight WYSIWYG text editor for Vue 3. Small bundle, no dependencies, SSR-safe, and built to be extended through a plugin system.

## Features

- **Inline formatting** — bold, italic, underline, strikethrough
- **Headings** — H1 through H6, with toolbar toggle
- **Lists** — unordered and ordered
- **Line breaks** — Shift+Enter inserts `<br>` without starting a new block
- **Keyboard shortcuts** — Mod+B/I/U and custom bindings via plugins
- **Plugin system** — add features or override built-ins with your own plugins
- **HTML output** — `v-model` binds to an HTML string
- **Optional toolbar** — drop in `<eddy-toolbar />` or build your own
- **Themeable** — CSS custom properties for every visual detail
- **SSR-safe** — no browser APIs touched at module load time
- **TypeScript** — fully typed, including the plugin API

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

## Editor without the built-in toolbar

`<eddy-toolbar />` is optional. You can use the scoped slot to build your own toolbar using the exposed `EditorAPI`, or omit the slot entirely for a bare editor.

```vue
<template>
  <eddy-editor v-model="content">
    <template #toolbar="{ editor }">
      <button @mousedown.prevent="editor?.execute('bold')">Bold</button>
    </template>
  </eddy-editor>
</template>
```

`@mousedown.prevent` is important — it stops the click from blurring the editor and collapsing the selection before the command runs.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Mod+B | Bold |
| Mod+I | Italic |
| Mod+U | Underline |
| Shift+Enter | Line break (`<br>`) |

"Mod" means Cmd on macOS, Ctrl on Windows/Linux.

## Styling

Import the default stylesheet to get a ready-to-use appearance:

```ts
import 'eddy-editor/style.css'
```

Override any aspect via CSS custom properties on `:root` or a parent element:

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

## Plugin system

Every feature in Eddy is a plugin. The full set of built-ins is loaded by default, but you can extend the editor with your own plugins or override any built-in by name.

### Writing a plugin

```ts
import { createPlugin } from 'eddy-editor'

const highlightPlugin = createPlugin({
  name: 'highlight',               // unique — used for deduplication and active state
  keybinding: 'mod+h',             // optional keyboard shortcut
  toolbar: {                       // optional — omit to hide from toolbar
    label: 'HL',
    title: 'Highlight (Mod+H)',
  },
  command(api) {
    api.execute('hiliteColor', 'yellow')
  },
  isActive(api) {
    return api.getCommandValue('hiliteColor') === 'yellow'
  },
})
```

### Using a custom plugin

Pass plugins via the `plugins` prop. Any plugin whose `name` matches a built-in replaces it; new names are appended.

```vue
<template>
  <eddy-editor v-model="content" :plugins="[highlightPlugin]">
    <template #toolbar>
      <eddy-toolbar />
    </template>
  </eddy-editor>
</template>
```

### `EditorAPI`

The `api` argument passed to `command` and `isActive`:

| Method | Description |
|---|---|
| `execute(command, value?)` | Runs a `document.execCommand` command |
| `isCommandActive(command)` | Returns `true` if the command is active at the cursor |
| `getCommandValue(command)` | Returns the string value of a command at the cursor |
| `el` | The underlying `contenteditable` element |

### Using built-in plugins individually

All built-in plugins are exported individually for custom toolbar compositions or to build a trimmed-down plugin list:

```ts
import { bold, italic, heading1, heading2, unorderedList } from 'eddy-editor'

// Only use a subset of built-ins
const plugins = [bold, italic, heading1, heading2, unorderedList]
```

```vue
<eddy-editor v-model="content" :plugins="plugins">
```

## API reference

### `<eddy-editor>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `modelValue` | `string` | — | HTML content (use with `v-model`) |
| `plugins` | `EddyPlugin[]` | `[]` | Additional or replacement plugins |

| Slot | Slot props | Description |
|---|---|---|
| `toolbar` | `{ editor: EditorAPI \| null }` | Rendered above the editing area |

### `<eddy-toolbar>`

No props. Must be placed inside the `#toolbar` slot of `<eddy-editor>` — it uses Vue's `inject` to receive the editor context.

### `createPlugin(config)`

Type-safe factory for authoring plugins. Returns the config unchanged; the value is in TypeScript inference.

### `EddyPlugin`

```ts
interface EddyPlugin {
  name: string
  keybinding?: string
  toolbar?: { label: string; title: string }
  command(api: EditorAPI): void
  isActive?(api: EditorAPI): boolean
}
```
