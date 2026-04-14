// ── Mark types ────────────────────────────────────────────────────────────────

export type MarkType = 'bold' | 'italic' | 'underline' | 'strikethrough'

export interface Mark {
  type: MarkType
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

export interface ParagraphNode {
  type: 'paragraph'
  children: InlineNode[]
}

export interface HeadingNode {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
  children: InlineNode[]
}

export interface ListItemNode {
  type: 'listItem'
  children: InlineNode[]
}

export interface ListNode {
  type: 'list'
  ordered: boolean
  items: ListItemNode[]
}

export type BlockNode = ParagraphNode | HeadingNode | ListNode

// ── Document root ─────────────────────────────────────────────────────────────

export interface DocumentNode {
  type: 'document'
  children: BlockNode[]
}
