import type { EddyPlugin } from '../types'
import { bold } from './bold'
import { italic } from './italic'
import { underline } from './underline'
import { strikethrough } from './strikethrough'
import { createHeadingPlugin } from './create-heading-plugin'
import { unorderedList } from './unordered-list'
import { orderedList } from './ordered-list'

export const heading1 = createHeadingPlugin(1)
export const heading2 = createHeadingPlugin(2)
export const heading3 = createHeadingPlugin(3)
export const heading4 = createHeadingPlugin(4)
export const heading5 = createHeadingPlugin(5)
export const heading6 = createHeadingPlugin(6)

export const defaultPlugins: EddyPlugin[] = [
  bold,
  italic,
  underline,
  strikethrough,
  heading1,
  heading2,
  heading3,
  heading4,
  heading5,
  heading6,
  unorderedList,
  orderedList,
]
