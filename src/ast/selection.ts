// ── AST Position & Selection ──────────────────────────────────────────────────

/**
 * A position in the document uniquely identifies a character slot.
 *
 * - blockIndex:  index into DocumentNode.children
 * - itemIndex:   for ListNode, index into items[]; 0 for non-list blocks
 * - inlineIndex: index into the block's (or list item's) children array
 * - offset:      character index within a TextNode's text string
 *                (0 for HardBreakNode)
 */
export interface ASTPosition {
  blockIndex: number
  itemIndex: number
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
  return (
    a.blockIndex === b.blockIndex &&
    a.itemIndex === b.itemIndex &&
    a.inlineIndex === b.inlineIndex &&
    a.offset === b.offset
  )
}

/** Returns [start, end] normalised so start ≤ end in document order. */
export function normalizeSelection(sel: ASTSelection): [ASTPosition, ASTPosition] {
  if (comparePositions(sel.anchor, sel.head) <= 0) {
    return [sel.anchor, sel.head]
  }
  return [sel.head, sel.anchor]
}

/** Returns negative if a < b, 0 if equal, positive if a > b. */
export function comparePositions(a: ASTPosition, b: ASTPosition): number {
  if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex
  if (a.itemIndex !== b.itemIndex) return a.itemIndex - b.itemIndex
  if (a.inlineIndex !== b.inlineIndex) return a.inlineIndex - b.inlineIndex
  return a.offset - b.offset
}

export function collapsedAt(pos: ASTPosition): ASTSelection {
  return { anchor: pos, head: pos }
}

/**
 * Compares an inline node's container position (block, item, inline index)
 * against an ASTPosition. Returns -1 if the node is before pos, 1 if after,
 * 0 if it's the same inline node. Ignores offset — this checks the node, not
 * a character within it.
 */
export function compareInlineToPosition(
  blockIdx: number,
  itemIdx: number,
  inlineIdx: number,
  pos: ASTPosition,
): number {
  if (blockIdx !== pos.blockIndex) return blockIdx - pos.blockIndex
  if (itemIdx !== pos.itemIndex) return itemIdx - pos.itemIndex
  return inlineIdx - pos.inlineIndex
}
