import { createPlugin } from '../create-plugin'
import type { EddyPlugin } from '../types'

export function createHeadingPlugin(level: 1 | 2 | 3 | 4 | 5 | 6): EddyPlugin {
  const tag = `h${level}` as const
  const htmlTag = `<${tag}>` as const
  return createPlugin({
    name: `heading${level}`,
    toolbar: { label: `H${level}`, title: `Heading ${level}` },
    command(api) {
      const current = api.getCommandValue('formatBlock').toLowerCase()
      api.execute('formatBlock', current === tag ? '<p>' : htmlTag)
    },
    isActive(api) {
      return api.getCommandValue('formatBlock').toLowerCase() === tag
    },
  })
}
