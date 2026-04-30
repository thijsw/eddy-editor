import type { BlockNode, DocumentNode, InlineNode } from './types'
import type { DOMOutput, Schema } from './schema'

export function serializeToHTML(doc: DocumentNode, schema: Schema): string {
  return renderBlocks(doc.blocks, false, schema)
}

export function serializeToDOMHTML(doc: DocumentNode, schema: Schema): string {
  return renderBlocks(doc.blocks, true, schema)
}

export function serializeBlockInner(block: BlockNode, schema: Schema): string {
  return serializeInlinesOrBR(block.children, schema)
}

function serializeInline(node: InlineNode, schema: Schema): string {
  if (node.type === 'hardBreak') return '<br>'

  const text = escapeHTML(node.text)
  if (node.marks.length === 0) return text

  const sorted = [...node.marks].sort(
    (a, b) => schema.markOrder.indexOf(a.type) - schema.markOrder.indexOf(b.type),
  )

  return sorted.reduceRight((inner, mark) => {
    const spec = schema.marks.get(mark.type)
    if (!spec) return inner
    return renderDOM(spec.toDOM(mark), inner)
  }, text)
}

function serializeInlinesOrBR(nodes: InlineNode[], schema: Schema): string {
  const html = nodes.map((n) => serializeInline(n, schema)).join('')
  return html === '' ? '<br>' : html
}

export function serializeSingleBlock(block: BlockNode, withIds: boolean, schema: Schema): string {
  const spec = schema.blocks.get(block.type)
  // Atom blocks render entirely from toDOM — the AST inline children (a
  // single empty text node, by schema invariant) are not visualised.
  const inner = spec?.atom ? '' : serializeInlinesOrBR(block.children, schema)
  const extra = withIds ? { 'data-block-id': block.id } : undefined
  const output: DOMOutput = spec ? spec.toDOM(block) : ['p']
  return renderDOM(output, inner, extra)
}

function renderDOM(output: DOMOutput, inner: string, extraAttrs?: Record<string, string>): string {
  const tag = output[0]
  let attrs: Record<string, string> = {}
  let childStart = 1
  const maybe = output[1]
  if (maybe !== undefined && maybe !== 0 && !Array.isArray(maybe) && typeof maybe === 'object') {
    attrs = { ...(maybe as Record<string, string>) }
    childStart = 2
  }
  if (extraAttrs) Object.assign(attrs, extraAttrs)

  let attrStr = ''
  for (const [key, value] of Object.entries(attrs)) {
    attrStr += ` ${key}="${escapeAttr(value)}"`
  }

  // No explicit children — the tag wraps the inner content directly.
  if (childStart >= output.length) {
    if (VOID_TAGS.has(tag)) return `<${tag}${attrStr}>`
    return `<${tag}${attrStr}>${inner}</${tag}>`
  }

  let body = ''
  for (let i = childStart; i < output.length; i++) {
    const child = output[i]
    if (child === 0) body += inner
    else if (Array.isArray(child)) body += renderDOM(child as DOMOutput, inner)
  }
  return `<${tag}${attrStr}>${body}</${tag}>`
}

function renderBlocks(blocks: BlockNode[], withIds: boolean, schema: Schema): string {
  let html = ''
  let i = 0

  while (i < blocks.length) {
    const spec = schema.blocks.get(blocks[i].type)
    if (!spec?.group) {
      html += serializeSingleBlock(blocks[i], withIds, schema)
      i++
      continue
    }

    const listStack: string[] = []
    let depth = -1

    while (i < blocks.length) {
      const block = blocks[i]
      const currentSpec = schema.blocks.get(block.type)
      if (!currentSpec?.group) break

      const wantTag = currentSpec.group.containerTag(block)
      const wantDepth = currentSpec.group.depth(block)

      if (wantDepth > depth) {
        while (wantDepth > depth) {
          depth++
          html += `<${wantTag}>`
          listStack.push(wantTag)
        }
      } else if (wantDepth < depth) {
        while (wantDepth < depth) {
          html += `</${listStack.pop()}>`
          depth--
        }
      } else if (listStack[listStack.length - 1] !== wantTag) {
        html += `</${listStack.pop()}><${wantTag}>`
        listStack.push(wantTag)
      }

      html += serializeSingleBlock(block, withIds, schema)
      i++
    }

    while (listStack.length > 0) html += `</${listStack.pop()}>`
  }

  return html
}

// HTML void elements: cannot have children, must not have a closing tag.
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

function escapeHTML(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(text: string): string {
  return escapeHTML(text).replace(/"/g, '&quot;')
}
