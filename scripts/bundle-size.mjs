// Measures what a consumer actually ships: each scenario is bundled from
// dist/ the way an app would (tree-shaken, minified, framework external),
// then gzipped. Patches the <!-- BUNDLE_SIZE --> marker in README.md.
//
//   pnpm build && node scripts/bundle-size.mjs

import { build } from 'vite'
import { gzipSync } from 'node:zlib'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
const scenarios = {
  core: `import { createEditor } from '${dist}/index.js'; createEditor(document.body)`,
  vanilla: `import { createEditor, mountToolbar, defaultPlugins } from '${dist}/index.js'; mountToolbar(document.body, createEditor(document.body, { plugins: defaultPlugins }))`,
  vue: `import { EddyEditor } from '${dist}/vue.js'; import { defaultPlugins } from '${dist}/index.js'; console.log(EddyEditor, defaultPlugins)`,
  react: `import { EddyEditor } from '${dist}/react.js'; import { defaultPlugins } from '${dist}/index.js'; console.log(EddyEditor, defaultPlugins)`,
}

const tmp = mkdtempSync(join(tmpdir(), 'eddy-size-'))
const sizes = {}
for (const [name, code] of Object.entries(scenarios)) {
  const entry = join(tmp, `${name}.js`)
  writeFileSync(entry, code)
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    // App-style build: lib mode skips whitespace minification for ES output.
    build: {
      write: false,
      minify: true,
      modulePreload: false,
      rolldownOptions: { input: entry, external: [/^vue/, /^react/] },
    },
  })
  const js = [out]
    .flat()
    .flatMap((r) => r.output)
    .map((o) => o.code ?? '')
    .join('')
  sizes[name] = gzipSync(js, { level: 9 }).length
  console.log(
    `${name.padEnd(8)} ${String(js.length).padStart(6)} B min  ${String(sizes[name]).padStart(5)} B gzip`,
  )
}

const kb = (b) => (b / 1000).toFixed(1) + ' kB'
const line = `core **${kb(sizes.core)}** · with all plugins + toolbar **${kb(sizes.vanilla)}** · Vue **${kb(sizes.vue)}** · React **${kb(sizes.react)}** (min + gzip)`
const readme = join(root, 'README.md')
writeFileSync(
  readme,
  readFileSync(readme, 'utf8').replace(
    /<!-- BUNDLE_SIZE -->.*<!-- \/BUNDLE_SIZE -->/,
    `<!-- BUNDLE_SIZE -->${line}<!-- /BUNDLE_SIZE -->`,
  ),
)
