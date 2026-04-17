import type { EddyPlugin } from '../types'
import { bold, italic, underline, strikethrough } from './marks'
import { unorderedList, orderedList } from './lists'
import { heading1, heading2, heading3, heading4, heading5, heading6 } from './headings'

export { bold, italic, underline, strikethrough } from './marks'
export { unorderedList, orderedList } from './lists'
export { heading1, heading2, heading3, heading4, heading5, heading6 } from './headings'

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
