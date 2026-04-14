import type { Component } from 'vue'
import { createPlugin } from '../create-plugin'
import type { EddyPlugin } from '../types'

export function createHeadingPlugin(level: 1 | 2 | 3 | 4 | 5 | 6, icon?: Component): EddyPlugin {
  return createPlugin({
    name: `heading${level}`,
    toolbar: { label: `H${level}`, title: `Heading ${level}`, ...(icon ? { icon } : {}) },
    command(api) { api.setBlockType('heading', { level }) },
    isActive(api) { return api.getHeadingLevel() === level },
  })
}
