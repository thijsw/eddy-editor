import type {
  BlockNode,
  DocumentNode,
  InlineNode,
  ListItemNode,
  MarkType,
  ParagraphNode,
  TextNode,
} from './types'
import { generateId, emptyText, emptyParagraph, withChildren } from './types'
import type { ASTPosition, ASTSelection } from './selection'
import { blockIndexOf, collapsedAt, isCollapsed, normalizeSelection } from './selection'
import { isMarkActive, isCursorAtBlockEnd, isCursorAtBlockStart } from './inspect'

export interface CommandResult {
  doc: DocumentNode
  selection: ASTSelection
}

// ── Position remapping ────────────────────────────────────────────────────────

export function remapSelection(
  oldDoc: DocumentNode,
  newDoc: DocumentNode,
  sel: ASTSelection,
): ASTSelection {
  return {
    anchor: remapPosition(oldDoc, newDoc, sel.anchor),
    head: remapPosition(oldDoc, newDoc, sel.head),
  }
}

function remapPosition(oldDoc: DocumentNode, newDoc: DocumentNode, pos: ASTPosition): ASTPosition {
  const oldIdx = blockIndexOf(oldDoc).get(pos.blockId)
  const newIdx = blockIndexOf(newDoc).get(pos.blockId)
  if (oldIdx === undefined || newIdx === undefined) return pos
  const oldBlock = oldDoc.blocks[oldIdx]
  const newBlock = newDoc.blocks[newIdx]

  let charOffset = 0
  for (let i = 0; i < pos.inlineIndex && i < oldBlock.children.length; i++) {
    charOffset += inlineLen(oldBlock.children[i])
  }
  charOffset += pos.offset

  let remaining = charOffset
  for (let i = 0; i < newBlock.children.length; i++) {
    const len = inlineLen(newBlock.children[i])
    if (remaining <= len) return { blockId: pos.blockId, inlineIndex: i, offset: remaining }
    remaining -= len
  }

  const last = newBlock.children.length - 1
  const lastNode = newBlock.children[last]
  return {
    blockId: pos.blockId,
    inlineIndex: Math.max(0, last),
    offset: lastNode?.type === 'text' ? lastNode.text.length : 0,
  }
}

function inlineLen(node: InlineNode): number {
  return node.type === 'text' ? node.text.length : 1
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cursorAtBlock(block: BlockNode): ASTSelection {
  return collapsedAt({ blockId: block.id, inlineIndex: 0, offset: 0 })
}

function cloneListItem(src: ListItemNode, children: InlineNode[]): ListItemNode {
  return { id: generateId(), type: 'listItem', ordered: src.ordered, indent: src.indent, children }
}

function toParagraph(block: BlockNode, children = block.children): ParagraphNode {
  return { id: block.id, type: 'paragraph', children }
}

function isInlineEmpty(inlines: InlineNode[]): boolean {
  return (
    inlines.length === 0 ||
    (inlines.length === 1 && inlines[0].type === 'text' && inlines[0].text === '')
  )
}

function mapBlocksInRange(
  doc: DocumentNode,
  startIdx: number,
  endIdx: number,
  fn: (block: BlockNode, i: number) => BlockNode,
): DocumentNode {
  return {
    type: 'document',
    blocks: doc.blocks.map((block, i) => (i < startIdx || i > endIdx ? block : fn(block, i))),
  }
}

function blockRangeIdx(
  doc: DocumentNode,
  sel: ASTSelection,
): [ASTPosition, ASTPosition, number, number] {
  const [start, end] = normalizeSelection(doc, sel)
  const idx = blockIndexOf(doc)
  return [start, end, idx.get(start.blockId) ?? -1, idx.get(end.blockId) ?? -1]
}

// ── toggleMark ────────────────────────────────────────────────────────────────

export function toggleMark(doc: DocumentNode, sel: ASTSelection, mark: MarkType): CommandResult {
  if (isCollapsed(sel)) return { doc, selection: sel }

  const active = isMarkActive(doc, sel, mark)
  const [start, end, startIdx, endIdx] = blockRangeIdx(doc, sel)

  const newDoc = mapBlocksInRange(doc, startIdx, endIdx, (block) =>
    applyMarkToBlock(block, start, end, mark, active),
  )
  return { doc: newDoc, selection: remapSelection(doc, newDoc, sel) }
}

function applyMarkToBlock(
  block: BlockNode,
  start: ASTPosition,
  end: ASTPosition,
  mark: MarkType,
  remove: boolean,
): BlockNode {
  const isStartBlock = block.id === start.blockId
  const isEndBlock = block.id === end.blockId
  // Inlines at positions < firstInline or > lastInline are outside the
  // selection within this block and must pass through unchanged.
  const firstInline = isStartBlock ? start.inlineIndex : 0
  const lastInline = isEndBlock ? end.inlineIndex : block.children.length - 1
  const result: InlineNode[] = []

  for (let i = 0; i < block.children.length; i++) {
    const node = block.children[i]
    if (node.type !== 'text' || i < firstInline || i > lastInline) {
      result.push(node)
      continue
    }

    const textStart = isStartBlock && i === start.inlineIndex ? start.offset : 0
    const textEnd = isEndBlock && i === end.inlineIndex ? end.offset : node.text.length

    if (textStart > 0) {
      result.push({ type: 'text', text: node.text.slice(0, textStart), marks: [...node.marks] })
    }

    const selectedText = node.text.slice(textStart, textEnd)
    if (selectedText.length > 0) {
      const marks = remove
        ? node.marks.filter((m) => m.type !== mark)
        : node.marks.some((m) => m.type === mark)
          ? node.marks
          : [...node.marks, { type: mark }]
      result.push({ type: 'text', text: selectedText, marks })
    }

    if (textEnd < node.text.length) {
      result.push({ type: 'text', text: node.text.slice(textEnd), marks: [...node.marks] })
    }
  }

  return { ...block, children: result }
}

// ── setBlockType ──────────────────────────────────────────────────────────────

export function setBlockType(
  doc: DocumentNode,
  sel: ASTSelection,
  type: 'paragraph' | 'heading',
  attrs?: { level?: 1 | 2 | 3 | 4 | 5 | 6 },
): CommandResult {
  const [, , startIdx, endIdx] = blockRangeIdx(doc, sel)
  const level = attrs?.level ?? 1

  const newDoc = mapBlocksInRange(doc, startIdx, endIdx, (block) => {
    if (block.type === 'listItem') return block
    if (type === 'paragraph') return toParagraph(block)
    // Toggle: same heading level → paragraph
    if (block.type === 'heading' && block.level === level) return toParagraph(block)
    return { id: block.id, type: 'heading', level, children: block.children }
  })

  return { doc: newDoc, selection: sel }
}

// ── toggleList ────────────────────────────────────────────────────────────────

export function toggleList(doc: DocumentNode, sel: ASTSelection, ordered: boolean): CommandResult {
  const [, , startIdx, endIdx] = blockRangeIdx(doc, sel)

  let allSameList = true
  for (let i = startIdx; i <= endIdx; i++) {
    const b = doc.blocks[i]
    if (b.type !== 'listItem' || b.ordered !== ordered || b.indent !== 0) {
      allSameList = false
      break
    }
  }

  const newDoc = mapBlocksInRange(doc, startIdx, endIdx, (block) =>
    allSameList
      ? toParagraph(block)
      : { id: block.id, type: 'listItem', ordered, indent: 0, children: block.children },
  )
  return { doc: newDoc, selection: sel }
}

// ── insertParagraph (Enter key) ───────────────────────────────────────────────

export function insertParagraph(doc: DocumentNode, sel: ASTSelection): CommandResult {
  if (!isCollapsed(sel)) {
    const deleted = deleteContent(doc, sel)
    return insertParagraph(deleted.doc, deleted.selection)
  }

  const pos = sel.anchor
  const blockIdx = blockIndexOf(doc).get(pos.blockId) ?? -1
  const block = doc.blocks[blockIdx]
  if (!block) return { doc, selection: sel }

  const blocks = [...doc.blocks]

  if (block.type === 'listItem' && isInlineEmpty(block.children)) {
    blocks[blockIdx] = toParagraph(block, [emptyText()])
    return { doc: { type: 'document', blocks }, selection: cursorAtBlock(blocks[blockIdx]) }
  }

  if (isCursorAtBlockStart(sel) && !isCursorAtBlockEnd(doc, sel)) {
    blocks.splice(blockIdx, 0, emptyParagraph())
    return { doc: { type: 'document', blocks }, selection: cursorAtBlock(block) }
  }

  if (isCursorAtBlockEnd(doc, sel)) {
    const newBlock =
      block.type === 'listItem' ? cloneListItem(block, [emptyText()]) : emptyParagraph()
    blocks.splice(blockIdx + 1, 0, newBlock)
    return { doc: { type: 'document', blocks }, selection: cursorAtBlock(newBlock) }
  }

  const { before, after } = splitInlinesAt(block.children, pos.inlineIndex, pos.offset)
  const firstBlock: BlockNode = { ...block, children: before.length ? before : [emptyText()] }
  const afterInlines = after.length ? after : [emptyText()]
  const secondBlock: BlockNode =
    block.type === 'listItem'
      ? cloneListItem(block, afterInlines)
      : { id: generateId(), type: 'paragraph', children: afterInlines }

  blocks.splice(blockIdx, 1, firstBlock, secondBlock)
  return { doc: { type: 'document', blocks }, selection: cursorAtBlock(secondBlock) }
}

// ── insertHardBreak (Shift+Enter) ─────────────────────────────────────────────

export function insertHardBreak(doc: DocumentNode, sel: ASTSelection): CommandResult {
  if (!isCollapsed(sel)) {
    const deleted = deleteContent(doc, sel)
    return insertHardBreak(deleted.doc, deleted.selection)
  }

  const pos = sel.anchor
  const blockIdx = blockIndexOf(doc).get(pos.blockId) ?? -1
  const block = doc.blocks[blockIdx]
  if (!block) return { doc, selection: sel }

  const { before, after } = splitInlinesAt(block.children, pos.inlineIndex, pos.offset)
  const newInlines: InlineNode[] = [
    ...before,
    { type: 'hardBreak' },
    ...(after.length ? after : [emptyText()]),
  ]

  const newBlocks = [...doc.blocks]
  newBlocks[blockIdx] = { ...block, children: newInlines }

  return {
    doc: { type: 'document', blocks: newBlocks },
    selection: collapsedAt({ blockId: block.id, inlineIndex: before.length + 1, offset: 0 }),
  }
}

// ── deleteContent ─────────────────────────────────────────────────────────────

export function deleteContent(doc: DocumentNode, sel: ASTSelection): CommandResult {
  if (isCollapsed(sel)) return { doc, selection: sel }

  const [start, end, startIdx, endIdx] = blockRangeIdx(doc, sel)

  if (startIdx === endIdx) {
    const block = doc.blocks[startIdx]
    const newBlocks = [...doc.blocks]
    newBlocks[startIdx] = { ...block, children: deleteInlineRange(block.children, start, end) }
    return { doc: { type: 'document', blocks: newBlocks }, selection: collapsedAt(start) }
  }

  const blocks = [...doc.blocks]
  const startBlock = blocks[startIdx]
  const endBlock = blocks[endIdx]

  const beforeInlines = startBlock.children.slice(0, start.inlineIndex)
  const startNode = startBlock.children[start.inlineIndex]
  if (startNode?.type === 'text' && start.offset > 0) {
    beforeInlines.push(sliceText(startNode, 0, start.offset))
  }

  const afterInlines: InlineNode[] = []
  const endNode = endBlock.children[end.inlineIndex]
  if (endNode?.type === 'text' && end.offset < endNode.text.length) {
    afterInlines.push(sliceText(endNode, end.offset, endNode.text.length))
  }
  for (let i = end.inlineIndex + 1; i < endBlock.children.length; i++) {
    afterInlines.push(endBlock.children[i])
  }

  // When deletion spans blocks of different types (e.g. paragraph + listItem),
  // the merged block takes the type of the first block — the user started the
  // selection there.
  const merged = [...beforeInlines, ...afterInlines]
  const mergedBlock = withChildren(startBlock, merged.length ? merged : [emptyText()])
  blocks.splice(startIdx, endIdx - startIdx + 1, mergedBlock)

  return { doc: { type: 'document', blocks }, selection: collapsedAt(start) }
}

function sliceText(node: TextNode, s: number, e: number): TextNode {
  return { type: 'text', text: node.text.slice(s, e), marks: [...node.marks] }
}

function deleteInlineRange(
  inlines: InlineNode[],
  start: ASTPosition,
  end: ASTPosition,
): InlineNode[] {
  const result: InlineNode[] = []
  for (let i = 0; i < inlines.length; i++) {
    const node = inlines[i]
    if (i < start.inlineIndex || i > end.inlineIndex) {
      result.push(node)
      continue
    }
    if (node.type !== 'text') continue

    const keepStart = i === start.inlineIndex ? node.text.slice(0, start.offset) : ''
    const keepEnd = i === end.inlineIndex ? node.text.slice(end.offset) : ''
    const text = keepStart + keepEnd
    if (text.length > 0) result.push({ ...node, text })
  }
  return result.length ? result : [emptyText()]
}

// ── Split helpers ─────────────────────────────────────────────────────────────

function splitInlinesAt(
  inlines: InlineNode[],
  inlineIndex: number,
  offset: number,
): { before: InlineNode[]; after: InlineNode[] } {
  const before: InlineNode[] = inlines.slice(0, inlineIndex)
  const after: InlineNode[] = inlines.slice(inlineIndex + 1)

  const node = inlines[inlineIndex]
  if (!node) return { before, after }

  if (node.type === 'hardBreak') {
    if (offset === 0) after.unshift(node)
    else before.push(node)
  } else if (offset === 0) {
    after.unshift(node)
  } else if (offset >= node.text.length) {
    before.push(node)
  } else {
    before.push(sliceText(node, 0, offset))
    after.unshift(sliceText(node, offset, node.text.length))
  }

  return { before, after }
}
