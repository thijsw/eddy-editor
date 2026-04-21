import type { BlockNode, DocumentNode, InlineNode, Mark, TextNode } from './types'
import { generateId, emptyText, emptyParagraph, withChildren } from './types'
import type { ASTPosition, ASTSelection } from './selection'
import { blockIndexOf, collapsedAt, isCollapsed, normalizeSelection } from './selection'
import { isMarkActive, isCursorAtBlockEnd, isCursorAtBlockStart } from './inspect'
import { attrsEqual } from './schema'

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

// ── Block helpers ─────────────────────────────────────────────────────────────

function cursorAtBlock(block: BlockNode): ASTSelection {
  return collapsedAt({ blockId: block.id, inlineIndex: 0, offset: 0 })
}

function toParagraph(block: BlockNode, children = block.children): BlockNode {
  return { id: block.id, type: 'paragraph', attrs: {}, children }
}

function cloneBlock(src: BlockNode, children: InlineNode[]): BlockNode {
  return { id: generateId(), type: src.type, attrs: { ...src.attrs }, children }
}

function isInlineEmpty(inlines: InlineNode[]): boolean {
  return (
    inlines.length === 0 ||
    (inlines.length === 1 && inlines[0].type === 'text' && inlines[0].text === '')
  )
}

export function mapBlocksInRange(
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

export function blockRangeIdx(
  doc: DocumentNode,
  sel: ASTSelection,
): [ASTPosition, ASTPosition, number, number] {
  const [start, end] = normalizeSelection(doc, sel)
  const idx = blockIndexOf(doc)
  return [start, end, idx.get(start.blockId) ?? -1, idx.get(end.blockId) ?? -1]
}

// ── toggleMark ────────────────────────────────────────────────────────────────

export function toggleMark(
  doc: DocumentNode,
  sel: ASTSelection,
  mark: string,
  attrs?: Record<string, unknown>,
  excludes?: ReadonlyArray<string>,
): CommandResult {
  if (isCollapsed(sel)) return { doc, selection: sel }

  const active = isMarkActive(doc, sel, mark)
  const [start, end, startIdx, endIdx] = blockRangeIdx(doc, sel)

  const newDoc = mapBlocksInRange(doc, startIdx, endIdx, (block) =>
    applyMarkToBlock(block, start, end, mark, active, attrs, excludes),
  )
  return { doc: newDoc, selection: remapSelection(doc, newDoc, sel) }
}

export function applyMarkToBlock(
  block: BlockNode,
  start: ASTPosition,
  end: ASTPosition,
  mark: string,
  remove: boolean,
  attrs?: Record<string, unknown>,
  excludes?: ReadonlyArray<string>,
): BlockNode {
  const isStartBlock = block.id === start.blockId
  const isEndBlock = block.id === end.blockId
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
      result.push({
        type: 'text',
        text: selectedText,
        marks: nextMarks(node.marks, mark, remove, attrs, excludes),
      })
    }

    if (textEnd < node.text.length) {
      result.push({ type: 'text', text: node.text.slice(textEnd), marks: [...node.marks] })
    }
  }

  return { ...block, children: result }
}

function nextMarks(
  current: Mark[],
  mark: string,
  remove: boolean,
  attrs?: Record<string, unknown>,
  excludes?: ReadonlyArray<string>,
): Mark[] {
  if (remove) return current.filter((m) => m.type !== mark)
  const excluded = excludes && excludes.length > 0 ? new Set(excludes) : null
  const kept = current.filter((m) => m.type !== mark && !(excluded && excluded.has(m.type)))
  const fresh: Mark =
    attrs && Object.keys(attrs).length > 0 ? { type: mark, attrs } : { type: mark }
  return [...kept, fresh]
}

// ── setBlockType ──────────────────────────────────────────────────────────────

/**
 * Sets the type/attrs of every block in the selection. Per-block toggle: any
 * block already matching `type` + `attrs` reverts to a paragraph. List items
 * are not touched — convert them through toggleList first.
 */
export function setBlockType(
  doc: DocumentNode,
  sel: ASTSelection,
  type: string,
  attrs?: Record<string, unknown>,
): CommandResult {
  const [, , startIdx, endIdx] = blockRangeIdx(doc, sel)
  const target = attrs ?? {}

  const newDoc = mapBlocksInRange(doc, startIdx, endIdx, (block) => {
    if (block.type === 'listItem') return block
    if (type === 'paragraph') return toParagraph(block)
    if (block.type === type && attrsEqual(block.attrs, target)) return toParagraph(block)
    return { id: block.id, type, attrs: { ...target }, children: block.children }
  })

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
    const newBlock = block.type === 'listItem' ? cloneBlock(block, [emptyText()]) : emptyParagraph()
    blocks.splice(blockIdx + 1, 0, newBlock)
    return { doc: { type: 'document', blocks }, selection: cursorAtBlock(newBlock) }
  }

  const { before, after } = splitInlinesAt(block.children, pos.inlineIndex, pos.offset)
  const firstBlock: BlockNode = { ...block, children: before.length ? before : [emptyText()] }
  const afterInlines = after.length ? after : [emptyText()]
  const secondBlock: BlockNode =
    block.type === 'listItem'
      ? cloneBlock(block, afterInlines)
      : { id: generateId(), type: 'paragraph', attrs: {}, children: afterInlines }

  blocks.splice(blockIdx, 1, firstBlock, secondBlock)
  return { doc: { type: 'document', blocks }, selection: cursorAtBlock(secondBlock) }
}

// ── insertDocument (paste) ────────────────────────────────────────────────────

export function insertDocument(
  doc: DocumentNode,
  sel: ASTSelection,
  inserted: DocumentNode,
): CommandResult {
  if (inserted.blocks.length === 0) return { doc, selection: sel }

  if (!isCollapsed(sel)) {
    const cleared = deleteContent(doc, sel)
    return insertDocument(cleared.doc, cleared.selection, inserted)
  }

  const pos = sel.anchor
  const blockIdx = blockIndexOf(doc).get(pos.blockId) ?? -1
  const target = doc.blocks[blockIdx]
  if (!target) return { doc, selection: sel }

  const { before, after } = splitInlinesAt(target.children, pos.inlineIndex, pos.offset)
  const [firstInserted, ...restInserted] = inserted.blocks
  const firstInlines = meaningfulInlines(firstInserted.children)
  const blocks = [...doc.blocks]

  if (restInserted.length === 0) {
    const mergedInlines = [...before, ...firstInlines]
    const combined = [...mergedInlines, ...after]
    blocks[blockIdx] = withChildren(target, combined.length ? combined : [emptyText()])
    return {
      doc: { type: 'document', blocks },
      selection: cursorAt(target.id, endOfInlines(mergedInlines)),
    }
  }

  const firstHead = [...before, ...firstInlines]
  const firstMerged = withChildren(target, firstHead.length ? firstHead : [emptyText()])
  const middleBlocks = restInserted.slice(0, -1).map((b) => ({ ...b, id: generateId() }))
  const lastSrc = restInserted[restInserted.length - 1]
  const lastInlines = meaningfulInlines(lastSrc.children)
  const lastChildren = [...lastInlines, ...after]
  const lastBlock: BlockNode = {
    ...lastSrc,
    id: generateId(),
    children: lastChildren.length ? lastChildren : [emptyText()],
  }

  blocks.splice(blockIdx, 1, firstMerged, ...middleBlocks, lastBlock)
  return {
    doc: { type: 'document', blocks },
    selection: cursorAt(lastBlock.id, endOfInlines(lastInlines)),
  }
}

/** Drop empty text nodes, which carry no meaning when spliced into an existing block. */
function meaningfulInlines(inlines: InlineNode[]): InlineNode[] {
  return inlines.filter((n) => n.type !== 'text' || n.text.length > 0)
}

/** Cursor position at the end of an inline list. Empty list → start of block. */
function endOfInlines(inlines: InlineNode[]): { inlineIndex: number; offset: number } {
  if (inlines.length === 0) return { inlineIndex: 0, offset: 0 }
  const last = inlines[inlines.length - 1]
  return {
    inlineIndex: inlines.length - 1,
    offset: last.type === 'text' ? last.text.length : 1,
  }
}

function cursorAt(blockId: string, at: { inlineIndex: number; offset: number }): ASTSelection {
  return collapsedAt({ blockId, inlineIndex: at.inlineIndex, offset: at.offset })
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
