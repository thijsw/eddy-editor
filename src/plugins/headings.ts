import type { EddyPlugin } from '../types'
import type { BlockSpec } from '../ast/schema'

type Level = 1 | 2 | 3 | 4 | 5 | 6

function coerceLevel(value: unknown): Level | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 6 ? (n as Level) : null
}

const headingSpec: BlockSpec = {
  type: 'heading',
  parseDOM: [
    { tag: 'h1' },
    { tag: 'h2' },
    { tag: 'h3' },
    { tag: 'h4' },
    { tag: 'h5' },
    { tag: 'h6' },
  ],
  attrs: {
    level: {
      default: 1,
      parseHTML: (el) => {
        const m = /^h([1-6])$/i.exec(el.tagName)
        return m ? Number(m[1]) : 1
      },
      validate: (value) => coerceLevel(value),
    },
  },
  toDOM: (block) => [`h${coerceLevel(block.attrs.level) ?? 1}`],
}

/**
 * One plugin that owns the `heading` block type end-to-end. Exposes
 * `heading.set(level)` — per-block toggle: setting the current level reverts
 * to a paragraph (see `setBlockType` in commands.ts).
 *
 * The heading-level dropdown in the default toolbar is a built-in UI element
 * that reads block state via the generic `api.getBlockAt()` and dispatches
 * through `api.setBlockType('heading', { level })` — the plugin doesn't
 * contribute any toolbar items of its own.
 */
export const heading: EddyPlugin = {
  name: 'heading',
  blocks: [headingSpec],
  commands: {
    'heading.set': (api, levelArg) => {
      const level = coerceLevel(levelArg)
      if (level === null) {
        api.setBlockType('paragraph')
        return
      }
      api.setBlockType('heading', { level })
    },
  },
}
