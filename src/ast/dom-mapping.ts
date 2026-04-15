import type { DocumentNode } from './types'
import type { ASTPosition, ASTSelection } from './selection'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * For a block element, returns its inline DOM children as an array of nodes
 * (Text and <br> elements).
 */
function getInlineDOMNodes(containerEl: Element): Node[] {
  const result: Node[] = []
  collectInlineDOMNodes(containerEl, result)
  return result
}

function collectInlineDOMNodes(node: Node, result: Node[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    result.push(node)
    return
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (tag === 'br') {
      result.push(node)
      return
    }
    // For inline wrappers (strong, em, u, s, span, etc.) recurse
    for (const child of Array.from(node.childNodes)) {
      collectInlineDOMNodes(child, result)
    }
  }
}

// ── DOM → AST position ────────────────────────────────────────────────────────

/**
 * Converts a browser (Node, offset) pair to an ASTPosition.
 *
 * The key insight: we always normalize to the deepest text node position.
 * If domNode is an Element and domOffset points before a child element,
 * we walk into that child to find its first text node.
 *
 * This resolves the (elementNode, 0) vs (firstTextNode, 0) ambiguity.
 */
// Relies on DOM block elements (el.children) being 1:1 with doc.children.
// This invariant is maintained by _renderDOM() which sets innerHTML from
// the serialized AST, so block element indices always match AST block indices.
export function domPositionToAST(
  el: HTMLElement,
  doc: DocumentNode,
  domNode: Node,
  domOffset: number,
): ASTPosition | null {
  // Normalize element positions to text node positions
  const { node: textNode, offset } = normalizeToTextPosition(domNode, domOffset)

  if (!el.contains(textNode)) return null

  // Find which top-level block element contains this node
  const blockEls = Array.from(el.children)
  for (let blockIndex = 0; blockIndex < blockEls.length; blockIndex++) {
    const blockEl = blockEls[blockIndex]
    if (!blockEl.contains(textNode) && blockEl !== textNode) continue

    const block = doc.children[blockIndex]
    if (!block) return null

    if (block.type === 'list') {
      // Find which list item contains the node
      const liEls = Array.from(blockEl.children).filter(
        (c) => c.tagName.toLowerCase() === 'li',
      )
      for (let itemIndex = 0; itemIndex < liEls.length; itemIndex++) {
        const liEl = liEls[itemIndex]
        if (!liEl.contains(textNode) && liEl !== textNode) continue
        const pos = findInlinePosition(liEl, blockIndex, itemIndex, textNode, offset)
        return pos
      }
    } else {
      const pos = findInlinePosition(blockEl, blockIndex, 0, textNode, offset)
      return pos
    }
  }

  return null
}

/**
 * Given a container element and a target text/br node inside it,
 * finds the inlineIndex and offset.
 */
function findInlinePosition(
  containerEl: Element,
  blockIndex: number,
  itemIndex: number,
  targetNode: Node,
  offset: number,
): ASTPosition | null {
  const inlineDOMNodes = getInlineDOMNodes(containerEl)

  for (let inlineIndex = 0; inlineIndex < inlineDOMNodes.length; inlineIndex++) {
    const domNode = inlineDOMNodes[inlineIndex]
    if (domNode === targetNode) {
      return { blockIndex, itemIndex, inlineIndex, offset }
    }
  }

  // If no inline nodes found (empty block), return position 0
  return { blockIndex, itemIndex, inlineIndex: 0, offset: 0 }
}

/**
 * Normalizes a (Node, offset) pair to the deepest (TextNode | <br>, offset).
 *
 * If node is already a text node, returns as-is.
 * If node is an element with offset pointing to a child, walks into that child.
 * Handles the case where offset equals childNodes.length (end of element).
 */
function normalizeToTextPosition(
  node: Node,
  offset: number,
): { node: Node; offset: number } {
  if (node.nodeType === Node.TEXT_NODE) {
    return { node, offset }
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const children = node.childNodes
    if (children.length === 0) {
      // Empty element — return the element itself at 0
      return { node, offset: 0 }
    }

    if (offset >= children.length) {
      // Past last child — normalize to end of last child
      const last = children[children.length - 1]
      if (last.nodeType === Node.TEXT_NODE) {
        return { node: last, offset: (last as Text).length }
      }
      return normalizeToTextPosition(last, (last as Element).childNodes.length)
    }

    const target = children[offset]
    return normalizeToTextPosition(target, 0)
  }

  return { node, offset }
}

// ── AST → DOM position ────────────────────────────────────────────────────────

/**
 * Converts an ASTPosition to a (Node, offset) pair for constructing a Range.
 * Looks up nodes by structural index — safe to call after an innerHTML re-render.
 */
export function astPositionToDOM(
  el: HTMLElement,
  doc: DocumentNode,
  pos: ASTPosition,
): { node: Node; offset: number } | null {
  const blockEl = el.children[pos.blockIndex]
  if (!blockEl) return null

  const block = doc.children[pos.blockIndex]
  if (!block) return null

  let containerEl: Element = blockEl

  if (block.type === 'list') {
    const liEls = Array.from(blockEl.children).filter(
      (c) => c.tagName.toLowerCase() === 'li',
    )
    const liEl = liEls[pos.itemIndex]
    if (!liEl) return null
    containerEl = liEl
  }

  const inlineDOMNodes = getInlineDOMNodes(containerEl)

  if (inlineDOMNodes.length === 0) {
    // Empty container — position at start of container
    return { node: containerEl, offset: 0 }
  }

  const targetNode = inlineDOMNodes[pos.inlineIndex]
  if (!targetNode) {
    // inlineIndex out of bounds — clamp to end of last node
    const last = inlineDOMNodes[inlineDOMNodes.length - 1]
    if (last.nodeType === Node.TEXT_NODE) {
      return { node: last, offset: (last as Text).length }
    }
    return { node: last, offset: 0 }
  }

  if (targetNode.nodeType === Node.TEXT_NODE) {
    const maxOffset = (targetNode as Text).length
    return { node: targetNode, offset: Math.min(pos.offset, maxOffset) }
  }

  // HardBreak <br>
  return { node: targetNode, offset: 0 }
}

// ── Read/apply browser selection ──────────────────────────────────────────────

/**
 * Reads the browser's current selection and converts it to an ASTSelection.
 * Returns null if there is no selection or it falls outside el.
 */
export function readSelection(
  el: HTMLElement,
  doc: DocumentNode,
): ASTSelection | null {
  if (typeof window === 'undefined') return null
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null

  const range = sel.getRangeAt(0)

  // Bail if the selection is outside the editor
  if (!el.contains(range.commonAncestorContainer)) return null

  const anchor = domPositionToAST(el, doc, range.startContainer, range.startOffset)
  const head = domPositionToAST(el, doc, range.endContainer, range.endOffset)

  if (!anchor || !head) return null

  // Detect backwards selection
  const isBackwards =
    sel.anchorNode !== null &&
    range.startContainer === sel.focusNode &&
    range.startOffset === sel.focusOffset &&
    !(range.startContainer === sel.anchorNode && range.startOffset === sel.anchorOffset)

  if (isBackwards) {
    return { anchor: head, head: anchor }
  }

  return { anchor, head }
}

/**
 * Applies an ASTSelection to the browser by constructing a Range from
 * the AST coordinates and setting it on the window selection.
 */
export function applySelection(
  el: HTMLElement,
  doc: DocumentNode,
  astSel: ASTSelection,
): void {
  if (typeof window === 'undefined') return

  const start = astPositionToDOM(el, doc, astSel.anchor)
  const end = astPositionToDOM(el, doc, astSel.head)
  if (!start || !end) return

  try {
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)

    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    sel.addRange(range)
  } catch {
    // Range construction can throw if nodes have been removed from the DOM
  }
}

