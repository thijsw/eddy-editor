# Eddy Editor

A lightweight WYSIWYG text editor for Vue 3 and React. AST-based, zero runtime dependencies, fully typed, and genuinely extensible through a plugin system where plugins own their features end-to-end.

[Live demo](https://thijsw.github.io/eddy-editor/)

## Features

- **Works with Vue and React** — framework-agnostic core, thin per-framework wrappers. Pick your import and go.
- **AST document model** — content is a typed tree, not raw HTML. Pure functional commands transform it; a schema rule pass normalises after every mutation.
- **Plugin-driven schema** — bold, italic, headings, lists, links, paragraphs — every node and mark type comes from a plugin contributing a `MarkSpec` or `BlockSpec`. Add a new block or mark in one plugin file, no core edits.
- **Zero runtime dependencies** — your UI framework is the only peer dependency. <!-- BUNDLE_SIZE -->Vue **43.65 kB** min / **12.90 kB** gzip · React **42.83 kB** min / **12.55 kB** gzip<!-- /BUNDLE_SIZE -->.
- **Two-way binding** — `v-model` in Vue, `value` + `onChange` in React.
- **Plugin lifecycle** — declarative schema + commands + keybindings + toolbar, plus an imperative `setup(ctx)` hook for event subscriptions, custom behaviour, or plugins that need to own their state.
- **Event bus** — subscribe to `change`, `selectionchange`, `keydown`, `paste`, `destroy` on any `EditorAPI`.
- **Transactions** — `editor.tr.apply(fn)` runs a pure `(doc, sel) => {doc, sel}` command with history, schema, and render wired up.
- **Safe paste** — content from Word/Google Docs runs through an allowlist sanitizer.
- **Undo/Redo** — built-in history stack with Mod+Z / Mod+Shift+Z.
- **SSR-safe** — no browser API access at module evaluation time.
- **Themeable** — all visual properties exposed as CSS custom properties.

## Framework guides

- **Vue 3** — [docs/vue.md](docs/vue.md)
- **React 18 / 19** — [docs/react.md](docs/react.md)

## Keyboard shortcuts

| Shortcut    | Action                                    |
| ----------- | ----------------------------------------- |
| Mod+B       | Bold                                      |
| Mod+I       | Italic                                    |
| Mod+U       | Underline                                 |
| Mod+E       | Inline code                               |
| Mod+K       | Add / edit / remove link                  |
| Mod+Z       | Undo                                      |
| Mod+Shift+Z | Redo                                      |
| Enter       | New paragraph (exits headings into `<p>`) |
| Shift+Enter | Line break (`<br>`)                       |

"Mod" means Cmd on macOS, Ctrl on Windows/Linux.

## Plugin system

Every feature in Eddy is a plugin, including the built-ins. A plugin can contribute any of:

- **Marks** (`marks: MarkSpec[]`) — inline formatting types with their HTML parse and serialise rules.
- **Blocks** (`blocks: BlockSpec[]`) — block node types (paragraphs, headings, list items, blockquotes, …) with optional grouping rules for list-like wrappers.
- **Commands** (`commands: Record<string, CommandFn>`) — named operations dispatched via `editor.run(name, ...args)`.
- **Keybindings** (`keybindings: Record<string, string>`) — keybinding string → command name; the built-in dispatcher calls `preventDefault` on matches.
- **Toolbar items** (`toolbar: ToolbarItem[]`) — buttons rendered by the default `<EddyToolbar>`. Each item references a command; optional `args` are spread into `editor.run`.
- **Schema rules** (`schemaRules: SchemaRule[]`) — normalisation passes run after every mutation, in addition to the built-in rules.
- **Setup hook** (`setup(ctx): () => void`) — runs once on editor construction. Returns an optional cleanup called on destroy. Use it for event listeners, dynamic command registration, or custom behaviour.

### Minimal example — a highlight mark

```ts
import type { EddyPlugin } from 'eddy-editor'

export const highlight: EddyPlugin = {
  name: 'highlight',
  marks: [
    {
      type: 'highlight',
      parseDOM: [{ tag: 'mark' }],
      toDOM: () => ['mark'],
      excludes: ['code'], // optional: can't coexist with inline code
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
      title: 'Highlight',
      isActive: (api) => api.isMarkActive('highlight'),
    },
  ],
}
```

Drop `highlight` into the `plugins` prop and it parses `<mark>`, serialises `<mark>`, toggles on Mod+Shift+H, shows an active-state toolbar button, and strips inline-code marks from the range when applied.

### Example — a blockquote block

```ts
import type { EddyPlugin } from 'eddy-editor'

export const blockquote: EddyPlugin = {
  name: 'blockquote',
  blocks: [
    {
      type: 'blockquote',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: () => ['blockquote'],
    },
  ],
  commands: {
    'blockquote.toggle': (api) => api.setBlockType('blockquote'),
  },
  toolbar: [
    {
      command: 'blockquote.toggle',
      label: '❝',
      title: 'Blockquote',
      isActive: (api) => api.getBlockAt()?.type === 'blockquote',
    },
  ],
}
```

`api.setBlockType('blockquote')` does per-block toggle semantics — calling it a second time reverts to paragraph.

### Composing plugins

The `plugins` prop on `<EddyEditor>` is the **complete** list — no auto-merging with `defaultPlugins`. Either import `defaultPlugins` wholesale or hand-pick exactly what you need; unused plugins are tree-shaken out of your bundle.

```ts
// all built-ins (with Lucide icons baked in), plus a custom plugin
import { defaultPlugins } from 'eddy-editor/vue' // or '/react'
const plugins = [...defaultPlugins, highlight]
// or a hand-picked subset — unused plugins and their icons tree-shake out
import { core, bold, italic, heading } from 'eddy-editor/vue'
const minimal = [core, bold, italic, heading]
```

Within the schema, `MarkSpec`/`BlockSpec` dedup by `type` on a last-wins basis (first position is preserved for canonical ordering). Commands and keybindings also last-win. So replacing a built-in is just a matter of placing your override later in the array.

### Built-in plugins

| Plugin        | Export          | Schema contribution                             | Commands                                         | Keybinding         |
| ------------- | --------------- | ----------------------------------------------- | ------------------------------------------------ | ------------------ |
| Core          | `core`          | —                                               | `core.insertParagraph`, `core.undo`, `core.redo` | Mod+Z, Mod+Shift+Z |
| Safe paste    | `safePaste`     | —                                               | —                                                |                    |
| Bold          | `bold`          | mark `bold` (`<strong>`, `<b>`)                 | `bold.toggle`                                    | Mod+B              |
| Italic        | `italic`        | mark `italic` (`<em>`, `<i>`)                   | `italic.toggle`                                  | Mod+I              |
| Underline     | `underline`     | mark `underline` (`<u>`)                        | `underline.toggle`                               | Mod+U              |
| Strikethrough | `strikethrough` | mark `strikethrough` (`<s>`,`<strike>`,`<del>`) | `strikethrough.toggle`                           |                    |
| Code          | `code`          | mark `code` (`<code>`)                          | `code.toggle`                                    | Mod+E              |
| Link          | `link`          | mark `link` (`<a href>` — sanitised)            | `link.set(href)`, `link.remove`, `link.prompt`   | Mod+K              |
| Heading       | `heading`       | block `heading` (`<h1>`–`<h6>`)                 | `heading.set(level)`                             |                    |
| List          | `list`          | block `listItem` grouped as `<ul>`/`<ol>`       | `list.toggleUnordered`, `list.toggleOrdered`     |                    |

The `link` plugin is the reference for a non-trivial plugin — it owns URL sanitisation (`sanitizeHref` lives in `src/plugins/links.ts`, not the core), a `link.prompt` UX command, and range-expanding semantics for collapsed cursors inside an existing link.

`paragraph` is a Schema invariant — it's always present regardless of whether `core` is installed, so even the most stripped-down plugin set can still parse and serialise.

`safePaste` is opt-in — it pre-processes pasted HTML from Word, Google Docs, and other noisy sources (stripping `<p>&nbsp;</p>` spacers, MS conditional comments, `<o:p>` namespaced tags). The schema parser still sanitises attributes when it's omitted, so dropping it only affects how tidy Office pastes look — roughly 1.3 kB min / 0.5 kB gzip savings. The framework-decorated `defaultPlugins` includes it.

### Import paths and icons

The per-framework entry points (`eddy-editor/vue`, `eddy-editor/react`) ship **decorated** versions of the plugin exports whose toolbar items carry Lucide icons (`@lucide/vue` or `lucide-react` respectively). Import plugins from the framework subpath to get icons in the default toolbar:

```ts
import { EddyEditor, defaultPlugins, bold, italic } from 'eddy-editor/vue'
//                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ — plugins with icons
```

Import from the root `eddy-editor` for the undecorated plugins (no icons — toolbar buttons show the letter labels). Unused plugins (and their icons) tree-shake out of the consumer bundle either way.

## `EditorAPI`

The `api` passed to commands, toolbar `isActive`, and available as `ctx.editor` in `setup`. Identical in both frameworks.

### Properties

| Property    | Type                   | Description                                   |
| ----------- | ---------------------- | --------------------------------------------- |
| `el`        | `HTMLElement`          | The underlying `contenteditable` element      |
| `doc`       | `DocumentNode`         | The current AST document tree                 |
| `selection` | `ASTSelection \| null` | The current cursor/selection as AST positions |
| `schema`    | `Schema`               | The schema built from the editor's plugins    |
| `tr`        | `TransactionAPI`       | Low-level transaction entry point             |

### Mutation primitives

| Method                       | Description                                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| `toggleMark(type, attrs?)`   | Toggle a mark. Uses `MarkSpec.excludes` to strip conflicting marks.      |
| `setBlockType(type, attrs?)` | Set block type with per-block toggle semantics (list items are skipped). |
| `insertHTML(html)`           | Parse HTML with the editor's schema, then insert at the cursor.          |

For lower-level operations — inserting a `DocumentNode` directly, deleting the current selection, or any custom AST transform — use `api.tr.apply(fn)` (see Transactions below).

### Inspection

| Method               | Returns             | Description                                           |
| -------------------- | ------------------- | ----------------------------------------------------- |
| `isMarkActive(type)` | `boolean`           | Whether the mark is active at the cursor or selection |
| `getMarkAt(type)`    | `Mark \| null`      | Mark of that type at the cursor (with attrs, if any)  |
| `getBlockAt()`       | `BlockNode \| null` | Block at the cursor (type, attrs, children)           |

### Command dispatch & events

| Method               | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `run(name, ...args)` | Dispatch a registered command. Warns on unknown names.         |
| `on(event, handler)` | Subscribe to an editor event. Returns an unsubscribe function. |
| `undo()` / `redo()`  | Walk the history stack.                                        |
| `pushHistory()`      | Flush debounced typing state (use before native browser ops).  |

Events: `change` (canonical HTML), `selectionchange` (AST selection), `keydown`, `paste`, `destroy`.

### Transactions

```ts
api.tr.apply((doc, sel) => {
  // return { doc, selection } — history, schema, and render are automatic
  return someCommand(doc, sel)
})
```

Use when a plugin needs logic that doesn't fit `toggleMark` / `setBlockType` — e.g. the built-in `link` plugin expands a collapsed cursor inside a link to the full link range before applying. Every existing command is built on top of this.

## Styling

```ts
import 'eddy-editor/style.css'
```

Override via CSS custom properties:

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

Or skip the stylesheet and style `.eddy-wrapper`, `.eddy-toolbar`, `.eddy-toolbar-btn`, `.eddy-toolbar-select`, and `.eddy-editor` yourself.

## AST utilities

```ts
import { parseHTML, serializeToHTML } from 'eddy-editor'
import type { DocumentNode } from 'eddy-editor'

const doc: DocumentNode = parseHTML('<p>Hello <strong>world</strong></p>')
const html: string = serializeToHTML(doc)
```

Both helpers take an optional `Schema` as the second argument; omitted, they use the schema built from `defaultPlugins`. For custom schemas:

```ts
import { Schema } from 'eddy-editor'
const schema = new Schema(
  [
    /* marks */
  ],
  [
    /* blocks */
  ],
)
```

## Package layout

```
eddy-editor            # framework-agnostic core: Editor, plugins, AST, Schema, types
eddy-editor/vue        # Vue 3 components + useEditorState composable
eddy-editor/react      # React components + useEditorState hook
eddy-editor/style.css  # default stylesheet
```

## License

MIT
