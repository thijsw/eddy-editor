---
'eddy-editor': minor
---

Add `eddy-editor/nuxt`, a Nuxt module that bundles `eddy-editor` and `@lucide/vue` with the app (`build.transpile`). Left external, Nitro loads them against a second copy of the Vue runtime on the server, which breaks server-side rendering of the editor and leaks every later render.
