import type { ASTPosition, ASTSelection } from './selection'

// ── Inline DOM node collection ───────────────────────────────────────────────

/**
 * Flattens a block element's inline content into leaf nodes (text nodes and
 * <br> elements) in the same order as the AST's inline array.
 */
function getInlineDOMNodes(containerEl: Element): Node[] {
  const result: Node[] = []
  collect(containerEl, result)
  return result
}

function collect(node: Node, result: Node[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    result.push(node)
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  if ((node as Element).tagName.toLowerCase() === 'br') {
    result.push(node)
    return
  }
  for (const child of Array.from(node.childNodes)) collect(child, result)
}

// ── DOM → AST position ────────────────────────────────────────────────────────

function domPositionToAST(el: HTMLElement, domNode: Node, domOffset: number): ASTPosition | null {
  const { node: textNode, offset } = normalizeToTextPosition(domNode, domOffset)
  if (!el.contains(textNode)) return null

  let current: Node | null = textNode
  while (current && current !== el) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const blockId = (current as HTMLElement).getAttribute('data-block-id')
      if (blockId) {
        const inlineDOMNodes = getInlineDOMNodes(current as HTMLElement)
        const idx = inlineDOMNodes.indexOf(textNode)
        return { blockId, inlineIndex: idx === -1 ? 0 : idx, offset: idx === -1 ? 0 : offset }
      }
    }
    current = current.parentNode
  }
  return null
}

function normalizeToTextPosition(node: Node, offset: number): { node: Node; offset: number } {
  if (node.nodeType === Node.TEXT_NODE) return { node, offset }
  if (node.nodeType !== Node.ELEMENT_NODE) return { node, offset }

  const children = node.childNodes
  if (children.length === 0) return { node, offset: 0 }

  if (offset >= children.length) {
    const last = children[children.length - 1]
    if (last.nodeType === Node.TEXT_NODE) return { node: last, offset: (last as Text).length }
    return normalizeToTextPosition(last, (last as Element).childNodes.length)
  }
  return normalizeToTextPosition(children[offset], 0)
}

// ── AST → DOM position ────────────────────────────────────────────────────────

function astPositionToDOM(
  el: HTMLElement,
  pos: ASTPosition,
): { node: Node; offset: number } | null {
  const blockEl = el.querySelector(`[data-block-id="${pos.blockId}"]`)
  if (!blockEl) return null

  const inlineDOMNodes = getInlineDOMNodes(blockEl)
  if (inlineDOMNodes.length === 0) return { node: blockEl, offset: 0 }

  const target = inlineDOMNodes[pos.inlineIndex] ?? inlineDOMNodes[inlineDOMNodes.length - 1]

  if (target.nodeType === Node.TEXT_NODE) {
    const maxOffset = (target as Text).length
    const effectiveOffset = pos.inlineIndex >= inlineDOMNodes.length ? maxOffset : pos.offset
    return { node: target, offset: Math.min(effectiveOffset, maxOffset) }
  }
  return { node: target, offset: 0 }
}

// ── Read/apply browser selection ──────────────────────────────────────────────

export function readSelection(el: HTMLElement): ASTSelection | null {
  if (typeof window === 'undefined') return null
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null

  const range = sel.getRangeAt(0)
  if (!el.contains(range.commonAncestorContainer)) return null

  const anchor = domPositionToAST(el, range.startContainer, range.startOffset)
  const head = domPositionToAST(el, range.endContainer, range.endOffset)
  if (!anchor || !head) return null

  const isBackwards =
    sel.anchorNode !== null &&
    range.startContainer === sel.focusNode &&
    range.startOffset === sel.focusOffset &&
    !(range.startContainer === sel.anchorNode && range.startOffset === sel.anchorOffset)

  return isBackwards ? { anchor: head, head: anchor } : { anchor, head }
}

export function applySelection(el: HTMLElement, astSel: ASTSelection): boolean {
  if (typeof window === 'undefined') return false

  const start = astPositionToDOM(el, astSel.anchor)
  const end = astPositionToDOM(el, astSel.head)
  if (!start || !end) return false

  try {
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    const sel = window.getSelection()
    if (!sel) return false
    sel.removeAllRanges()
    sel.addRange(range)
    return true
  } catch {
    // Range construction can throw if nodes have been removed from the DOM.
    return false
  }
}
