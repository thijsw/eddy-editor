import type { DocumentNode, Mark, BlockNode } from './types'
import type { ASTSelection } from './selection'
import { blockIndexOf, normalizeSelection, positionsEqual } from './selection'

/**
 * True if the given mark type is active at the cursor or across the entire selection.
 */
export function isMarkActive(doc: DocumentNode, sel: ASTSelection, mark: string): boolean {
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

/**
 * Returns the mark of the given type at the selection anchor, if any.
 * Useful for reading attributes (e.g. the href of a link under the cursor).
 */
export function getMarkAt(doc: DocumentNode, sel: ASTSelection, mark: string): Mark | null {
  const pos = sel.anchor
  const block = doc.blocks[blockIndexOf(doc).get(pos.blockId) ?? -1]
  const node = block?.children[pos.inlineIndex]
  if (node?.type !== 'text') return null
  return node.marks.find((m) => m.type === mark) ?? null
}

/**
 * Returns the block at the selection anchor, or null.
 */
export function getBlockAt(doc: DocumentNode, sel: ASTSelection): BlockNode | null {
  const block = doc.blocks[blockIndexOf(doc).get(sel.anchor.blockId) ?? -1]
  return block ?? null
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
