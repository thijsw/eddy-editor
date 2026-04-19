// Framework-agnostic core. For UI components use:
//   import { EddyEditor } from 'eddy-editor/vue'
//   import { EddyEditor } from 'eddy-editor/react'

// Plugin authoring
export { createPlugin } from './create-plugin'

// Built-in plugins — individual exports allow tree-shaking
export {
  defaultPlugins,
  bold,
  italic,
  underline,
  strikethrough,
  unorderedList,
  orderedList,
  heading1,
  heading2,
  heading3,
  heading4,
  heading5,
  heading6,
} from './plugins/index'

// Types
export type { EditorAPI, EddyPlugin, ToolbarConfig } from './types'
export type {
  MarkType,
  DocumentNode,
  BlockNode,
  InlineNode,
  TextNode,
  HardBreakNode,
  ParagraphNode,
  HeadingNode,
  ListItemNode,
  Mark,
} from './ast/types'
export type { ASTPosition, ASTSelection } from './ast/selection'

// AST utilities — for advanced consumers doing server-side processing
export { parseHTML } from './ast/parse'
export { serializeToHTML } from './ast/serialize'
