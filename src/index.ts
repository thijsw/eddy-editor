// Framework-agnostic core. For UI components use:
//   import { EddyEditor } from 'eddy-editor/vue'
//   import { EddyEditor } from 'eddy-editor/react'

// Editor class (framework-agnostic consumers instantiate this directly)
export { Editor } from './editor'

// Built-in plugins
export {
  defaultPlugins,
  defaultSchema,
  safePaste,
  core,
  bold,
  italic,
  underline,
  strikethrough,
  code,
  link,
  sanitizeHref,
  heading,
  list,
} from './plugins/index'

// Types
export type {
  EditorAPI,
  EddyPlugin,
  ToolbarItem,
  CommandFn,
  EditorEvent,
  EventHandlerMap,
  PluginContext,
  TransactionAPI,
} from './types'
export type {
  Mark,
  TextNode,
  HardBreakNode,
  InlineNode,
  BlockNode,
  DocumentNode,
} from './ast/types'
export type { ASTPosition, ASTSelection } from './ast/selection'
export type {
  Schema,
  MarkSpec,
  BlockSpec,
  BlockGroupSpec,
  AttrSpec,
  DOMOutput,
  SchemaRule,
} from './ast/schema'
export type { CommandResult } from './ast/commands'

// AST helpers — for advanced plugins that drive their own transactions via
// `tr.apply`. Most plugins won't need these: `editor.insertBlock` covers the
// common block-insertion path, and atom-block deletion is built in.
export { generateId, emptyText, emptyParagraph } from './ast/types'
export { collapsedAt, blockIndexOf, isCollapsed, positionsEqual } from './ast/selection'
export { isCursorAtBlockStart, isCursorAtBlockEnd } from './ast/inspect'

// AST utilities — for advanced consumers doing server-side processing
import { parseHTML as parseHTMLWithSchema } from './ast/parse'
import { serializeToHTML as serializeToHTMLWithSchema } from './ast/serialize'
import { defaultSchema } from './plugins/index'
import type { DocumentNode } from './ast/types'
import type { Schema } from './ast/schema'

export function parseHTML(html: string, schema: Schema = defaultSchema()): DocumentNode {
  return parseHTMLWithSchema(html, schema)
}

export function serializeToHTML(doc: DocumentNode, schema: Schema = defaultSchema()): string {
  return serializeToHTMLWithSchema(doc, schema)
}
