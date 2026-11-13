# Eddy Editor

A tiny, extensible WYSIWYG editor. Framework-agnostic core with thin Vue 3 and React wrappers, a plain-data document model, and plugins that own their features end-to-end.

[Live demo](https://thijsw.github.io/eddy-editor/)

<!-- BUNDLE_SIZE -->core **4.8 kB** · with all plugins + toolbar **6.7 kB** · Vue **7.1 kB** · React **7.0 kB** (min + gzip)<!-- /BUNDLE_SIZE -->

- **Zero dependencies.** Vue or React is the only peer, and only if you use its wrapper. Icons are inline SVG.
- **Plain-data documents.** A document is an array of blocks; a block holds text runs with marks. Commands are pure functions over that data.
- **Plugins own everything.** Bold, links, headings, and lists are plugins contributing parse/render rules, keybindings, and toolbar items. Yours work the same way.
- **Safe by construction.** HTML is parsed inertly against the schema: unknown tags are unwrapped, attributes dropped, `<script>`/`<style>` removed, and link hrefs sanitised.
- **Embeds that don't reload.** Atom blocks (iframes, videos) keep their live DOM element across edits.

## Quick start

```bash
npm install eddy-editor
```

```ts
import { createEditor, mountToolbar, defaultPlugins } from 'eddy-editor'
import 'eddy-editor/style.css'

const editor = createEditor(document.querySelector('#editor')!, {
  plugins: defaultPlugins,
  content: '<p>Hello <strong>world</strong></p>',
  onChange: (html) => console.log(html),
})
mountToolbar(document.querySelector('#toolbar')!, editor)
```

Vue and React: see [docs/vue.md](docs/vue.md) and [docs/react.md](docs/react.md). Nuxt 3/4: add `modules: ['eddy-editor/nuxt']` ([details](docs/vue.md#nuxt)).

```vue
<eddy-editor v-model="html" :plugins="defaultPlugins" />
```

```tsx
<EddyEditor value={html} onChange={setHtml} plugins={defaultPlugins} />
```

Plugins and types always come from `eddy-editor`; only the components come from `eddy-editor/vue` or `eddy-editor/react`.

## Keyboard shortcuts

| Shortcut                   | Action                                         |
| -------------------------- | ---------------------------------------------- |
| Mod+B / Mod+I / Mod+U      | Bold / italic / underline                      |
| Mod+E                      | Inline code                                    |
| Mod+K                      | Add, edit or remove a link                     |
| Mod+Z / Mod+Shift+Z, Mod+Y | Undo / redo                                    |
| Enter                      | New block (continues lists; exits empty items) |
| Shift+Enter                | Line break                                     |

"Mod" is Cmd or Ctrl.

## Document model

```ts
type Doc = Block[]
interface Block {
  id: string
  type: string
  attrs: Attrs
  children: TextNode[]
}
interface TextNode {
  text: string
  marks: Record<string, Attrs>
} // '\n' is a line break
interface Pos {
  block: string
  offset: number
} // character offset within the block
interface Selection {
  anchor: Pos
  head: Pos
}
```

Lists are flat: each `listItem` block carries `{ ordered, indent }` and consecutive items are grouped into `<ul>`/`<ol>` when serialised.

## Plugins

A plugin is a plain object. Every field is optional.

```ts
interface Plugin {
  marks?: Record<string, MarkSpec>
  blocks?: Record<string, BlockSpec>
  keys?: Record<string, KeyHandler> // 'mod+shift+h' → (editor, event) => boolean | void
  toolbar?: ToolbarItem[]
  normalize?(doc: Doc): Doc // runs after every change
  setup?(editor: Editor): (() => void) | void // return a cleanup
}
```

Later plugins override earlier ones: a spec with the same type replaces the earlier spec but keeps its position (which fixes mark nesting order), and a later key handler runs first. A key handler that returns `false` passes the key on to earlier handlers, then to the browser.

### A mark: highlight

```ts
import type { Plugin } from 'eddy-editor'

export const highlight: Plugin = {
  marks: {
    highlight: { match: 'mark', render: 'mark', excludes: ['code'] },
  },
  keys: { 'mod+shift+h': (ed) => ed.toggleMark('highlight') },
  toolbar: [
    {
      title: 'Highlight',
      label: 'H',
      run: (ed) => ed.toggleMark('highlight'),
      active: (ed) => 'highlight' in ed.getMarks(),
    },
  ],
}
```

### A block: blockquote

```ts
export const blockquote: Plugin = {
  blocks: { blockquote: { match: 'blockquote', render: 'blockquote' } },
  toolbar: [
    {
      title: 'Quote',
      label: '❝',
      run: (ed) => ed.setBlock('blockquote'), // calling it again reverts to a paragraph
      active: (ed) => ed.getBlock()?.type === 'blockquote',
    },
  ],
}
```

### Specs

```ts
interface MarkSpec {
  match: string // CSS selector: 'strong,b', 'span.highlight', 'a[href]'
  attrs?(el: Element): Attrs | false | void // false rejects the match
  render: DOMSpec | ((attrs: Attrs) => DOMSpec)
  excludes?: string[] // marks removed when this one is applied
}

interface BlockSpec {
  match: string
  attrs?(el: Element, root: Node): Attrs | false | void
  render: DOMSpec | ((block: Block) => DOMSpec)
  atom?: boolean // leaf block rendered entirely by `render` (embeds, dividers)
  continues?: boolean // Enter continues this type; Enter on an empty one exits
  group?(block: Block): [tag: string, depth: number] // wrap runs, e.g. ['ul', 0]
}

// 'p' | ['a', { href }] | ['pre', ['code', 0]]  (0 marks where content goes)
type DOMSpec = string | [tag, attrs?, ...children]
```

Block selectors are tried from the last plugin to the first, so a specific `div.callout` wins over the built-in paragraph's `p,div`.

### An atom block: embed

Atom blocks have no editable text. Their element is reused across edits, so an iframe never reloads.

```ts
import { sanitizeHref, type Plugin } from 'eddy-editor'

export const video: Plugin = {
  blocks: {
    video: {
      match: 'iframe[data-video]',
      atom: true,
      attrs: (el) => {
        const src = sanitizeHref(el.getAttribute('src'))
        return src ? { src } : false
      },
      render: (b) => ['iframe', { src: b.attrs.src, 'data-video': '', contenteditable: 'false' }],
    },
  },
}

editor.insertBlock('video', { src: 'https://www.youtube.com/embed/…' })
```

Backspace at the start of the following block, or Delete at the end of the preceding one, removes the atom.

### Transforms

For anything beyond the built-in commands, `editor.apply` runs a pure transform. History, normalisation, rendering and change events are handled for you.

```ts
import { markRange, range } from 'eddy-editor'

// Uppercase the selected blocks
editor.apply((doc, sel) => {
  const [, , from, to] = range(doc, sel)
  return [
    doc.map((b, i) =>
      i < from || i > to
        ? b
        : { ...b, children: b.children.map((t) => ({ ...t, text: t.text.toUpperCase() })) },
    ),
  ]
})
```

Return `[doc]` to keep the selection, `[doc, selection]` to move it, or nothing to cancel. Helpers: `slice`, `markRange`, `marksAt`, `range`, `indexOf`, `caret`, `isCollapsed`, `createBlock`, `textLength`, `eq`.

### Built-in plugins

| Export          | Contributes                                                  | Keys  |
| --------------- | ------------------------------------------------------------ | ----- |
| `bold`          | mark `bold` (`<strong>`, `<b>`)                              | Mod+B |
| `italic`        | mark `italic` (`<em>`, `<i>`)                                | Mod+I |
| `underline`     | mark `underline` (`<u>`)                                     | Mod+U |
| `strikethrough` | mark `strikethrough` (`<s>`, `<strike>`, `<del>`)            |       |
| `code`          | mark `code` (`<code>`)                                       | Mod+E |
| `link`          | mark `link` (`<a href>`, sanitised); `setLink`, `promptLink` | Mod+K |
| `heading`       | block `heading` (`<h1>`–`<h6>`) and a block-type select      |       |
| `list`          | block `listItem` grouped as `<ul>`/`<ol>`; `toggleList`      |       |

`defaultPlugins` is all of them. Enter, Shift+Enter, undo/redo, paste and atom deletion are built into the editor, not plugins; override any of them with a later `keys` entry.

## Editor API

| Member                                  | Description                                                          |
| --------------------------------------- | -------------------------------------------------------------------- |
| `el`, `schema`, `plugins`               | The editable element, the compiled schema, the plugin list           |
| `doc`, `selection`                      | Current document and last known selection                            |
| `editable`                              | Get/set whether the editor accepts input                             |
| `apply(transform)`                      | Run a transform (see above)                                          |
| `toggleMark(type, attrs?)`              | Toggle a mark over the selection                                     |
| `setBlock(type, attrs?)`                | Set the block type; blocks already of that type become paragraphs    |
| `insertBlock(type, attrs?)`             | Insert a block after the cursor (replaces an empty paragraph)        |
| `insertHTML(html)` / `insertText(text)` | Insert parsed HTML or plain text at the cursor                       |
| `getMarks()` / `getBlock()`             | Marks active at the selection / block at the cursor                  |
| `getHTML()` / `setHTML(html)`           | Read the canonical HTML (`''` when empty) / replace the content      |
| `isEmpty()`                             | True for a single empty paragraph                                    |
| `undo()` / `redo()` / `commit()`        | History; `commit` closes the current typing group                    |
| `subscribe(fn)`                         | Called after every document or selection change; returns unsubscribe |
| `destroy()`                             | Remove listeners and run plugin cleanups                             |

## HTML without an editor

```ts
import { createSchema, parse, serialize, defaultPlugins } from 'eddy-editor'

const schema = createSchema(defaultPlugins)
const doc = parse('<p>Hello <b>world</b></p>', schema) // needs a DOM (browser, jsdom, happy-dom)
serialize(doc, schema) // '<p>Hello <strong>world</strong></p>', runs anywhere
```

## Styling

```ts
import 'eddy-editor/style.css'
```

Override the CSS custom properties, or skip the stylesheet and style `.eddy-wrapper`, `.eddy-toolbar`, `.eddy-toolbar-btn`, `.eddy-toolbar-select` and `.eddy-editor` yourself.

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

## Migrating from 0.x

| 0.x                                                       | 1.0                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `new Editor(el, emit, plugins)` + `loadHTML`              | `createEditor(el, { plugins, content, onChange })`                      |
| `core`, `safePaste` plugins                               | Built in                                                                |
| `defaultPlugins` from `eddy-editor/vue` / `/react`        | From `eddy-editor`; icons are built in, lucide is no longer needed      |
| `name`, `commands`, `keybindings`, `editor.run(name)`     | `keys: { 'mod+b': (ed) => … }`; call functions (`toggleList(ed, true)`) |
| `marks: [{ type, parseDOM, toDOM }]`                      | `marks: { type: { match, attrs, render } }`                             |
| `ParseRule.getAttrs`, `AttrSpec`                          | `attrs(el)`, returning `false` to reject                                |
| `BlockGroupSpec`                                          | `group(block) => [tag, depth]`; ancestry via `attrs(el, root)`          |
| `ToolbarItem { command, args, isActive }`                 | `{ run(ed), active?(ed) }`, or a select `{ options, value, run }`       |
| `DocumentNode { blocks }`, `hardBreak` nodes              | `Block[]`; `'\n'` inside text                                           |
| `Mark[]` on text                                          | `marks: { bold: {}, link: { href } }`                                   |
| `ASTPosition { blockId, inlineIndex, offset }`            | `Pos { block, offset }`, offset counts characters in the block          |
| `tr.apply(fn)` returning `{ doc, selection }`             | `apply(fn)` returning `[doc, selection?]`                               |
| `setBlockType`, `isMarkActive`, `getMarkAt`, `getBlockAt` | `setBlock`, `type in getMarks()`, `getMarks()[type]`, `getBlock`        |
| `on('change' \| 'selectionchange' \| …)`                  | `subscribe(fn)`; `onChange` option; DOM events on `editor.el`           |
| `pushHistory()`                                           | `commit()`                                                              |
| `parseHTML(html)`, `serializeToHTML(doc)`                 | `parse(html, schema)`, `serialize(doc, schema)`                         |
| `useEditorState(api, items)` → `Map`                      | `useEditorState(editor, (ed) => value)`                                 |
| `.eddy-editor.is-disabled`                                | `.eddy-editor[contenteditable='false']`                                 |
| Empty editor emits `<p><br></p>`                          | Empty editor emits `''`                                                 |

## License

MIT. Toolbar icons are from [Lucide](https://lucide.dev) (ISC).
