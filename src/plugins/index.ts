import type { EddyPlugin } from '../types'
import { Schema } from '../ast/schema'
import type { MarkSpec, BlockSpec } from '../ast/schema'
import { safePaste } from './safe-paste'
import { core } from './core'
import { bold, italic, underline, strikethrough, code } from './marks'
import { link } from './links'
import { heading } from './headings'
import { list } from './lists'

export { safePaste } from './safe-paste'
export { core } from './core'
export { bold, italic, underline, strikethrough, code } from './marks'
export { link, sanitizeHref } from './links'
export { heading } from './headings'
export { list } from './lists'

/**
 * Default plugin set. `safePaste` runs before `core` so Word/Google Docs
 * paste is cleaned before the core paste handler processes it. Omit
 * `safePaste` to let the ~3 kB cleanup tables tree-shake out — the schema
 * parser still sanitises attributes, so dropping it doesn't create XSS
 * risk, only extra empty paragraphs on Office pastes.
 */
export const defaultPlugins: EddyPlugin[] = [
  safePaste,
  core,
  bold,
  italic,
  underline,
  strikethrough,
  code,
  link,
  heading,
  list,
]

/**
 * Schema derived from the default plugin set. Used by `parseHTML` and
 * `serializeToHTML` when called without a custom schema — for server-side
 * rendering, standalone HTML processing, and tests.
 */
let cachedDefaultSchema: Schema | null = null
export function defaultSchema(): Schema {
  if (cachedDefaultSchema) return cachedDefaultSchema
  const marks: MarkSpec[] = []
  const blocks: BlockSpec[] = []
  for (const plugin of defaultPlugins) {
    if (plugin.marks) marks.push(...plugin.marks)
    if (plugin.blocks) blocks.push(...plugin.blocks)
  }
  cachedDefaultSchema = new Schema(marks, blocks)
  return cachedDefaultSchema
}
