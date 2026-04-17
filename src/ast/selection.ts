// ── AST Position & Selection ──────────────────────────────────────────────────

import type { DocumentNode } from './types'

/**
 * A position in the document uniquely identifies a character slot.
 *
 * - blockId:     the persistent ID of the BlockNode
 * - inlineIndex: index into the block's children array
 * - offset:      character index within a TextNode's text string
 *                (0 for HardBreakNode)
 */
export interface ASTPosition {
  blockId: string
  inlineIndex: number
  offset: number
}

export interface ASTSelection {
  anchor: ASTPosition
  head: ASTPosition
}

export function isCollapsed(sel: ASTSelection): boolean {
  return positionsEqual(sel.anchor, sel.head)
}

export function positionsEqual(a: ASTPosition, b: ASTPosition): boolean {
  return a.blockId === b.blockId && a.inlineIndex === b.inlineIndex && a.offset === b.offset
}

/**
 * Lazily-computed, memoized map of blockId → block index for a given doc.
 * Doc instances are immutable (commands produce new doc objects), so the map
 * can be cached on the doc itself via a WeakMap. First call is O(n); all
 * subsequent calls on the same doc are O(1).
 */
const blockIndexCache = new WeakMap<DocumentNode, Map<string, number>>()

export function blockIndexOf(doc: DocumentNode): Map<string, number> {
  let cached = blockIndexCache.get(doc)
  if (!cached) {
    cached = new Map()
    for (let i = 0; i < doc.blocks.length; i++) cached.set(doc.blocks[i].id, i)
    blockIndexCache.set(doc, cached)
  }
  return cached
}

/** Returns [start, end] normalised so start ≤ end in document order. */
export function normalizeSelection(
  doc: DocumentNode,
  sel: ASTSelection,
): [ASTPosition, ASTPosition] {
  return comparePositions(doc, sel.anchor, sel.head) <= 0
    ? [sel.anchor, sel.head]
    : [sel.head, sel.anchor]
}

/** Returns negative if a < b, 0 if equal, positive if a > b. */
export function comparePositions(doc: DocumentNode, a: ASTPosition, b: ASTPosition): number {
  if (a.blockId === b.blockId) {
    if (a.inlineIndex !== b.inlineIndex) return a.inlineIndex - b.inlineIndex
    return a.offset - b.offset
  }
  const idx = blockIndexOf(doc)
  return (idx.get(a.blockId) ?? -1) - (idx.get(b.blockId) ?? -1)
}

export function collapsedAt(pos: ASTPosition): ASTSelection {
  return { anchor: pos, head: pos }
}
