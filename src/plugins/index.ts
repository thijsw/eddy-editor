import type { EddyPlugin } from '../types'
import { bold } from './bold'
import { italic } from './italic'
import { underline } from './underline'
import { strikethrough } from './strikethrough'
import { heading1 } from './heading-1'
import { heading2 } from './heading-2'
import { heading3 } from './heading-3'
import { heading4 } from './heading-4'
import { heading5 } from './heading-5'
import { heading6 } from './heading-6'
import { unorderedList } from './unordered-list'
import { orderedList } from './ordered-list'

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
