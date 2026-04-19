# Eddy Editor — Vue 3 guide

## Installation

```bash
pnpm add eddy-editor vue @lucide/vue
# or
npm install eddy-editor vue @lucide/vue
```

`vue` and `@lucide/vue` are peer dependencies. `@lucide/vue` is only required when you render the built-in toolbar. If you build a fully custom toolbar, you can skip it.

## Basic usage

```vue
<template>
  <eddy-editor v-model="content" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EddyEditor } from 'eddy-editor/vue'
import 'eddy-editor/style.css'

const content = ref('<p>Hello world</p>')
</script>
```

The `v-model` value is an HTML string. On first render the editor is seeded with that string; every edit emits an updated HTML string back.

The default toolbar (bold, italic, underline, strikethrough, link, headings, lists) renders automatically. All built-in plugins are included unless you override them via the `plugins` prop.

## Custom toolbar

The default toolbar renders automatically. Provide the `#toolbar` slot to replace it with your own.

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

`@mousedown.prevent` is important — it stops the click from blurring the editor before the command runs.

This works for simple cases, but the slot prop is not reactive to selection changes — button active states won't update as the cursor moves.

To render no toolbar at all, pass an empty template:

```vue
<eddy-editor v-model="content">
  <template #toolbar />
</eddy-editor>
```

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
import { useEditorState, type EditorAPI, type EddyPlugin } from 'eddy-editor/vue'

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

```vue
<eddy-editor v-model="content" :plugins="[codePlugin]" />
```

## Using built-in plugins individually

All built-in plugins are exported individually from `eddy-editor`. Build a custom plugin list to control exactly which features are available:

```ts
import { bold, italic, heading1, heading2, unorderedList } from 'eddy-editor'

const plugins = [bold, italic, heading1, heading2, unorderedList]
```

```vue
<eddy-editor v-model="content" :plugins="plugins" />
```

## API reference

### `<eddy-editor>` props

| Prop          | Type           | Default | Description                                                           |
| ------------- | -------------- | ------- | --------------------------------------------------------------------- |
| `modelValue`  | `string`       | --      | HTML content (use with `v-model`)                                     |
| `plugins`     | `EddyPlugin[]` | `[]`    | Additional or replacement plugins                                     |
| `disabled`    | `boolean`      | `false` | Disables editing and toolbar controls                                 |
| `placeholder` | `string`       | `''`    | Hint shown when the editor is empty. Hidden as soon as the user types |

| Slot      | Slot props                                                                | Description                                                                                  |
| --------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `toolbar` | `{ editor: EditorAPI \| null, plugins: EddyPlugin[], disabled: boolean }` | Rendered above the editing area. Falls back to the built-in `<eddy-toolbar>` when not given. |

### `<eddy-toolbar>` props

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
  toolbar?: { label: string; title: string; icon?: unknown }
  command(api: EditorAPI): void
  isActive?(api: EditorAPI): boolean
}
```

The `icon` field accepts a Vue `Component` in this wrapper (the default toolbar renders it via `<component :is="icon" :size="16" />`).

### `createPlugin(config)`

Type-safe factory for authoring plugins. Returns the config unchanged; the value is in TypeScript inference.

### `useEditorState(api, plugins)`

Composable that returns a reactive `Ref<Map<string, boolean>>` of plugin active states. The `api` argument should be a `Ref<EditorAPI | null>` — use `toRef(props, 'editor')` to create one from a prop. Listens to `selectionchange` and `input` events so toolbar buttons stay in sync with the cursor position. Must be called inside a component's `setup` (requires lifecycle hooks).

See the [main README](../README.md) for the full `EditorAPI` surface, keyboard shortcuts, styling, and AST utilities.
