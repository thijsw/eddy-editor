# Eddy Editor

A lightweight WYSIWYG text editor for Vue 3 and React. AST-based, zero runtime dependencies, fully typed.

[Live demo](https://thijsw.github.io/eddy-editor/)

## Features

- **Works with Vue and React** — framework-agnostic core, thin per-framework wrappers. Pick your import and go.
- **AST document model** -- content is a typed tree, not raw HTML. Schema rules enforce valid structure (e.g. lists cannot nest inside paragraphs).
- **No `execCommand`** -- all formatting uses modern Range/Selection APIs via pure AST transforms. No deprecated browser APIs.
- **Zero runtime dependencies** -- your UI framework is the only peer dependency. <!-- BUNDLE_SIZE -->Vue **36.96 kB** min / **11.64 kB** gzip · React **36.50 kB** min / **11.40 kB** gzip<!-- /BUNDLE_SIZE -->.
- **Two-way binding** -- `v-model` in Vue, `value` + `onChange` in React. Set content programmatically, read it reactively.
- **Plugin system** -- every feature (bold, headings, lists) is a plugin. Add custom plugins, override built-ins, or use only what you need.
- **Full TypeScript API** -- typed commands (`toggleMark`, `setBlockType`, `toggleList`, `setLink`, `removeLink`) and state inspection (`isMarkActive`, `getBlockType`, `getHeadingLevel`, `getLinkHref`).
- **Marks** -- bold, italic, underline, strikethrough, link, inline code.
- **Placeholder** -- pass a `placeholder` prop; the hint appears when the editor is empty and vanishes as soon as the user types.
- **Safe paste** -- content pasted from Word, Google Docs, or other web pages is run through an allowlist sanitizer. Only known tags are kept; classes, inline styles, Office-specific markup, and empty spacer paragraphs are stripped automatically.
- **Undo / Redo** -- built-in history stack with Mod+Z / Mod+Shift+Z.
- **SSR-safe** -- no browser API access at module evaluation time.
- **Themeable** -- all visual properties exposed as CSS custom properties.

## Framework guides

Eddy ships wrappers for Vue and React. Installation and code examples are split per framework:

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

Every feature in Eddy is a plugin. The full set of built-ins is loaded by default, but you can extend the editor with your own plugins or override any built-in by name. Plugins are framework-agnostic — the same plugin file can be consumed by both the Vue and React toolbars.

```ts
import { createPlugin } from 'eddy-editor'

const highlightPlugin = createPlugin({
  name: 'highlight',
  keybinding: 'mod+h',
  toolbar: {
    label: 'H',
    title: 'Highlight (Mod+H)',
  },
  command(api) {
    api.toggleMark('bold') // use any EditorAPI method
  },
  isActive(api) {
    return api.isMarkActive('bold')
  },
})
```

Pass plugins via the `plugins` prop on the editor component. Any plugin whose `name` matches a built-in replaces it; new names are appended. See the framework guides for the exact prop syntax.

### Built-in plugins

All built-in plugins are exported individually from `eddy-editor` so you can build a custom plugin list to control exactly which features are available:

| Plugin        | Export name               | Keybinding |
| ------------- | ------------------------- | ---------- |
| Bold          | `bold`                    | Mod+B      |
| Italic        | `italic`                  | Mod+I      |
| Underline     | `underline`               | Mod+U      |
| Strikethrough | `strikethrough`           |            |
| Inline code   | `code`                    | Mod+E      |
| Link          | `link`                    | Mod+K      |
| Heading 1--6  | `heading1` ... `heading6` |            |
| Bullet list   | `unorderedList`           |            |
| Numbered list | `orderedList`             |            |

The link plugin uses `window.prompt` to collect the URL. When the cursor sits inside an existing link, the prompt is preloaded with the current `href`; an empty submission removes the link. Only `http:`, `https:`, `mailto:`, `tel:`, relative paths, and fragment URLs are accepted -- `javascript:` and other unsafe schemes are rejected on both input and parse.

## EditorAPI

The `api` object passed to plugin `command` and `isActive` callbacks — identical in both frameworks.

### Commands

| Method                       | Description                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `toggleMark(mark)`           | Toggle bold, italic, underline, strikethrough, or inline code                       |
| `setBlockType(type, attrs?)` | Set block to `'paragraph'` or `'heading'` with optional `{ level: 1-6 }`            |
| `toggleList(ordered)`        | Toggle unordered (`false`) or ordered (`true`) list                                 |
| `setLink(href)`              | Apply a link to the selection (or update the link under a collapsed cursor)         |
| `removeLink()`               | Remove the link mark from the selection or the link range under a collapsed cursor  |
| `insertParagraph()`          | Insert a new paragraph (Enter key behaviour)                                        |
| `insertHardBreak()`          | Insert a `<br>` line break (Shift+Enter behaviour)                                  |

### State inspection

| Method               | Returns                                         | Description                                                      |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| `isMarkActive(mark)` | `boolean`                                       | Whether the mark is active at the cursor or across the selection |
| `getBlockType()`     | `'paragraph' \| 'heading' \| 'list' \| 'mixed'` | Block type at the cursor                                         |
| `getHeadingLevel()`  | `1-6 \| null`                                   | Heading level, or `null` if not in a heading                     |
| `getListType()`      | `'ordered' \| 'unordered' \| null`              | List type, or `null` if not in a list                            |
| `getLinkHref()`      | `string \| null`                                | The `href` of the link at the cursor, or `null` if not in a link |

### Properties

| Property    | Type                   | Description                                   |
| ----------- | ---------------------- | --------------------------------------------- |
| `el`        | `HTMLElement \| null`  | The underlying `contenteditable` element      |
| `doc`       | `DocumentNode`         | The current AST document tree                 |
| `selection` | `ASTSelection \| null` | The current cursor/selection as AST positions |

`MarkType` is `'bold' | 'italic' | 'underline' | 'strikethrough' | 'link' | 'code'`. The `link` mark carries an `attrs: { href }` object; other marks have no attributes.

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

The document model types and HTML conversion utilities are exported from the root package (no framework needed) for server-side processing:

```ts
import { parseHTML, serializeToHTML } from 'eddy-editor'
import type { DocumentNode } from 'eddy-editor'

const doc: DocumentNode = parseHTML('<p>Hello <strong>world</strong></p>')
const html: string = serializeToHTML(doc)
```

The full set of AST node types (`DocumentNode`, `BlockNode`, `InlineNode`, `TextNode`, `Mark`, etc.) is exported as TypeScript types.

## Package layout

```
eddy-editor            # framework-agnostic core: types, AST, plugins, createPlugin
eddy-editor/vue        # Vue 3 components + useEditorState composable
eddy-editor/react      # React components + useEditorState hook
eddy-editor/style.css  # default stylesheet
```

Peer dependencies are all optional — only install what you use. For Vue, install `vue` + `@lucide/vue`. For React, install `react`, `react-dom`, and `lucide-react`.

## License

MIT
