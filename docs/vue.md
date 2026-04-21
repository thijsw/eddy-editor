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
  <eddy-editor v-model="content" :plugins="defaultPlugins" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EddyEditor, defaultPlugins } from 'eddy-editor/vue'
import 'eddy-editor/style.css'

const content = ref('<p>Hello world</p>')
</script>
```

The `v-model` value is an HTML string. On first render the editor is seeded with that string; every edit emits an updated HTML string back.

The `plugins` prop is the **complete** plugin list — the wrapper does no auto-merging with `defaultPlugins`. Import and pass whichever subset you need. If you pass no plugins (or omit the prop), you get a minimally functional editor with the paragraph schema invariant but no formatting, Enter handling, paste handling, or undo/redo.

**Import paths.** `EddyEditor`, `EddyToolbar`, `useEditorState`, and the decorated `defaultPlugins` (and individual plugin exports) come from `eddy-editor/vue`. Framework-specific Lucide icons are baked into those plugin toolbar items at this layer so unused plugins and their icons tree-shake out. Import plugins from the root `eddy-editor` if you want the undecorated versions (no icons — just labels).

## Custom toolbar

The default toolbar renders automatically. Provide the `#toolbar` slot to replace it with your own.

### Inline via scoped slot

The `#toolbar` slot exposes the `EditorAPI` directly:

```vue
<template>
  <eddy-editor v-model="content">
    <template #toolbar="{ editor }">
      <button @mousedown.prevent="editor?.run('bold.toggle')">Bold</button>
      <button @mousedown.prevent="editor?.run('italic.toggle')">Italic</button>
    </template>
  </eddy-editor>
</template>
```

`@mousedown.prevent` is important — it stops the click from blurring the editor before the command runs.

This works for simple cases, but the slot prop is not reactive to selection changes — button active states won't update as the cursor moves. Use `useEditorState` (below).

To render no toolbar at all, pass an empty template:

```vue
<eddy-editor v-model="content">
  <template #toolbar />
</eddy-editor>
```

### Custom toolbar component with reactive state

For a toolbar that reflects the current formatting at the cursor, create a component that uses the `useEditorState` composable:

```vue
<!-- MyToolbar.vue -->
<template>
  <div class="my-toolbar">
    <button
      v-for="item in items"
      :key="item.key"
      :class="{ active: states.get(item.key) }"
      :aria-pressed="states.get(item.key) ?? false"
      @mousedown.prevent="editor?.run(item.command)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useEditorState, type EditorAPI, type EddyPlugin } from 'eddy-editor/vue'

const props = defineProps<{
  editor: EditorAPI | null
  plugins: EddyPlugin[]
  disabled: boolean
}>()

// Flatten each plugin's toolbar contributions into `items`.
const items = computed(() =>
  props.plugins.flatMap((p, pi) =>
    (p.toolbar ?? []).map((t, ti) => ({
      key: `${p.name}:${pi}:${ti}`,
      command: t.command,
      label: t.label,
      isActive: t.isActive,
    })),
  ),
)

// Reactive Map<string, boolean> keyed by item.key — updates on selectionchange and change events.
const states = useEditorState(toRef(props, 'editor'), items)
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

```vue
<eddy-editor v-model="content" :plugins="[...defaultPlugins, highlight]" />
```

See the [main README](../README.md#plugin-system) for the full plugin surface (blocks, `setup(ctx)`, transactions, schema rules).

## Using built-in plugins individually

All built-in plugins are exported individually from `eddy-editor`. Build an explicit plugin list to control exactly which features are available — and which chunks land in your bundle:

```ts
import { core, bold, italic, heading, list } from 'eddy-editor'

const plugins = [core, bold, italic, heading, list]
```

```vue
<eddy-editor v-model="content" :plugins="plugins" />
```

Tree-shaking works as expected: the plugins you don't import aren't in your bundle. Omitting `core` loses Enter / Shift+Enter / paste / Mod+Z handling but the `paragraph` schema invariant stays — parsing and serialising still work.

## API reference

### `<eddy-editor>` props

| Prop          | Type           | Default | Description                                                              |
| ------------- | -------------- | ------- | ------------------------------------------------------------------------ |
| `modelValue`  | `string`       | —       | HTML content (use with `v-model`)                                        |
| `plugins`     | `EddyPlugin[]` | `[]`    | Complete plugin list. No auto-merge — pass `defaultPlugins` for defaults |
| `disabled`    | `boolean`      | `false` | Disables editing and toolbar controls                                    |
| `placeholder` | `string`       | `''`    | Hint shown when the editor is empty. Hidden as soon as the user types    |

| Slot      | Slot props                                                                | Description                                                                               |
| --------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `toolbar` | `{ editor: EditorAPI \| null, plugins: EddyPlugin[], disabled: boolean }` | Rendered above the editing area. Falls back to the built-in `<eddy-toolbar>` when absent. |

### `<eddy-toolbar>` props

| Prop       | Type                | Description                                    |
| ---------- | ------------------- | ---------------------------------------------- |
| `editor`   | `EditorAPI \| null` | The editor API instance (from slot prop)       |
| `plugins`  | `EddyPlugin[]`      | Merged plugin list (from slot prop)            |
| `disabled` | `boolean`           | Whether controls are disabled (from slot prop) |

The default toolbar has one built-in element: a heading-level `<select>` (Normal / H1–H6). Headings are near-universal and a dropdown is better UX than six buttons. Every other control comes from plugin-contributed `ToolbarItem`s. If you want zero built-in UI, supply your own `#toolbar` slot.

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
  icon?: unknown // Vue `Component` in this wrapper
  isActive?(api: EditorAPI): boolean
}
```

Full schema details (`MarkSpec`, `BlockSpec`, `PluginContext`, `TransactionAPI`) are in the [root README](../README.md#plugin-system) and the exported TypeScript types.

### `useEditorState(api, items)`

Composable that returns a reactive `Ref<Map<string, boolean>>` of active states keyed by each item's `key`.

- `api: Ref<EditorAPI | null>` — editor ref. Use `toRef(props, 'editor')` from a slot prop.
- `items: Ref<{ key: string; isActive?: (api: EditorAPI) => boolean }[]>` — the items to track. Toolbar items' plugin/command identity make a good key.

Internally subscribes to `editor.on('selectionchange')` and `editor.on('change')`. Cleans up on unmount.

See the [main README](../README.md) for the full `EditorAPI` surface, keyboard shortcuts, styling, and AST utilities.
