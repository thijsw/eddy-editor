import type { BlockNode, DocumentNode, InlineNode, Mark, MarkType } from './types'
import { generateId, emptyText, emptyParagraph } from './types'

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

function isInlineLikeTag(tag: string): boolean {
  return tag === 'br' || tag === 'span' || MARK_TAGS[tag] !== undefined
}

// ── Inline content parsing ────────────────────────────────────────────────────

function parseInline(node: Node, marks: Mark[]): InlineNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    return text === '' ? [] : [{ type: 'text', text, marks: [...marks] }]
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return []

  const tag = (node as Element).tagName.toLowerCase()
  if (tag === 'br') return [{ type: 'hardBreak' }]

  const markType = MARK_TAGS[tag]
  const childMarks =
    markType && !marks.some((m) => m.type === markType) ? [...marks, { type: markType }] : marks

  const result: InlineNode[] = []
  for (const child of node.childNodes) result.push(...parseInline(child, childMarks))
  return result
}

function parseBlockChildren(el: Element): InlineNode[] {
  const children: InlineNode[] = []
  for (const child of el.childNodes) children.push(...parseInline(child, []))
  return children.length > 0 ? children : [emptyText()]
}

// ── Block parsing ─────────────────────────────────────────────────────────────

/**
 * Read an existing data-block-id only if it matches our generator's base36
 * format. Foreign values are rejected — they could otherwise break out of the
 * attribute when serializeToDOMHTML interpolates them into innerHTML.
 */
function blockId(el: Element): string {
  const id = el.getAttribute('data-block-id')
  return id && /^[0-9a-z]+$/.test(id) ? id : generateId()
}

function parseBlock(el: Element, indent = 0): BlockNode[] {
  const tag = el.tagName.toLowerCase()

  if (tag === 'p' || tag === 'div') {
    return [{ id: blockId(el), type: 'paragraph', children: parseBlockChildren(el) }]
  }

  const headingMatch = /^h([1-6])$/.exec(tag)
  if (headingMatch) {
    return [
      {
        id: blockId(el),
        type: 'heading',
        level: Number(headingMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseBlockChildren(el),
      },
    ]
  }

  if (tag === 'ul' || tag === 'ol') {
    const blocks: BlockNode[] = []
    const ordered = tag === 'ol'
    for (const child of el.children) {
      if (child.tagName.toLowerCase() !== 'li') continue
      const itemChildren: InlineNode[] = []
      const nestedBlocks: BlockNode[] = []

      for (const node of child.childNodes) {
        const childTag =
          node.nodeType === Node.ELEMENT_NODE ? (node as Element).tagName.toLowerCase() : ''
        if (childTag === 'ul' || childTag === 'ol') {
          nestedBlocks.push(...parseBlock(node as Element, indent + 1))
        } else {
          itemChildren.push(...parseInline(node, []))
        }
      }

      blocks.push({
        id: blockId(child),
        type: 'listItem',
        ordered,
        indent,
        children: itemChildren.length > 0 ? itemChildren : [emptyText()],
      })
      blocks.push(...nestedBlocks)
    }
    return blocks
  }

  // Drop entirely — these would otherwise leak their source code as visible text.
  if (tag === 'script' || tag === 'style') return []

  // Inline-like at block context — wrap in a paragraph so marks survive.
  if (isInlineLikeTag(tag)) {
    return [{ id: generateId(), type: 'paragraph', children: parseInline(el, []) }]
  }

  // Unknown element — drop the wrapper and recurse children at block level so
  // nested block structure (e.g. <section><h1/><p/></section>) is preserved.
  return unwrapAsBlocks(el.childNodes, indent)
}

// ── Document parsing ──────────────────────────────────────────────────────────

/**
 * Walks a NodeList in block context: nested block elements get parsed
 * standalone; inline content (text, mark tags, br, span) accumulates into a
 * paragraph that's flushed when a block element appears (or at the end).
 */
function unwrapAsBlocks(childNodes: NodeListOf<ChildNode>, indent: number): BlockNode[] {
  const blocks: BlockNode[] = []
  let pending: InlineNode[] = []

  function flush(): void {
    if (pending.length === 0) return
    const isBlank = pending.every((n) => n.type === 'text' && n.text.trim() === '')
    if (!isBlank || blocks.length === 0) {
      blocks.push({ id: generateId(), type: 'paragraph', children: pending })
    }
    pending = []
  }

  for (const node of childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (text === '') continue
      pending.push({ type: 'text', text, marks: [] })
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName.toLowerCase()
      if (isInlineLikeTag(tag)) {
        pending.push(...parseInline(node, []))
      } else {
        flush()
        blocks.push(...parseBlock(node as Element, indent))
      }
    }
  }
  flush()

  return blocks
}

function parseChildNodes(childNodes: NodeListOf<ChildNode>): DocumentNode {
  const blocks = unwrapAsBlocks(childNodes, 0)
  if (blocks.length === 0) blocks.push(emptyParagraph())
  return { type: 'document', blocks }
}

export function parseHTML(html: string): DocumentNode {
  if (typeof document === 'undefined') {
    return { type: 'document', blocks: [emptyParagraph()] }
  }
  const container = document.createElement('div')
  container.innerHTML = html
  return parseChildNodes(container.childNodes)
}

export function parseLiveDOM(el: HTMLElement): DocumentNode {
  return parseChildNodes(el.childNodes)
}
