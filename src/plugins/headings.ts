import type { EddyPlugin } from '../types'

type Level = 1 | 2 | 3 | 4 | 5 | 6

function heading(level: Level): EddyPlugin {
  return {
    name: `heading${level}`,
    toolbar: { label: `H${level}`, title: `Heading ${level}` },
    command(api) {
      api.setBlockType('heading', { level })
    },
    isActive(api) {
      return api.getHeadingLevel() === level
    },
  }
}

export const heading1 = heading(1)
export const heading2 = heading(2)
export const heading3 = heading(3)
export const heading4 = heading(4)
export const heading5 = heading(5)
export const heading6 = heading(6)
