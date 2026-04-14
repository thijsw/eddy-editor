import type {
  BlockNode,
  DocumentNode,
  HeadingNode,
  InlineNode,
  ListItemNode,
  ListNode,
  Mark,
  MarkType,
  ParagraphNode,
  TextNode,
} from './types'

// ── Mark inference from DOM elements ─────────────────────────────────────────

const MARK_TAGS: Record<string, MarkType> = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  u: 'underline',
  s: 'strikethrough',
  strike: 'strikethrough',
  del: 'strikethrough',
}

function tagToMark(tag: string): MarkType | null {
  return MARK_TAGS[tag.toLowerCase()] ?? null
}

// ── Inline content parsing ────────────────────────────────────────────────────

function parseInline(node: Node, inheritedMarks: Mark[]): InlineNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    if (text === '') return []
    const textNode: TextNode = { type: 'text', text, marks: [...inheritedMarks] }
    return [textNode]
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return []

  const el = node as Element
  const tag = el.tagName.toLowerCase()

  if (tag === 'br') return [{ type: 'hardBreak' }]

  // Collect marks contributed by this element
  const mark = tagToMark(tag)
  const childMarks: Mark[] = mark
    ? addMark(inheritedMarks, { type: mark })
    : inheritedMarks

  // For span (and other transparent inline wrappers), just recurse
  const result: InlineNode[] = []
  const childNodes = Array.from(node.childNodes)
  for (const child of childNodes) {
    result.push(...parseInline(child, childMarks))
  }
  return result
}

function addMark(marks: Mark[], mark: Mark): Mark[] {
  if (marks.some((m) => m.type === mark.type)) return marks
  return [...marks, mark]
}

function parseBlockChildren(el: Element): InlineNode[] {
  const children: InlineNode[] = []
  const childNodes = Array.from(el.childNodes)
  for (const child of childNodes) {
    children.push(...parseInline(child, []))
  }
  return children.length > 0 ? children : [{ type: 'text', text: '', marks: [] }]
}

// ── Block parsing ─────────────────────────────────────────────────────────────

function parseBlock(el: Element): BlockNode[] {
  const tag = el.tagName.toLowerCase()

  if (tag === 'p' || tag === 'div') {
    const para: ParagraphNode = { type: 'paragraph', children: parseBlockChildren(el) }
    return [para]
  }

  const headingMatch = /^h([1-6])$/.exec(tag)
  if (headingMatch) {
    const level = Number(headingMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6
    const heading: HeadingNode = { type: 'heading', level, children: parseBlockChildren(el) }
    return [heading]
  }

  if (tag === 'ul' || tag === 'ol') {
    const items: ListItemNode[] = []
    for (const child of Array.from(el.children)) {
      if (child.tagName.toLowerCase() === 'li') {
        items.push({ type: 'listItem', children: parseBlockChildren(child) })
      }
    }
    if (items.length === 0) return []
    const list: ListNode = { type: 'list', ordered: tag === 'ol', items }
    return [list]
  }

  // Unknown block element — promote children as a paragraph
  const children = parseBlockChildren(el)
  return [{ type: 'paragraph', children }]
}

// ── Document parsing ──────────────────────────────────────────────────────────

/**
 * Parses an HTML string into a DocumentNode.
 * Uses the browser's own HTML parser (via innerHTML on a detached div).
 */
export function parseHTML(html: string): DocumentNode {
  if (typeof document === 'undefined') {
    return { type: 'document', children: [{ type: 'paragraph', children: [{ type: 'text', text: '', marks: [] }] }] }
  }

  const container = document.createElement('div')
  container.innerHTML = html

  const blocks: BlockNode[] = []
  let pendingTextNodes: Node[] = []

  function flushPendingText(): void {
    if (pendingTextNodes.length === 0) return
    const text = pendingTextNodes.map((n) => n.textContent ?? '').join('')
    if (text.trim() !== '' || blocks.length === 0) {
      blocks.push({ type: 'paragraph', children: [{ type: 'text', text, marks: [] }] })
    }
    pendingTextNodes = []
  }

  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      pendingTextNodes.push(child)
      continue
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      flushPendingText()
      blocks.push(...parseBlock(child as Element))
    }
  }

  flushPendingText()

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', children: [{ type: 'text', text: '', marks: [] }] })
  }

  return { type: 'document', children: blocks }
}

/**
 * Parses the live DOM of the editor element into a DocumentNode.
 * Equivalent to parseHTML(el.innerHTML) but avoids the innerHTML serialization round-trip.
 */
export function parseLiveDOM(el: HTMLElement): DocumentNode {
  const blocks: BlockNode[] = []
  let pendingTextNodes: Node[] = []

  function flushPendingText(): void {
    if (pendingTextNodes.length === 0) return
    const text = pendingTextNodes.map((n) => n.textContent ?? '').join('')
    if (text.trim() !== '' || blocks.length === 0) {
      blocks.push({ type: 'paragraph', children: [{ type: 'text', text, marks: [] }] })
    }
    pendingTextNodes = []
  }

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      pendingTextNodes.push(child)
      continue
    }
    if (child.nodeType === Node.ELEMENT_NODE) {
      flushPendingText()
      blocks.push(...parseBlock(child as Element))
    }
  }

  flushPendingText()

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', children: [{ type: 'text', text: '', marks: [] }] })
  }

  return { type: 'document', children: blocks }
}
