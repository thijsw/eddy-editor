// DOM selection ⇄ document positions. A position's offset counts characters
// of text nodes plus one per <br>, inside the element carrying the block id.

import type { Pos, Selection } from './model'

const ID = 'data-block-id'
const blockOf = (n: Node) =>
  (n.nodeType == 1 ? (n as Element) : n.parentElement)?.closest(`[${ID}]`)

function toPos(root: Element, n: Node, o: number): Pos | null {
  let b: Element | null | undefined
  // A boundary between blocks (e.g. after select-all): descend to a leaf.
  while (!(b = blockOf(n)) || !root.contains(b)) {
    const kids = n.childNodes
    if (!kids.length) return null
    const end = o >= kids.length
    n = kids[end ? kids.length - 1 : o]
    o = !end ? 0 : n.nodeType == 3 ? (n as Text).length : n.childNodes.length
  }
  const r = document.createRange()
  r.setStart(b, 0)
  r.setEnd(n, o)
  const f = r.cloneContents()
  return {
    block: b.getAttribute(ID)!,
    offset: f.textContent!.length + f.querySelectorAll('br').length,
  }
}

function fromPos(root: Element, p: Pos): [Node, number] | undefined {
  const b = root.querySelector(`[${ID}="${p.block}"]`)
  if (!b) return
  let left = p.offset
  let n: Node | null
  const w = document.createTreeWalker(b, 5 /* SHOW_ELEMENT | SHOW_TEXT */)
  while ((n = w.nextNode())) {
    if (n.nodeType == 3) {
      if (left <= (n as Text).length) return [n, left]
      left -= (n as Text).length
    } else if (n.nodeName == 'BR' && !left--) {
      return [n.parentNode!, [...n.parentNode!.childNodes].indexOf(n as ChildNode)]
    }
  }
  return [b, b.childNodes.length]
}

export function readSelection(root: Element): Selection | null {
  const s = getSelection()
  const a = s?.anchorNode
  const f = s?.focusNode
  if (!a || !f || !root.contains(a) || !root.contains(f)) return null
  const anchor = toPos(root, a, s!.anchorOffset)
  const head = toPos(root, f, s!.focusOffset)
  return anchor && head && { anchor, head }
}

export function applySelection(root: Element, sel: Selection): void {
  const a = fromPos(root, sel.anchor)
  const h = fromPos(root, sel.head)
  try {
    if (a && h) getSelection()?.setBaseAndExtent(a[0], a[1], h[0], h[1])
  } catch {
    // Node detached mid-update; the next selectionchange resyncs.
  }
}
