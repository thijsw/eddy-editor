# eddy-editor

## 0.5.0

### Minor Changes

- 3e71d02: Add `eddy-editor/nuxt`, a Nuxt module that bundles `eddy-editor` and `@lucide/vue` with the app (`build.transpile`). Left external, Nitro loads them against a second copy of the Vue runtime on the server, which breaks server-side rendering of the editor and leaks every later render.

## 0.4.0

### Minor Changes

- 4920d40: add atomic block support

## 0.3.0

### Minor Changes

- 733e4db: complete plugin rewrite
