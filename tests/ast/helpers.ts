import type {
  BlockNode,
  DocumentNode,
  HeadingNode,
  InlineNode,
  ListItemNode,
  Mark,
  MarkType,
  ParagraphNode,
  TextNode,
} from '../../src/ast/types'
import type { ASTPosition, ASTSelection } from '../../src/ast/selection'

// ── Node builders ─────────────────────────────────────────────────────────────

export function text(str: string, ...marks: MarkType[]): TextNode {
  return { type: 'text', text: str, marks: marks.map((m) => ({ type: m })) }
}

export function br(): InlineNode {
  return { type: 'hardBreak' }
}

export function p(...children: InlineNode[]): ParagraphNode {
  if (children.length === 0) children = [text('')]
  return { id: '', type: 'paragraph', children }
}

export function h(level: 1 | 2 | 3 | 4 | 5 | 6, ...children: InlineNode[]): HeadingNode {
  if (children.length === 0) children = [text('')]
  return { id: '', type: 'heading', level, children }
}

export function li(indent: number, ordered: boolean, ...children: InlineNode[]): ListItemNode {
  if (children.length === 0) children = [text('')]
  return { id: '', type: 'listItem', indent, ordered, children }
}

/** Helper to create multiple list items easily */
export function ul(indent: number, ...items: InlineNode[][]): ListItemNode[] {
  return items.map((children) => li(indent, false, ...children))
}

export function ol(indent: number, ...items: InlineNode[][]): ListItemNode[] {
  return items.map((children) => li(indent, true, ...children))
}

export function doc(...args: (BlockNode | BlockNode[])[]): DocumentNode {
  const blocks = args.flat()
  blocks.forEach((b, i) => {
    if (!b.id) b.id = `b${i}`
  })
  return { type: 'document', blocks }
}

// ── Selection builders ────────────────────────────────────────────────────────

export function pos(blockId: string | number, inlineIndex: number, offset: number): ASTPosition {
  const id = typeof blockId === 'number' ? `b${blockId}` : blockId
  return { blockId: id, inlineIndex, offset }
}

export function cursor(
  blockId: string | number,
  inlineIndex: number,
  offset: number,
): ASTSelection {
  const p = pos(blockId, inlineIndex, offset)
  return { anchor: p, head: p }
}

export function range(anchor: ASTPosition, head: ASTPosition): ASTSelection {
  return { anchor, head }
}

// ── Mark helpers ──────────────────────────────────────────────────────────────

export function marks(...types: MarkType[]): Mark[] {
  return types.map((t) => ({ type: t }))
}
