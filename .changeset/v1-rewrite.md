---
'eddy-editor': major
---

Rewrite for size and simplicity: roughly 43% smaller for consumers (Vue 12.5 → 7.1 kB, React 12.0 → 7.0 kB min+gzip, icons included) and a vanilla core of 4.8 kB.

- New framework-agnostic `createEditor(el, { plugins, content, onChange })` and `mountToolbar(host, editor)`; the Vue and React components are thin wrappers around them.
- Simpler document model: `Doc = Block[]`, text runs with `marks: { type: attrs }`, line breaks as `\n`, positions as `{ block, offset }` character offsets.
- Simpler plugins: `marks`/`blocks` keyed by type with CSS-selector `match`, `attrs(el)` and `render`; `keys` map bindings straight to functions; no command registry.
- Enter, Shift+Enter, undo/redo, paste and paste cleanup are built in (`core` and `safePaste` are gone).
- No more lucide peer dependency: toolbar icons are inline SVG. The `eddy-editor/nuxt` module now transpiles only `eddy-editor`; drop `@lucide/vue` from a hand-written `build.transpile`.
- Fixes: parsing is inert (no `<img onerror>` execution on paste or load), `<script>`/`<style>` text never leaks, toolbar buttons work from the keyboard, native Mod+B/I/U can no longer desync the model, and an empty editor emits `''`.

See "Migrating from 0.x" in the README.
