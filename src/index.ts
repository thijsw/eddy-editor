// Components
export { default as EddyEditor } from './components/eddy-editor.vue'
export { default as EddyToolbar } from './components/eddy-toolbar.vue'

// Core utilities
export { createPlugin } from './create-plugin'
export { EditorAPIImpl } from './editor-api'

// Built-in plugins — individual exports allow tree-shaking
export { defaultPlugins } from './plugins/index'
export { bold } from './plugins/bold'
export { italic } from './plugins/italic'
export { underline } from './plugins/underline'
export { strikethrough } from './plugins/strikethrough'
export { heading1 } from './plugins/heading-1'
export { heading2 } from './plugins/heading-2'
export { heading3 } from './plugins/heading-3'
export { heading4 } from './plugins/heading-4'
export { heading5 } from './plugins/heading-5'
export { heading6 } from './plugins/heading-6'
export { unorderedList } from './plugins/unordered-list'
export { orderedList } from './plugins/ordered-list'

// Types
export type { EditorAPI, EddyPlugin, ToolbarConfig, EddyProvision } from './types'
export type { MarkType, DocumentNode, BlockNode, InlineNode, TextNode, HardBreakNode, ParagraphNode, HeadingNode, ListNode, ListItemNode, Mark } from './ast/types'
export type { ASTPosition, ASTSelection } from './ast/selection'

// AST utilities — for advanced consumers doing server-side processing
export { parseHTML } from './ast/parse'
export { serializeToHTML } from './ast/serialize'

