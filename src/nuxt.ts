import { defineNuxtModule } from '@nuxt/kit'
import type { NuxtOptions } from '@nuxt/schema'

/**
 * Packages that must be bundled into a Nuxt app rather than loaded from
 * `node_modules` at runtime. Nitro keeps dependencies external by default and
 * resolves their `vue` import to its own copy of the Vue runtime, next to the
 * one bundled into the app. A render function running against that second
 * copy sees none of the app's rendering state (`currentRenderingInstance`,
 * `inject` context), so on the server it throws — and the render block it had
 * opened stays open in that copy, pinning every later render in the process.
 */
export const TRANSPILE_PACKAGES = ['eddy-editor', '@lucide/vue'] as const

/** Adds the packages to a `build.transpile` list, skipping ones already present. */
export const addTranspilePackages = (transpile: NuxtOptions['build']['transpile']) => {
  for (const name of TRANSPILE_PACKAGES) {
    if (!transpile.includes(name)) {
      transpile.push(name)
    }
  }

  return transpile
}

/**
 * Nuxt module: `modules: ['eddy-editor/nuxt']`. Its only job is to make Nuxt
 * bundle `eddy-editor` and `@lucide/vue` with the app, which is what
 * `build.transpile` does by hand.
 */
export default defineNuxtModule({
  meta: {
    name: 'eddy-editor',
    configKey: 'eddyEditor',
    compatibility: { nuxt: '>=3.0.0' },
  },
  setup(_options, nuxt) {
    addTranspilePackages(nuxt.options.build.transpile)
  },
})
