import type { BlockNode, DocumentNode, InlineNode, Mark } from './types'
import { generateId, emptyText, emptyParagraph } from './types'
import type { BlockSpec, Schema } from './schema'

function parseInline(node: Node, marks: Mark[], schema: Schema): InlineNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    return text === '' ? [] : [{ type: 'text', text, marks: [...marks] }]
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return []

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') return [{ type: 'hardBreak' }]

  // Iterate mark rules registered for this tag; first non-vetoing rule wins.
  // Run before the `<span>` transparent-unwrap so plugins can claim `<span>`
  // via `getAttrs` (e.g. match `<span style="font-weight:700">` as bold).
  for (const { spec, rule } of schema.markRulesForTag(tag)) {
    const ruleAttrs = rule.getAttrs ? rule.getAttrs(el) : undefined
    if (ruleAttrs === false) continue
    const attrs = schema.parseMarkAttrs(spec, el, ruleAttrs ?? undefined)
    const mark: Mark =
      Object.keys(attrs).length > 0 ? { type: spec.type, attrs } : { type: spec.type }
    const childMarks = [...marks.filter((m) => m.type !== spec.type), mark]
    return parseChildrenInline(el, childMarks, schema)
  }

  // No rule accepted (either no rule, or all rules vetoed). `<span>` and any
  // other unknown inline tag unwrap transparently — children are kept
  // without adopting any mark from this element.
  return parseChildrenInline(el, marks, schema)
}

function parseChildrenInline(el: Element, marks: Mark[], schema: Schema): InlineNode[] {
  const result: InlineNode[] = []
  for (const child of el.childNodes) result.push(...parseInline(child, marks, schema))
  return result
}

function parseBlockChildren(el: Element, schema: Schema): InlineNode[] {
  const children: InlineNode[] = []
  for (const child of el.childNodes) children.push(...parseInline(child, [], schema))
  return children.length > 0 ? children : [emptyText()]
}

function blockId(el: Element): string {
  const id = el.getAttribute('data-block-id')
  return id && /^[0-9a-z]+$/.test(id) ? id : generateId()
}

function isInlineLikeTag(tag: string, schema: Schema): boolean {
  return tag === 'br' || tag === 'span' || schema.hasMarkRuleForTag(tag)
}

function parseBlock(el: Element, indent: number, schema: Schema): BlockNode[] {
  const tag = el.tagName.toLowerCase()

  for (const { spec, rule } of schema.blockRulesForTag(tag)) {
    const ruleAttrs = rule.getAttrs ? rule.getAttrs(el) : undefined
    if (ruleAttrs === false) continue
    const attrs = schema.parseBlockAttrs(spec, el, undefined, ruleAttrs ?? undefined)
    return [
      {
        id: blockId(el),
        type: spec.type,
        attrs,
        children: parseBlockChildren(el, schema),
      },
    ]
  }

  const containerSpec = schema.blockFromContainerTag(tag)
  if (containerSpec && containerSpec.group) {
    return parseGroupContainer(el, indent, containerSpec, schema)
  }

  if (tag === 'script' || tag === 'style') return []

  if (isInlineLikeTag(tag, schema)) {
    return [
      { id: generateId(), type: 'paragraph', attrs: {}, children: parseInline(el, [], schema) },
    ]
  }

  return unwrapAsBlocks(el.childNodes, indent, schema)
}

function parseGroupContainer(
  containerEl: Element,
  indent: number,
  spec: BlockSpec,
  schema: Schema,
): BlockNode[] {
  if (!spec.group) return []
  const containerAttrs = spec.group.parseContainer(containerEl)
  const blocks: BlockNode[] = []
  for (const child of containerEl.children) {
    if (child.tagName.toLowerCase() !== 'li') continue
    const itemChildren: InlineNode[] = []
    const nestedBlocks: BlockNode[] = []
    for (const node of child.childNodes) {
      const childTag =
        node.nodeType === Node.ELEMENT_NODE ? (node as Element).tagName.toLowerCase() : ''
      const nestedContainer = schema.blockFromContainerTag(childTag)
      if (nestedContainer) {
        nestedBlocks.push(
          ...parseGroupContainer(node as Element, indent + 1, nestedContainer, schema),
        )
      } else {
        itemChildren.push(...parseInline(node, [], schema))
      }
    }
    const attrs = schema.parseBlockAttrs(spec, child, { ...containerAttrs, indent })
    blocks.push({
      id: blockId(child),
      type: spec.type,
      attrs,
      children: itemChildren.length > 0 ? itemChildren : [emptyText()],
    })
    blocks.push(...nestedBlocks)
  }
  return blocks
}

function unwrapAsBlocks(
  childNodes: NodeListOf<ChildNode>,
  indent: number,
  schema: Schema,
): BlockNode[] {
  const blocks: BlockNode[] = []
  let pending: InlineNode[] = []

  function flush(): void {
    if (pending.length === 0) return
    const isBlank = pending.every((n) => n.type === 'text' && n.text.trim() === '')
    if (!isBlank || blocks.length === 0) {
      blocks.push({ id: generateId(), type: 'paragraph', attrs: {}, children: pending })
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
      if (isInlineLikeTag(tag, schema)) {
        pending.push(...parseInline(node, [], schema))
      } else {
        flush()
        blocks.push(...parseBlock(node as Element, indent, schema))
      }
    }
  }
  flush()
  return blocks
}

function parseChildNodes(childNodes: NodeListOf<ChildNode>, schema: Schema): DocumentNode {
  const blocks = unwrapAsBlocks(childNodes, 0, schema)
  if (blocks.length === 0) blocks.push(emptyParagraph())
  return { type: 'document', blocks }
}

export function parseHTML(html: string, schema: Schema): DocumentNode {
  if (typeof document === 'undefined') {
    return { type: 'document', blocks: [emptyParagraph()] }
  }
  const container = document.createElement('div')
  container.innerHTML = html
  return parseChildNodes(container.childNodes, schema)
}

export function parseLiveDOM(el: HTMLElement, schema: Schema): DocumentNode {
  return parseChildNodes(el.childNodes, schema)
}
