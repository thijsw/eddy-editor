import type {
  BlockNode,
  DocumentNode,
  InlineNode,
  ListItemNode,
  ListNode,
  Mark,
  MarkType,
  ParagraphNode,
  TextNode,
} from './types'
import type { ASTPosition, ASTSelection } from './selection'
import { collapsedAt, isCollapsed, normalizeSelection } from './selection'
import { isMarkActive, isCursorAtBlockEnd, isCursorAtBlockStart } from './inspect'

// ── Command result ────────────────────────────────────────────────────────────

export interface CommandResult {
  doc: DocumentNode
  selection: ASTSelection
}

// ── Position remapping ────────────────────────────────────────────────────────

/**
 * Converts an inline position (inlineIndex + offset) to a flat character
 * offset within an inlines array, then resolves it back to (inlineIndex, offset)
 * in a new inlines array. Text content is the same, only node boundaries differ.
 */
/**
 * Remaps every position in a selection from oldDoc's inline structure
 * to newDoc's inline structure. Used after transforms that change node
 * boundaries (mark splits, schema merges) but preserve text content.
 */
export function remapSelection(
  oldDoc: DocumentNode,
  newDoc: DocumentNode,
  sel: ASTSelection,
): ASTSelection {
  let anchor = sel.anchor
  let head = sel.head
  for (let blockIndex = 0; blockIndex < oldDoc.children.length && blockIndex < newDoc.children.length; blockIndex++) {
    const oldBlock = oldDoc.children[blockIndex]
    const newBlock = newDoc.children[blockIndex]
    if (!oldBlock || !newBlock) continue
    if (oldBlock.type === 'list' && newBlock.type === 'list') {
      for (let itemIndex = 0; itemIndex < oldBlock.items.length && itemIndex < newBlock.items.length; itemIndex++) {
        anchor = remapPosition(oldBlock.items[itemIndex].children, newBlock.items[itemIndex].children, anchor, blockIndex, itemIndex)
        head = remapPosition(oldBlock.items[itemIndex].children, newBlock.items[itemIndex].children, head, blockIndex, itemIndex)
      }
    } else if (oldBlock.type !== 'list' && newBlock.type !== 'list') {
      anchor = remapPosition(oldBlock.children, newBlock.children, anchor, blockIndex, 0)
      head = remapPosition(oldBlock.children, newBlock.children, head, blockIndex, 0)
    }
  }
  return { anchor, head }
}

function remapPosition(
  oldInlines: InlineNode[],
  newInlines: InlineNode[],
  pos: ASTPosition,
  blockIndex: number,
  itemIndex: number,
): ASTPosition {
  if (pos.blockIndex !== blockIndex || pos.itemIndex !== itemIndex) return pos

  // Convert to flat character offset in old inlines
  let charOffset = 0
  for (let i = 0; i < pos.inlineIndex && i < oldInlines.length; i++) {
    const node = oldInlines[i]
    charOffset += node.type === 'text' ? node.text.length : 1
  }
  charOffset += pos.offset

  // Resolve flat offset to (inlineIndex, offset) in new inlines
  let remaining = charOffset
  for (let i = 0; i < newInlines.length; i++) {
    const node = newInlines[i]
    const len = node.type === 'text' ? node.text.length : 1
    if (remaining <= len) {
      return { blockIndex, itemIndex, inlineIndex: i, offset: remaining }
    }
    remaining -= len
  }

  // Past end — clamp to end of last node
  const last = newInlines.length - 1
  const lastNode = newInlines[last]
  return {
    blockIndex,
    itemIndex,
    inlineIndex: Math.max(0, last),
    offset: lastNode?.type === 'text' ? lastNode.text.length : 0,
  }
}

// ── Inline helpers ────────────────────────────────────────────────────────────

function splitTextAt(node: TextNode, offset: number): [TextNode, TextNode] {
  return [
    { type: 'text', text: node.text.slice(0, offset), marks: [...node.marks] },
    { type: 'text', text: node.text.slice(offset), marks: [...node.marks] },
  ]
}

function addMarkToNode(node: TextNode, mark: MarkType): TextNode {
  if (node.marks.some((m) => m.type === mark)) return node
  return { ...node, marks: [...node.marks, { type: mark }] }
}

function removeMarkFromNode(node: TextNode, mark: MarkType): TextNode {
  const filtered = node.marks.filter((m) => m.type !== mark)
  if (filtered.length === node.marks.length) return node
  return { ...node, marks: filtered }
}

function getInlines(doc: DocumentNode, blockIndex: number, itemIndex: number): InlineNode[] {
  const block = doc.children[blockIndex]
  if (!block) return []
  if (block.type === 'list') return block.items[itemIndex]?.children ?? []
  return block.children
}

function setInlines(
  doc: DocumentNode,
  blockIndex: number,
  itemIndex: number,
  newInlines: InlineNode[],
): DocumentNode {
  const children = [...doc.children]
  const block = children[blockIndex]
  if (!block) return doc

  if (block.type === 'list') {
    const items = [...block.items]
    items[itemIndex] = { ...items[itemIndex], children: newInlines }
    children[blockIndex] = { ...block, items }
  } else {
    children[blockIndex] = { ...block, children: newInlines }
  }
  return { type: 'document', children }
}

// ── toggleMark ────────────────────────────────────────────────────────────────

export function toggleMark(
  doc: DocumentNode,
  sel: ASTSelection,
  mark: MarkType,
): CommandResult {
  if (isCollapsed(sel)) {
    return { doc, selection: sel }
  }

  const active = isMarkActive(doc, sel, mark)
  const [start, end] = normalizeSelection(sel)

  let newDoc = doc
  for (let blockIndex = start.blockIndex; blockIndex <= end.blockIndex; blockIndex++) {
    const block = newDoc.children[blockIndex]
    if (!block) continue

    if (block.type === 'list') {
      const startItem = blockIndex === start.blockIndex ? start.itemIndex : 0
      const endItem = blockIndex === end.blockIndex ? end.itemIndex : block.items.length - 1
      for (let itemIndex = startItem; itemIndex <= endItem; itemIndex++) {
        newDoc = applyMarkToInlines(newDoc, blockIndex, itemIndex, start, end, mark, active)
      }
    } else {
      newDoc = applyMarkToInlines(newDoc, blockIndex, 0, start, end, mark, active)
    }
  }

  // Remap selection through the changed inline structure.
  // Text splits change node boundaries but not character content,
  // so flat character offsets are stable across the transform.
  let newAnchor = sel.anchor
  let newHead = sel.head
  for (let blockIndex = start.blockIndex; blockIndex <= end.blockIndex; blockIndex++) {
    const block = newDoc.children[blockIndex]
    if (!block) continue
    if (block.type === 'list') {
      const startItem = blockIndex === start.blockIndex ? start.itemIndex : 0
      const endItem = blockIndex === end.blockIndex ? end.itemIndex : block.items.length - 1
      for (let itemIndex = startItem; itemIndex <= endItem; itemIndex++) {
        const oldInlines = getInlines(doc, blockIndex, itemIndex)
        const newInlines = getInlines(newDoc, blockIndex, itemIndex)
        newAnchor = remapPosition(oldInlines, newInlines, newAnchor, blockIndex, itemIndex)
        newHead = remapPosition(oldInlines, newInlines, newHead, blockIndex, itemIndex)
      }
    } else {
      const oldInlines = getInlines(doc, blockIndex, 0)
      const newInlines = getInlines(newDoc, blockIndex, 0)
      newAnchor = remapPosition(oldInlines, newInlines, newAnchor, blockIndex, 0)
      newHead = remapPosition(oldInlines, newInlines, newHead, blockIndex, 0)
    }
  }

  return { doc: newDoc, selection: { anchor: newAnchor, head: newHead } }
}

function applyMarkToInlines(
  doc: DocumentNode,
  blockIndex: number,
  itemIndex: number,
  start: ASTPosition,
  end: ASTPosition,
  mark: MarkType,
  remove: boolean,
): DocumentNode {
  const inlines = getInlines(doc, blockIndex, itemIndex)
  const result: InlineNode[] = []

  for (let i = 0; i < inlines.length; i++) {
    const node = inlines[i]
    if (node.type !== 'text') {
      result.push(node)
      continue
    }

    // Determine if this text node is within the selection
    const isFirstNode = blockIndex === start.blockIndex && itemIndex === start.itemIndex && i === start.inlineIndex
    const isLastNode = blockIndex === end.blockIndex && itemIndex === end.itemIndex && i === end.inlineIndex
    const isBeforeStart = blockIndex < start.blockIndex ||
      (blockIndex === start.blockIndex && itemIndex < start.itemIndex) ||
      (blockIndex === start.blockIndex && itemIndex === start.itemIndex && i < start.inlineIndex)
    const isAfterEnd = blockIndex > end.blockIndex ||
      (blockIndex === end.blockIndex && itemIndex > end.itemIndex) ||
      (blockIndex === end.blockIndex && itemIndex === end.itemIndex && i > end.inlineIndex)

    if (isBeforeStart || isAfterEnd) {
      result.push(node)
      continue
    }

    const textStart = isFirstNode ? start.offset : 0
    const textEnd = isLastNode ? end.offset : node.text.length

    // Split node into: before-selection, within-selection, after-selection
    if (textStart > 0) {
      result.push({ type: 'text', text: node.text.slice(0, textStart), marks: [...node.marks] })
    }

    const selectedText = node.text.slice(textStart, textEnd)
    if (selectedText.length > 0) {
      const modified = remove
        ? removeMarkFromNode({ type: 'text', text: selectedText, marks: [...node.marks] }, mark)
        : addMarkToNode({ type: 'text', text: selectedText, marks: [...node.marks] }, mark)
      result.push(modified)
    }

    if (textEnd < node.text.length) {
      result.push({ type: 'text', text: node.text.slice(textEnd), marks: [...node.marks] })
    }
  }

  return setInlines(doc, blockIndex, itemIndex, result)
}

// ── setBlockType ──────────────────────────────────────────────────────────────

export function setBlockType(
  doc: DocumentNode,
  sel: ASTSelection,
  type: 'paragraph' | 'heading',
  attrs?: { level?: 1 | 2 | 3 | 4 | 5 | 6 },
): CommandResult {
  const [start, end] = normalizeSelection(sel)
  const children = [...doc.children]

  for (let i = start.blockIndex; i <= end.blockIndex; i++) {
    const block = children[i]
    if (!block) continue

    // Skip lists — setBlockType doesn't apply to list nodes
    if (block.type === 'list') continue

    if (type === 'paragraph') {
      if (block.type !== 'paragraph') {
        children[i] = { type: 'paragraph', children: block.children }
      }
    } else if (type === 'heading') {
      const level = attrs?.level ?? 1
      // Toggle: if already this heading level, convert to paragraph
      if (block.type === 'heading' && block.level === level) {
        children[i] = { type: 'paragraph', children: block.children }
      } else {
        children[i] = { type: 'heading', level, children: block.children }
      }
    }
  }

  return { doc: { type: 'document', children }, selection: sel }
}

// ── toggleList ────────────────────────────────────────────────────────────────

export function toggleList(
  doc: DocumentNode,
  sel: ASTSelection,
  ordered: boolean,
): CommandResult {
  const [start, end] = normalizeSelection(sel)

  // Check if all selected blocks are already this list type
  let allSameList = true
  for (let i = start.blockIndex; i <= end.blockIndex; i++) {
    const block = doc.children[i]
    if (!block || block.type !== 'list' || block.ordered !== ordered) {
      allSameList = false
      break
    }
  }

  const children = [...doc.children]

  if (allSameList) {
    // Toggle off: unwrap list items to paragraphs
    const newBlocks: BlockNode[] = []
    for (let i = 0; i < children.length; i++) {
      if (i >= start.blockIndex && i <= end.blockIndex) {
        const block = children[i]
        if (block.type === 'list') {
          for (const item of block.items) {
            newBlocks.push({ type: 'paragraph', children: item.children })
          }
        } else {
          newBlocks.push(block)
        }
      } else {
        newBlocks.push(children[i])
      }
    }

    // Adjust selection: blocks expanded from list items
    const newSel = adjustSelectionForListUnwrap(sel, doc, start, end)
    return { doc: { type: 'document', children: newBlocks }, selection: newSel }
  }

  // Toggle on: wrap selected blocks as list items
  const items: ListItemNode[] = []
  for (let i = start.blockIndex; i <= end.blockIndex; i++) {
    const block = children[i]
    if (!block) continue
    if (block.type === 'list') {
      // Already a list — convert its items
      for (const item of block.items) {
        items.push(item)
      }
    } else {
      items.push({ type: 'listItem', children: block.children })
    }
  }

  const listNode: ListNode = { type: 'list', ordered, items }
  const newChildren: BlockNode[] = [
    ...children.slice(0, start.blockIndex),
    listNode,
    ...children.slice(end.blockIndex + 1),
  ]

  // Adjust selection for the collapsed blocks
  const newAnchor: ASTPosition = {
    blockIndex: start.blockIndex,
    itemIndex: sel.anchor.blockIndex - start.blockIndex,
    inlineIndex: sel.anchor.inlineIndex,
    offset: sel.anchor.offset,
  }
  const newHead: ASTPosition = {
    blockIndex: start.blockIndex,
    itemIndex: sel.head.blockIndex - start.blockIndex,
    inlineIndex: sel.head.inlineIndex,
    offset: sel.head.offset,
  }

  return {
    doc: { type: 'document', children: newChildren },
    selection: { anchor: newAnchor, head: newHead },
  }
}

function adjustSelectionForListUnwrap(
  sel: ASTSelection,
  doc: DocumentNode,
  start: ASTPosition,
  end: ASTPosition,
): ASTSelection {
  // When unwrapping lists, each list item becomes a separate block.
  // We need to adjust the block indices.
  function adjustPosition(pos: ASTPosition): ASTPosition {
    if (pos.blockIndex < start.blockIndex) return pos

    // Count how many blocks are before this position
    let blockOffset = 0
    for (let i = start.blockIndex; i <= Math.min(pos.blockIndex, end.blockIndex); i++) {
      const block = doc.children[i]
      if (block?.type === 'list' && i < pos.blockIndex) {
        blockOffset += block.items.length - 1
      }
    }

    const block = doc.children[pos.blockIndex]
    if (block?.type === 'list') {
      return {
        blockIndex: pos.blockIndex + blockOffset + pos.itemIndex,
        itemIndex: 0,
        inlineIndex: pos.inlineIndex,
        offset: pos.offset,
      }
    }

    return { ...pos, blockIndex: pos.blockIndex + blockOffset }
  }

  return { anchor: adjustPosition(sel.anchor), head: adjustPosition(sel.head) }
}

// ── insertParagraph (Enter key) ───────────────────────────────────────────────

export function insertParagraph(
  doc: DocumentNode,
  sel: ASTSelection,
): CommandResult {
  // If selection is not collapsed, delete the selected content first
  if (!isCollapsed(sel)) {
    const deleted = deleteContent(doc, sel)
    return insertParagraph(deleted.doc, deleted.selection)
  }

  const pos = sel.anchor
  const block = doc.children[pos.blockIndex]
  if (!block) return { doc, selection: sel }

  if (block.type === 'list') {
    return splitListItem(doc, sel)
  }

  const atStart = isCursorAtBlockStart(sel)
  const atEnd = isCursorAtBlockEnd(doc, sel)
  const children = [...doc.children]
  const inlines = block.children

  if (atStart && !atEnd) {
    // Insert empty paragraph BEFORE current block; cursor goes into the new paragraph.
    // This matches browser behaviour where Enter at position 0 of a heading
    // inserts blank line above and leaves heading content below.
    const emptyPara: ParagraphNode = {
      type: 'paragraph',
      children: [{ type: 'text', text: '', marks: [] }],
    }
    children.splice(pos.blockIndex, 0, emptyPara)

    const newSel = collapsedAt({
      blockIndex: pos.blockIndex,
      itemIndex: 0,
      inlineIndex: 0,
      offset: 0,
    })
    return { doc: { type: 'document', children }, selection: newSel }
  }

  if (atEnd) {
    // Insert empty paragraph AFTER current block; cursor goes to it
    const emptyPara: ParagraphNode = {
      type: 'paragraph',
      children: [{ type: 'text', text: '', marks: [] }],
    }
    children.splice(pos.blockIndex + 1, 0, emptyPara)
    const newSel = collapsedAt({
      blockIndex: pos.blockIndex + 1,
      itemIndex: 0,
      inlineIndex: 0,
      offset: 0,
    })
    return { doc: { type: 'document', children }, selection: newSel }
  }

  // Middle of block: split the inline content at cursor position
  const { before, after } = splitInlinesAt(inlines, pos.inlineIndex, pos.offset)

  // First block keeps content before cursor
  const firstBlock: BlockNode = { ...block, children: before.length > 0 ? before : [{ type: 'text', text: '', marks: [] }] }

  // Second block is always a paragraph (even if first was heading)
  const secondBlock: ParagraphNode = {
    type: 'paragraph',
    children: after.length > 0 ? after : [{ type: 'text', text: '', marks: [] }],
  }

  children.splice(pos.blockIndex, 1, firstBlock, secondBlock)

  const newSel = collapsedAt({
    blockIndex: pos.blockIndex + 1,
    itemIndex: 0,
    inlineIndex: 0,
    offset: 0,
  })

  return { doc: { type: 'document', children }, selection: newSel }
}

function splitListItem(doc: DocumentNode, sel: ASTSelection): CommandResult {
  const pos = sel.anchor
  const block = doc.children[pos.blockIndex] as ListNode
  const item = block.items[pos.itemIndex]
  if (!item) return { doc, selection: sel }

  // If list item is empty, exit the list: convert to paragraph
  const isEmpty =
    item.children.length === 0 ||
    (item.children.length === 1 &&
      item.children[0].type === 'text' &&
      item.children[0].text === '')

  if (isEmpty) {
    const children = [...doc.children]
    const items = [...block.items]
    items.splice(pos.itemIndex, 1)

    const newPara: ParagraphNode = {
      type: 'paragraph',
      children: [{ type: 'text', text: '', marks: [] }],
    }

    if (items.length === 0) {
      // Replace entire list with paragraph
      children[pos.blockIndex] = newPara
    } else if (pos.itemIndex === 0) {
      // First item — insert paragraph before list
      children[pos.blockIndex] = { ...block, items }
      children.splice(pos.blockIndex, 0, newPara)
    } else if (pos.itemIndex >= block.items.length - 1) {
      // Last item — insert paragraph after list
      children[pos.blockIndex] = { ...block, items }
      children.splice(pos.blockIndex + 1, 0, newPara)
    } else {
      // Middle — split list around this item
      const beforeItems = items.slice(0, pos.itemIndex)
      const afterItems = items.slice(pos.itemIndex)
      const parts: BlockNode[] = []
      if (beforeItems.length > 0) parts.push({ ...block, items: beforeItems })
      parts.push(newPara)
      if (afterItems.length > 0) parts.push({ ...block, items: afterItems })
      children.splice(pos.blockIndex, 1, ...parts)
    }

    // Find the paragraph we just inserted
    let newBlockIndex = pos.blockIndex
    if (pos.itemIndex > 0 && items.length > 0) {
      // If there's a list before the paragraph, the paragraph is after it
      newBlockIndex = pos.blockIndex + 1
    }

    return {
      doc: { type: 'document', children },
      selection: collapsedAt({ blockIndex: newBlockIndex, itemIndex: 0, inlineIndex: 0, offset: 0 }),
    }
  }

  // Non-empty item: split the list item at cursor position
  const { before, after } = splitInlinesAt(item.children, pos.inlineIndex, pos.offset)
  const items = [...block.items]
  items.splice(pos.itemIndex, 1, {
    type: 'listItem',
    children: before.length > 0 ? before : [{ type: 'text', text: '', marks: [] }],
  }, {
    type: 'listItem',
    children: after.length > 0 ? after : [{ type: 'text', text: '', marks: [] }],
  })

  const children = [...doc.children]
  children[pos.blockIndex] = { ...block, items }

  return {
    doc: { type: 'document', children },
    selection: collapsedAt({
      blockIndex: pos.blockIndex,
      itemIndex: pos.itemIndex + 1,
      inlineIndex: 0,
      offset: 0,
    }),
  }
}

// ── insertHardBreak (Shift+Enter) ─────────────────────────────────────────────

export function insertHardBreak(
  doc: DocumentNode,
  sel: ASTSelection,
): CommandResult {
  if (!isCollapsed(sel)) {
    const deleted = deleteContent(doc, sel)
    return insertHardBreak(deleted.doc, deleted.selection)
  }

  const pos = sel.anchor
  const inlines = getInlines(doc, pos.blockIndex, pos.itemIndex)
  const { before, after } = splitInlinesAt(inlines, pos.inlineIndex, pos.offset)

  const emptyText: InlineNode = { type: 'text', text: '', marks: [] }
  const br: InlineNode = { type: 'hardBreak' }
  const newInlines: InlineNode[] = [
    ...before,
    br,
    ...(after.length > 0 ? after : [emptyText]),
  ]

  const newDoc = setInlines(doc, pos.blockIndex, pos.itemIndex, newInlines)
  const newSel = collapsedAt({
    blockIndex: pos.blockIndex,
    itemIndex: pos.itemIndex,
    inlineIndex: before.length + 1,
    offset: 0,
  })

  return { doc: newDoc, selection: newSel }
}

// ── deleteContent ─────────────────────────────────────────────────────────────

export function deleteContent(
  doc: DocumentNode,
  sel: ASTSelection,
): CommandResult {
  if (isCollapsed(sel)) return { doc, selection: sel }

  const [start, end] = normalizeSelection(sel)

  // Simple case: selection within a single block and item
  if (start.blockIndex === end.blockIndex && start.itemIndex === end.itemIndex) {
    const inlines = getInlines(doc, start.blockIndex, start.itemIndex)
    const result = deleteInlineRange(inlines, start, end)
    const newDoc = setInlines(doc, start.blockIndex, start.itemIndex, result)
    return { doc: newDoc, selection: collapsedAt(start) }
  }

  // Multi-block: keep content before start in first block, content after end in last block,
  // remove everything in between
  const children = [...doc.children]

  // Get the surviving inlines from start and end blocks
  const startInlines = getInlines(doc, start.blockIndex, start.itemIndex)
  const endInlines = getInlines(doc, end.blockIndex, end.itemIndex)

  const beforeCursor = startInlines.slice(0, start.inlineIndex)
  const startNode = startInlines[start.inlineIndex]
  if (startNode?.type === 'text' && start.offset > 0) {
    beforeCursor.push({ type: 'text', text: startNode.text.slice(0, start.offset), marks: [...startNode.marks] })
  }

  const afterCursor: InlineNode[] = []
  const endNode = endInlines[end.inlineIndex]
  if (endNode?.type === 'text' && end.offset < endNode.text.length) {
    afterCursor.push({ type: 'text', text: endNode.text.slice(end.offset), marks: [...endNode.marks] })
  }
  for (let i = end.inlineIndex + 1; i < endInlines.length; i++) {
    afterCursor.push(endInlines[i])
  }

  const mergedInlines = [...beforeCursor, ...afterCursor]
  const finalInlines = mergedInlines.length > 0 ? mergedInlines : [{ type: 'text' as const, text: '', marks: [] as Mark[] }]

  // Build the merged block (keep the type of the first block)
  const firstBlock = children[start.blockIndex]
  let mergedBlock: BlockNode
  if (firstBlock.type === 'list') {
    // Merge into the first list item
    const items = [...(firstBlock as ListNode).items]
    items[start.itemIndex] = { type: 'listItem', children: finalInlines }
    // Remove any items after start.itemIndex
    items.splice(start.itemIndex + 1)
    mergedBlock = { ...firstBlock, items }
  } else {
    mergedBlock = { ...firstBlock, children: finalInlines }
  }

  // Replace the block range with the merged block
  children.splice(start.blockIndex, end.blockIndex - start.blockIndex + 1, mergedBlock)

  return {
    doc: { type: 'document', children },
    selection: collapsedAt(start),
  }
}

function deleteInlineRange(
  inlines: InlineNode[],
  start: ASTPosition,
  end: ASTPosition,
): InlineNode[] {
  const result: InlineNode[] = []

  for (let i = 0; i < inlines.length; i++) {
    if (i < start.inlineIndex || i > end.inlineIndex) {
      result.push(inlines[i])
      continue
    }

    const node = inlines[i]
    if (node.type !== 'text') continue

    if (i === start.inlineIndex && i === end.inlineIndex) {
      // Same node — remove text between start.offset and end.offset
      const text = node.text.slice(0, start.offset) + node.text.slice(end.offset)
      if (text.length > 0) result.push({ ...node, text })
    } else if (i === start.inlineIndex) {
      const text = node.text.slice(0, start.offset)
      if (text.length > 0) result.push({ ...node, text })
    } else if (i === end.inlineIndex) {
      const text = node.text.slice(end.offset)
      if (text.length > 0) result.push({ ...node, text })
    }
    // Nodes between start and end are fully removed
  }

  if (result.length === 0) {
    result.push({ type: 'text', text: '', marks: [] })
  }

  return result
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
    if (offset === 0) {
      after.unshift(node)
    } else {
      before.push(node)
    }
    return { before, after }
  }

  // Text node: split at offset
  if (offset === 0) {
    after.unshift(node)
  } else if (offset >= node.text.length) {
    before.push(node)
  } else {
    const [left, right] = splitTextAt(node, offset)
    before.push(left)
    after.unshift(right)
  }

  return { before, after }
}

// Re-export for EditorAPI
export { isMarkActive } from './inspect'
