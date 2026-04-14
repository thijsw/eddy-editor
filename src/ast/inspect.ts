import type { DocumentNode, InlineNode, MarkType, TextNode } from './types'
import type { ASTSelection } from './selection'
import { normalizeSelection } from './selection'

// ── Mark inspection ───────────────────────────────────────────────────────────

function hasMark(node: TextNode, mark: MarkType): boolean {
  return node.marks.some((m) => m.type === mark)
}

/**
 * Returns true if the given mark is active at the cursor or across the selection.
 *
 * For a collapsed selection: checks the text node at cursor position.
 * For a range: returns true only if ALL text nodes in the selection have the mark.
 */
export function isMarkActive(
  doc: DocumentNode,
  sel: ASTSelection,
  mark: MarkType,
): boolean {
  const [start, end] = normalizeSelection(sel)
  const isCollapsed =
    start.blockIndex === end.blockIndex &&
    start.itemIndex === end.itemIndex &&
    start.inlineIndex === end.inlineIndex &&
    start.offset === end.offset

  if (isCollapsed) {
    const block = doc.children[start.blockIndex]
    if (block) {
      const inlines = block.type === 'list'
        ? block.items[start.itemIndex]?.children ?? []
        : block.children
      const node = inlines[start.inlineIndex]
      if (node?.type === 'text') {
        return node.marks.some((m) => m.type === mark)
      }
    }
    return false
  }

  let foundAnyText = false
  let allHaveMark = true

  function checkInlines(inlines: InlineNode[], blockIdx: number, itemIdx: number): void {
    for (let i = 0; i < inlines.length; i++) {
      const node = inlines[i]
      if (node.type !== 'text') continue

      // Check if this inline is within the selection range
      const beforeStart =
        blockIdx < start.blockIndex ||
        (blockIdx === start.blockIndex &&
          itemIdx === start.itemIndex &&
          i < start.inlineIndex) ||
        (blockIdx === start.blockIndex &&
          itemIdx === start.itemIndex &&
          i === start.inlineIndex &&
          node.text.length > 0 &&
          start.offset >= node.text.length)

      const afterEnd =
        blockIdx > end.blockIndex ||
        (blockIdx === end.blockIndex &&
          itemIdx === end.itemIndex &&
          i > end.inlineIndex) ||
        (blockIdx === end.blockIndex &&
          itemIdx === end.itemIndex &&
          i === end.inlineIndex &&
          end.offset === 0)

      if (beforeStart || afterEnd) continue

      // Determine the text slice that is selected within this node
      const selStart =
        blockIdx === start.blockIndex &&
          itemIdx === start.itemIndex &&
          i === start.inlineIndex
          ? start.offset
          : 0
      const selEnd =
        blockIdx === end.blockIndex && itemIdx === end.itemIndex && i === end.inlineIndex
          ? end.offset
          : node.text.length

      const selectedText = node.text.slice(selStart, selEnd)
      if (selectedText === '') continue

      foundAnyText = true
      if (!hasMark(node, mark)) {
        allHaveMark = false
        return
      }
    }
  }

  for (let blockIndex = start.blockIndex; blockIndex <= end.blockIndex; blockIndex++) {
    const block = doc.children[blockIndex]
    if (!block) continue

    if (block.type === 'list') {
      const startItem = blockIndex === start.blockIndex ? start.itemIndex : 0
      const endItem = blockIndex === end.blockIndex ? end.itemIndex : block.items.length - 1
      for (let itemIndex = startItem; itemIndex <= endItem; itemIndex++) {
        const item = block.items[itemIndex]
        if (!item) continue
        checkInlines(item.children, blockIndex, itemIndex)
        if (!allHaveMark) return false
      }
    } else {
      checkInlines(block.children, blockIndex, 0)
      if (!allHaveMark) return false
    }
  }

  return foundAnyText && allHaveMark
}

// ── Block type inspection ─────────────────────────────────────────────────────

export type BlockTypeResult = 'paragraph' | 'heading' | 'list' | 'mixed'

/**
 * Returns the block type of the selection. If the selection spans multiple
 * different block types, returns 'mixed'.
 */
export function getBlockType(doc: DocumentNode, sel: ASTSelection): BlockTypeResult {
  const [start, end] = normalizeSelection(sel)
  let result: BlockTypeResult | null = null

  for (let i = start.blockIndex; i <= end.blockIndex; i++) {
    const block = doc.children[i]
    if (!block) continue

    let type: BlockTypeResult
    if (block.type === 'paragraph') type = 'paragraph'
    else if (block.type === 'heading') type = 'heading'
    else type = 'list'

    if (result === null) {
      result = type
    } else if (result !== type) {
      return 'mixed'
    }
  }

  return result ?? 'paragraph'
}

/**
 * Returns the heading level if the entire selection is within a single heading.
 * Returns null otherwise.
 */
export function getHeadingLevel(
  doc: DocumentNode,
  sel: ASTSelection,
): 1 | 2 | 3 | 4 | 5 | 6 | null {
  const [start, end] = normalizeSelection(sel)
  if (start.blockIndex !== end.blockIndex) return null

  const block = doc.children[start.blockIndex]
  if (!block || block.type !== 'heading') return null
  return block.level
}

/**
 * Returns true when the cursor position is at the very start of its block
 * (or list item). Used by insertParagraph to decide how to split headings.
 */
export function isCursorAtBlockStart(sel: ASTSelection): boolean {
  const { anchor } = sel
  return anchor.inlineIndex === 0 && anchor.offset === 0
}

/**
 * Returns true when the cursor position is at the very end of its block.
 */
export function isCursorAtBlockEnd(doc: DocumentNode, sel: ASTSelection): boolean {
  const { anchor } = sel
  const block = doc.children[anchor.blockIndex]
  if (!block) return false

  const children =
    block.type === 'list'
      ? block.items[anchor.itemIndex]?.children ?? []
      : block.children

  if (anchor.inlineIndex !== children.length - 1) return false
  const last = children[anchor.inlineIndex]
  if (!last) return true
  if (last.type === 'hardBreak') return true
  return anchor.offset >= last.text.length
}
