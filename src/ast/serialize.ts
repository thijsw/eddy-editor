import type { BlockNode, DocumentNode, InlineNode, MarkType, ListItemNode } from './types'

const MARK_TO_TAG: Record<MarkType, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strikethrough: 's',
}

// Canonical mark order: bold wraps italic wraps underline wraps strikethrough.
const MARK_ORDER: MarkType[] = ['bold', 'italic', 'underline', 'strikethrough']

function serializeInline(node: InlineNode): string {
  if (node.type === 'hardBreak') return '<br>'

  const text = escapeHTML(node.text)
  if (node.marks.length === 0) return text

  return [...node.marks]
    .sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type))
    .reduceRight((inner, mark) => {
      const tag = MARK_TO_TAG[mark.type]
      return `<${tag}>${inner}</${tag}>`
    }, text)
}

function escapeHTML(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function serializeInlinesOrBR(nodes: InlineNode[]): string {
  const html = nodes.map(serializeInline).join('')
  return html === '' ? '<br>' : html
}

export function serializeBlockInner(block: BlockNode): string {
  return serializeInlinesOrBR(block.children)
}

function wrap(tag: string, inner: string, id?: string): string {
  const attr = id ? ` data-block-id="${id}"` : ''
  return `<${tag}${attr}>${inner}</${tag}>`
}

function serializeSingleBlock(block: BlockNode, withIds: boolean): string {
  const id = withIds ? block.id : undefined
  const inner = serializeInlinesOrBR(block.children)
  if (block.type === 'heading') return wrap(`h${block.level}`, inner, id)
  return wrap(block.type === 'listItem' ? 'li' : 'p', inner, id)
}

/** Canonical HTML — no internal attributes. Suitable for v-model. */
export function serializeToHTML(doc: DocumentNode): string {
  return renderBlocks(doc.blocks, false)
}

/**
 * Internal serialiser — annotates block elements with data-block-id so the DOM
 * mirror can be updated surgically and selection mapping stays stable.
 */
export function serializeToDOMHTML(doc: DocumentNode): string {
  return renderBlocks(doc.blocks, true)
}

function renderBlocks(blocks: BlockNode[], withIds: boolean): string {
  let html = ''
  let i = 0

  while (i < blocks.length) {
    if (blocks[i].type !== 'listItem') {
      html += serializeSingleBlock(blocks[i], withIds)
      i++
      continue
    }

    const listStack: string[] = [] // stack of open tag names ("ul" | "ol")
    let depth = -1

    while (i < blocks.length && blocks[i].type === 'listItem') {
      const item = blocks[i] as ListItemNode
      const wantTag = item.ordered ? 'ol' : 'ul'

      if (item.indent > depth) {
        while (item.indent > depth) {
          depth++
          html += `<${wantTag}>`
          listStack.push(wantTag)
        }
      } else if (item.indent < depth) {
        while (item.indent < depth) {
          html += `</${listStack.pop()}>`
          depth--
        }
      } else if (listStack[listStack.length - 1] !== wantTag) {
        html += `</${listStack.pop()}><${wantTag}>`
        listStack.push(wantTag)
      }

      html += serializeSingleBlock(item, withIds)
      i++
    }

    while (listStack.length > 0) html += `</${listStack.pop()}>`
  }

  return html
}
