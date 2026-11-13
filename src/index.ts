export { createEditor } from './editor'
export { mountToolbar } from './toolbar'
export {
  defaultPlugins,
  bold,
  italic,
  underline,
  strikethrough,
  code,
  link,
  heading,
  list,
  sanitizeHref,
  setLink,
  promptLink,
  toggleList,
} from './plugins'
export { createSchema, parse, serialize, normalize } from './schema'
export {
  createBlock,
  newId,
  eq,
  slice,
  textLength,
  caret,
  isCollapsed,
  indexOf,
  range,
  markRange,
  marksAt,
} from './model'

export type { Attrs, Marks, TextNode, Block, Doc, Pos, Selection, Transform } from './model'
export type { DOMSpec, MarkSpec, BlockSpec, Schema } from './schema'
export type {
  Editor,
  EditorOptions,
  Plugin,
  KeyHandler,
  ToolbarItem,
  ButtonItem,
  SelectItem,
} from './types'
