export interface Mark {
  type: string
  attrs?: Record<string, unknown>
}

export interface TextNode {
  type: 'text'
  text: string
  marks: Mark[]
}

export interface HardBreakNode {
  type: 'hardBreak'
}

export type InlineNode = TextNode | HardBreakNode

export interface BlockNode {
  id: string
  type: string
  attrs: Record<string, unknown>
  children: InlineNode[]
}

export interface DocumentNode {
  type: 'document'
  blocks: BlockNode[]
}

let blockIdCounter = 0
export function generateId(): string {
  return (++blockIdCounter).toString(36)
}

export function emptyText(): TextNode {
  return { type: 'text', text: '', marks: [] }
}

export function emptyParagraph(): BlockNode {
  return { id: generateId(), type: 'paragraph', attrs: {}, children: [emptyText()] }
}

export function withChildren(block: BlockNode, children: InlineNode[]): BlockNode {
  return { id: block.id, type: block.type, attrs: block.attrs, children }
}
