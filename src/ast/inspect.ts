import type { DocumentNode, MarkType } from './types'
import type { ASTSelection } from './selection'
import { blockIndexOf, normalizeSelection, positionsEqual } from './selection'

// ── Mark inspection ───────────────────────────────────────────────────────────

/**
 * Returns true if the given mark is active at the cursor or across the entire selection.
 */
export function isMarkActive(doc: DocumentNode, sel: ASTSelection, mark: MarkType): boolean {
  const [start, end] = normalizeSelection(doc, sel)
  const idx = blockIndexOf(doc)

  if (positionsEqual(start, end)) {
    const block = doc.blocks[idx.get(start.blockId) ?? -1]
    const node = block?.children[start.inlineIndex]
    return node?.type === 'text' && node.marks.some((m) => m.type === mark)
  }

  const startIdx = idx.get(start.blockId) ?? -1
  const endIdx = idx.get(end.blockId) ?? -1

  let found = false
  for (let i = startIdx; i <= endIdx; i++) {
    const block = doc.blocks[i]
    if (!block) continue
    for (let j = 0; j < block.children.length; j++) {
      const node = block.children[j]
      if (node.type !== 'text') continue
      if (block.id === start.blockId && j < start.inlineIndex) continue
      if (block.id === end.blockId && j > end.inlineIndex) continue

      const s = block.id === start.blockId && j === start.inlineIndex ? start.offset : 0
      const e = block.id === end.blockId && j === end.inlineIndex ? end.offset : node.text.length
      if (node.text.slice(s, e) === '') continue

      found = true
      if (!node.marks.some((m) => m.type === mark)) return false
    }
  }
  return found
}

// ── Block type inspection ─────────────────────────────────────────────────────

type BlockTypeResult = 'paragraph' | 'heading' | 'list' | 'mixed'

export function getBlockType(doc: DocumentNode, sel: ASTSelection): BlockTypeResult {
  const [start, end] = normalizeSelection(doc, sel)
  const idx = blockIndexOf(doc)
  const startIdx = idx.get(start.blockId) ?? -1
  const endIdx = idx.get(end.blockId) ?? -1

  let result: BlockTypeResult | null = null
  for (let i = startIdx; i <= endIdx; i++) {
    const block = doc.blocks[i]
    if (!block) continue
    const type: BlockTypeResult = block.type === 'listItem' ? 'list' : block.type
    if (result === null) result = type
    else if (result !== type) return 'mixed'
  }
  return result ?? 'paragraph'
}

/**
 * Returns the heading level if the entire selection is within a single heading.
 */
export function getHeadingLevel(
  doc: DocumentNode,
  sel: ASTSelection,
): 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (sel.anchor.blockId !== sel.head.blockId) return null
  const block = doc.blocks[blockIndexOf(doc).get(sel.anchor.blockId) ?? -1]
  return block?.type === 'heading' ? block.level : null
}

/**
 * Returns the list variant (ordered/unordered) if the selection anchor is
 * inside a listItem block, otherwise null.
 */
export function getListType(doc: DocumentNode, sel: ASTSelection): 'ordered' | 'unordered' | null {
  const block = doc.blocks[blockIndexOf(doc).get(sel.anchor.blockId) ?? -1]
  if (block?.type !== 'listItem') return null
  return block.ordered ? 'ordered' : 'unordered'
}

export function isCursorAtBlockStart(sel: ASTSelection): boolean {
  return sel.anchor.inlineIndex === 0 && sel.anchor.offset === 0
}

export function isCursorAtBlockEnd(doc: DocumentNode, sel: ASTSelection): boolean {
  const { anchor } = sel
  const block = doc.blocks[blockIndexOf(doc).get(anchor.blockId) ?? -1]
  if (!block) return false
  if (anchor.inlineIndex !== block.children.length - 1) return false
  const last = block.children[anchor.inlineIndex]
  if (!last || last.type === 'hardBreak') return true
  return anchor.offset >= last.text.length
}
