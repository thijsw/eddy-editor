// Components
export { default as EddyEditor } from './components/eddy-editor.vue'
export { default as EddyToolbar } from './components/eddy-toolbar.vue'

// Core utilities
export { createPlugin } from './create-plugin'
export { EditorAPIImpl } from './editor-api'

// Built-in plugins — individual exports allow tree-shaking
export { defaultPlugins, heading1, heading2, heading3, heading4, heading5, heading6 } from './plugins/index'
export { bold } from './plugins/bold'
export { italic } from './plugins/italic'
export { underline } from './plugins/underline'
export { strikethrough } from './plugins/strikethrough'
export { unorderedList } from './plugins/unordered-list'
export { orderedList } from './plugins/ordered-list'

// Custom toolbar support
export { useEditorState } from './use-editor-state'

// Types
export type { EditorAPI, EddyPlugin, ToolbarConfig } from './types'
export type { MarkType, DocumentNode, BlockNode, InlineNode, TextNode, HardBreakNode, ParagraphNode, HeadingNode, ListNode, ListItemNode, Mark } from './ast/types'
export type { ASTPosition, ASTSelection } from './ast/selection'

// AST utilities — for advanced consumers doing server-side processing
export { parseHTML } from './ast/parse'
export { serializeToHTML } from './ast/serialize'

