import type { BlockNode, DocumentNode, InlineNode, Mark, TextNode } from './types'

// ── Schema rule type ──────────────────────────────────────────────────────────

export type SchemaRule = (doc: DocumentNode) => DocumentNode

export function applySchema(doc: DocumentNode, rules: SchemaRule[]): DocumentNode {
  return rules.reduce((d, rule) => rule(d), doc)
}

// ── Default rules ─────────────────────────────────────────────────────────────

/**
 * Removes list nodes with zero items.
 */
export function emptyListsRemoved(doc: DocumentNode): DocumentNode {
  const filtered = doc.children.filter(
    (block) => block.type !== 'list' || block.items.length > 0,
  )
  if (filtered.length === doc.children.length) return doc
  if (filtered.length === 0) {
    return {
      type: 'document',
      children: [{ type: 'paragraph', children: [{ type: 'text', text: '', marks: [] }] }],
    }
  }
  return { type: 'document', children: filtered }
}

/**
 * Merges consecutive lists of the same type (both ordered or both unordered).
 */
export function normalizeAdjacentLists(doc: DocumentNode): DocumentNode {
  const children: BlockNode[] = []
  for (const block of doc.children) {
    const prev = children[children.length - 1]
    if (
      block.type === 'list' &&
      prev?.type === 'list' &&
      block.ordered === prev.ordered
    ) {
      children[children.length - 1] = {
        type: 'list',
        ordered: block.ordered,
        items: [...prev.items, ...block.items],
      }
    } else {
      children.push(block)
    }
  }
  if (children.length === doc.children.length) return doc
  return { type: 'document', children }
}

/**
 * Merges adjacent text nodes with identical mark sets within every block's
 * and list item's children array.
 */
export function normalizeSiblingText(doc: DocumentNode): DocumentNode {
  let changed = false
  const children = doc.children.map((block): BlockNode => {
    if (block.type === 'list') {
      const items = block.items.map((item) => {
        const merged = mergeAdjacentTextNodes(item.children)
        if (merged !== item.children) changed = true
        return merged === item.children ? item : { ...item, children: merged }
      })
      return changed ? { ...block, items } : block
    }
    const merged = mergeAdjacentTextNodes(block.children)
    if (merged !== block.children) changed = true
    return merged === block.children ? block : { ...block, children: merged }
  })
  return changed ? { type: 'document', children } : doc
}

function marksEqual(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a.map((m) => m.type))
  return b.every((m) => setA.has(m.type))
}

// Returns the original array (by reference) when no merges occurred,
// so callers can detect changes cheaply via `result !== original`.
function mergeAdjacentTextNodes(nodes: InlineNode[]): InlineNode[] {
  const result: InlineNode[] = []
  let merged = false
  for (const node of nodes) {
    const last = result[result.length - 1]
    if (
      node.type === 'text' &&
      last?.type === 'text' &&
      marksEqual(node.marks, (last as TextNode).marks)
    ) {
      result[result.length - 1] = {
        type: 'text',
        text: (last as TextNode).text + node.text,
        marks: node.marks,
      }
      merged = true
    } else {
      result.push(node)
    }
  }
  return merged ? result : nodes
}

/**
 * Ensures every block has at least one inline child (an empty text node).
 * Empty blocks cause selection restoration issues.
 */
export function ensureNonEmptyBlocks(doc: DocumentNode): DocumentNode {
  let changed = false
  const emptyInline: InlineNode[] = [{ type: 'text', text: '', marks: [] }]
  const children = doc.children.map((block): BlockNode => {
    if (block.type === 'list') {
      const items = block.items.map((item) => {
        if (item.children.length === 0) {
          changed = true
          return { ...item, children: emptyInline }
        }
        return item
      })
      return changed ? { ...block, items } : block
    }
    if (block.children.length === 0) {
      changed = true
      return { ...block, children: emptyInline }
    }
    return block
  })
  return changed ? { type: 'document', children } : doc
}

// ── Default rule set ──────────────────────────────────────────────────────────

export const defaultRules: SchemaRule[] = [
  emptyListsRemoved,
  normalizeAdjacentLists,
  normalizeSiblingText,
  ensureNonEmptyBlocks,
]
