import type {
  BlockNode,
  DocumentNode,
  InlineNode,
  Mark,
  MarkType,
  TextNode,
} from './types'

// ── Mark → HTML tag ───────────────────────────────────────────────────────────

const MARK_TO_TAG: Record<MarkType, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strikethrough: 's',
}

// Canonical mark order: bold wraps italic wraps underline wraps strikethrough.
const MARK_ORDER: MarkType[] = ['bold', 'italic', 'underline', 'strikethrough']

// ── Inline serialization ──────────────────────────────────────────────────────

function serializeInlines(nodes: InlineNode[]): string {
  // Merge adjacent text nodes with identical mark sets before serializing
  const merged = mergeAdjacentText(nodes)
  return merged.map(serializeInline).join('')
}

function serializeInline(node: InlineNode): string {
  if (node.type === 'hardBreak') return '<br>'

  const text = escapeHTML(node.text)
  if (node.marks.length === 0) return text

  // Sort marks into canonical order
  const orderedMarks = [...node.marks].sort(
    (a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type),
  )

  // Wrap text in nested mark tags — reduce right-to-left so the first
  // mark in MARK_ORDER becomes the outermost wrapper.
  return orderedMarks.reduceRight((inner, mark) => {
    const tag = MARK_TO_TAG[mark.type]
    return `<${tag}>${inner}</${tag}>`
  }, text)
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ── Adjacent text node merging ────────────────────────────────────────────────

function marksEqual(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a.map((m) => m.type))
  return b.every((m) => setA.has(m.type))
}

function mergeAdjacentText(nodes: InlineNode[]): InlineNode[] {
  const result: InlineNode[] = []
  for (const node of nodes) {
    const last = result[result.length - 1]
    if (
      node.type === 'text' &&
      last?.type === 'text' &&
      marksEqual(node.marks, (last as TextNode).marks)
    ) {
      result[result.length - 1] = {
        type: 'text',
        text: (last as TextNode).text + node.text,
        marks: node.marks,
      }
    } else {
      result.push(node)
    }
  }
  return result
}

// ── Block serialization ───────────────────────────────────────────────────────

/**
 * Returns '<br>' for visually-empty inline content.
 * Browsers need a <br> placeholder inside empty contenteditable blocks
 * to allow the cursor to be placed there.
 */
function serializeInlinesOrBR(nodes: InlineNode[]): string {
  const html = serializeInlines(nodes)
  return html === '' ? '<br>' : html
}

function serializeBlock(block: BlockNode): string {
  switch (block.type) {
    case 'paragraph':
      return `<p>${serializeInlinesOrBR(block.children)}</p>`

    case 'heading':
      return `<h${block.level}>${serializeInlinesOrBR(block.children)}</h${block.level}>`

    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul'
      const items = block.items
        .map((item) => `<li>${serializeInlinesOrBR(item.children)}</li>`)
        .join('')
      return `<${tag}>${items}</${tag}>`
    }
  }
}

// ── Document serialization ────────────────────────────────────────────────────

export function serializeToHTML(doc: DocumentNode): string {
  return doc.children.map(serializeBlock).join('')
}
