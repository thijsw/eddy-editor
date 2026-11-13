# Eddy Editor — Vue 3 guide

## Installation

```bash
npm install eddy-editor
```

`vue` is the only peer dependency.

## Basic usage

```vue
<template>
  <eddy-editor v-model="content" :plugins="defaultPlugins" placeholder="Write something…" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EddyEditor } from 'eddy-editor/vue'
import { defaultPlugins } from 'eddy-editor'
import 'eddy-editor/style.css'

const content = ref('<p>Hello world</p>')
</script>
```

`v-model` is an HTML string: the editor is seeded with it on mount, and every edit emits the canonical HTML (`''` when empty). Setting it to anything other than the last emitted value replaces the content.

`plugins` is the complete list and is read once on mount. Pass `defaultPlugins`, a subset (`[bold, italic, link]`), or add your own (`[...defaultPlugins, highlight]`). Without plugins you still get paragraphs, Enter, Shift+Enter, paste and undo.

## Reaching the editor

The component exposes the `Editor` instance as `editor`:

```vue
<template>
  <eddy-editor ref="eddy" v-model="content" :plugins="defaultPlugins" />
  <button @click="eddy?.editor?.insertBlock('heading', { level: 2 })">Add heading</button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EddyEditor } from 'eddy-editor/vue'

const eddy = ref<InstanceType<typeof EddyEditor>>()
</script>
```

## Custom toolbar

The `#toolbar` slot replaces the default toolbar and receives `{ editor }` (`null` until mounted). Pass an empty `<template #toolbar />` to render none.

`useEditorState(editorRef, select)` returns a ref that recomputes `select(editor)` after every change and selection move:

```vue
<!-- MyToolbar.vue -->
<template>
  <div class="my-toolbar">
    <button :class="{ active: bold }" @mousedown.prevent @click="editor?.toggleMark('bold')">
      B
    </button>
    <button
      :class="{ active: list }"
      @mousedown.prevent
      @click="editor && toggleList(editor, false)"
    >
      •
    </button>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useEditorState } from 'eddy-editor/vue'
import { toggleList, type Editor } from 'eddy-editor'

const props = defineProps<{ editor: Editor | null }>()
const editor = toRef(props, 'editor')
const bold = useEditorState(editor, (ed) => 'bold' in ed.getMarks())
const list = useEditorState(editor, (ed) => ed.getBlock()?.type === 'listItem')
</script>
```

```vue
<eddy-editor v-model="content" :plugins="defaultPlugins">
  <template #toolbar="{ editor }">
    <my-toolbar :editor="editor" />
  </template>
</eddy-editor>
```

`@mousedown.prevent` keeps focus (and the selection) in the editor.

## API

### `<eddy-editor>`

| Prop          | Type       | Default | Description                              |
| ------------- | ---------- | ------- | ---------------------------------------- |
| `modelValue`  | `string`   | `''`    | HTML content (`v-model`)                 |
| `plugins`     | `Plugin[]` | `[]`    | Complete plugin list, read once on mount |
| `disabled`    | `boolean`  | `false` | Disables editing and the toolbar         |
| `placeholder` | `string`   | —       | Shown while the editor is empty          |

| Slot      | Props                        | Description                  |
| --------- | ---------------------------- | ---------------------------- |
| `toolbar` | `{ editor: Editor \| null }` | Replaces the default toolbar |

Exposed: `editor: ShallowRef<Editor | null>`.

### `<eddy-toolbar :editor>`

The default toolbar: every plugin's `toolbar` items, kept in sync with the editor. Use it when you want the default toolbar somewhere else in your layout.

### `useEditorState(editor, select)`

`editor` is a ref to an `Editor | null`; returns `Readonly<Ref<T | undefined>>`.

See the [README](../README.md) for plugins, the editor API, and styling.
