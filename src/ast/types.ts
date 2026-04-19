// ── Mark types ────────────────────────────────────────────────────────────────

export type MarkType = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'link' | 'code'

export interface MarkAttrs {
  href?: string
}

export interface Mark {
  type: MarkType
  attrs?: MarkAttrs
}

// ── Inline nodes ──────────────────────────────────────────────────────────────

export interface TextNode {
  type: 'text'
  text: string
  marks: Mark[]
}

export interface HardBreakNode {
  type: 'hardBreak'
}

export type InlineNode = TextNode | HardBreakNode

// ── Block nodes ───────────────────────────────────────────────────────────────

export type BlockType = 'paragraph' | 'heading' | 'listItem'

export interface BaseBlock {
  id: string // Persistent ID for surgical updates and robust selection
  children: InlineNode[]
}

export interface ParagraphNode extends BaseBlock {
  type: 'paragraph'
}

export interface HeadingNode extends BaseBlock {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
}

export interface ListItemNode extends BaseBlock {
  type: 'listItem'
  ordered: boolean
  indent: number
}

export type BlockNode = ParagraphNode | HeadingNode | ListItemNode

// ── Document root ─────────────────────────────────────────────────────────────

export interface DocumentNode {
  type: 'document'
  blocks: BlockNode[]
}

/**
 * Module-local monotonic counter. Cheaper than Math.random, zero collision
 * risk, and deterministic per session — useful when inspecting the AST.
 */
let blockIdCounter = 0
export function generateId(): string {
  return (++blockIdCounter).toString(36)
}

export function emptyText(): TextNode {
  return { type: 'text', text: '', marks: [] }
}

export function emptyParagraph(): ParagraphNode {
  return { id: generateId(), type: 'paragraph', children: [emptyText()] }
}

/**
 * Returns a copy of a block with its children replaced. Preserves the
 * discriminated-union shape (heading.level, listItem.ordered/indent) without
 * an unsafe spread + cast.
 */
export function withChildren(block: BlockNode, children: InlineNode[]): BlockNode {
  switch (block.type) {
    case 'paragraph':
      return { id: block.id, type: 'paragraph', children }
    case 'heading':
      return { id: block.id, type: 'heading', level: block.level, children }
    case 'listItem':
      return {
        id: block.id,
        type: 'listItem',
        ordered: block.ordered,
        indent: block.indent,
        children,
      }
  }
}
