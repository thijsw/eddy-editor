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

function blockId(el: Element): string {
  return el.getAttribute('data-block-id') || generateId()
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

  // Unknown block element — promote children as a paragraph.
  return [{ id: blockId(el), type: 'paragraph', children: parseBlockChildren(el) }]
}

// ── Document parsing ──────────────────────────────────────────────────────────

function parseChildNodes(childNodes: NodeListOf<ChildNode>): DocumentNode {
  const blocks: BlockNode[] = []
  let pending = ''

  function flushPending(): void {
    if (pending === '') return
    if (pending.trim() !== '' || blocks.length === 0) {
      blocks.push({
        id: generateId(),
        type: 'paragraph',
        children: [{ type: 'text', text: pending, marks: [] }],
      })
    }
    pending = ''
  }

  for (const child of childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      pending += child.textContent ?? ''
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      flushPending()
      blocks.push(...parseBlock(child as Element))
    }
  }
  flushPending()

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
