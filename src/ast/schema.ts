import type { BlockNode, DocumentNode, InlineNode, Mark, TextNode } from './types'
import { emptyText, emptyParagraph, withChildren } from './types'

export type SchemaRule = (doc: DocumentNode) => DocumentNode

export function applySchema(doc: DocumentNode, rules: SchemaRule[]): DocumentNode {
  return rules.reduce((d, rule) => rule(d), doc)
}

/**
 * Merges adjacent text nodes with identical mark sets within every block.
 */
export function normalizeSiblingText(doc: DocumentNode): DocumentNode {
  return mapBlocks(doc, (block) => {
    const merged = mergeAdjacentTextNodes(block.children)
    return merged === block.children ? block : withChildren(block, merged)
  })
}

/**
 * Ensures every block has at least one inline child, and the document has at
 * least one block.
 */
export function ensureNonEmptyBlocks(doc: DocumentNode): DocumentNode {
  if (doc.blocks.length === 0) return { type: 'document', blocks: [emptyParagraph()] }
  return mapBlocks(doc, (block) =>
    block.children.length === 0 ? withChildren(block, [emptyText()]) : block,
  )
}

export const defaultRules: SchemaRule[] = [normalizeSiblingText, ensureNonEmptyBlocks]

// ── Internal helpers ─────────────────────────────────────────────────────────

function mapBlocks(doc: DocumentNode, fn: (block: BlockNode) => BlockNode): DocumentNode {
  let changed = false
  const blocks = doc.blocks.map((b) => {
    const next = fn(b)
    if (next !== b) changed = true
    return next
  })
  return changed ? { type: 'document', blocks } : doc
}

function marksEqual(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false
  // Mark sets are tiny (0-4 entries), so nested some() beats Set allocation.
  return a.every((m) => b.some((n) => n.type === m.type && n.attrs?.href === m.attrs?.href))
}

function mergeAdjacentTextNodes(nodes: InlineNode[]): InlineNode[] {
  const result: InlineNode[] = []
  let merged = false
  for (const node of nodes) {
    const last = result[result.length - 1] as TextNode | undefined
    if (node.type === 'text' && last?.type === 'text' && marksEqual(node.marks, last.marks)) {
      result[result.length - 1] = { type: 'text', text: last.text + node.text, marks: node.marks }
      merged = true
    } else {
      result.push(node)
    }
  }
  return merged ? result : nodes
}
