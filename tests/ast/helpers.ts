import type {
  BlockNode,
  DocumentNode,
  HeadingNode,
  InlineNode,
  ListItemNode,
  ListNode,
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
  return { type: 'paragraph', children }
}

export function h(level: 1 | 2 | 3 | 4 | 5 | 6, ...children: InlineNode[]): HeadingNode {
  if (children.length === 0) children = [text('')]
  return { type: 'heading', level, children }
}

export function li(...children: InlineNode[]): ListItemNode {
  if (children.length === 0) children = [text('')]
  return { type: 'listItem', children }
}

export function ul(...items: ListItemNode[]): ListNode {
  return { type: 'list', ordered: false, items }
}

export function ol(...items: ListItemNode[]): ListNode {
  return { type: 'list', ordered: true, items }
}

export function doc(...children: BlockNode[]): DocumentNode {
  return { type: 'document', children }
}

// ── Selection builders ────────────────────────────────────────────────────────

export function pos(
  blockIndex: number,
  inlineIndex: number,
  offset: number,
  itemIndex = 0,
): ASTPosition {
  return { blockIndex, itemIndex, inlineIndex, offset }
}

export function cursor(
  blockIndex: number,
  inlineIndex: number,
  offset: number,
  itemIndex = 0,
): ASTSelection {
  const p = pos(blockIndex, inlineIndex, offset, itemIndex)
  return { anchor: p, head: p }
}

export function range(
  anchor: ASTPosition,
  head: ASTPosition,
): ASTSelection {
  return { anchor, head }
}

// ── Mark helpers ──────────────────────────────────────────────────────────────

export function marks(...types: MarkType[]): Mark[] {
  return types.map((t) => ({ type: t }))
}
