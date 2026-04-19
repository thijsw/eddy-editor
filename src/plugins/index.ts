import type { EddyPlugin } from '../types'
import { bold, italic, underline, strikethrough, code } from './marks'
import { unorderedList, orderedList } from './lists'
import { heading1, heading2, heading3, heading4, heading5, heading6 } from './headings'
import { link } from './links'

export { bold, italic, underline, strikethrough, code } from './marks'
export { unorderedList, orderedList } from './lists'
export { heading1, heading2, heading3, heading4, heading5, heading6 } from './headings'
export { link } from './links'

export const defaultPlugins: EddyPlugin[] = [
  bold,
  italic,
  underline,
  strikethrough,
  code,
  link,
  heading1,
  heading2,
  heading3,
  heading4,
  heading5,
  heading6,
  unorderedList,
  orderedList,
]
