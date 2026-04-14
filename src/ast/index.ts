export type {
  MarkType,
  Mark,
  TextNode,
  HardBreakNode,
  InlineNode,
  ParagraphNode,
  HeadingNode,
  ListItemNode,
  ListNode,
  BlockNode,
  DocumentNode,
} from './types'

export type { ASTPosition, ASTSelection } from './selection'
export { isCollapsed, positionsEqual, normalizeSelection, comparePositions, collapsedAt } from './selection'

export { parseHTML, parseLiveDOM } from './parse'
export { serializeToHTML } from './serialize'

export { domPositionToAST, astPositionToDOM, readSelection, applySelection } from './dom-mapping'

export type { CommandResult } from './commands'
export { toggleMark, setBlockType, toggleList, insertParagraph, insertHardBreak, deleteContent } from './commands'

export { isMarkActive, getBlockType, getHeadingLevel, isCursorAtBlockStart, isCursorAtBlockEnd } from './inspect'

export type { SchemaRule } from './schema'
export { applySchema, defaultRules } from './schema'

export type { HistoryStack, HistoryEntry } from './history'
export { createHistory, push as historyPush, undo as historyUndo, redo as historyRedo, current as historyCurrent } from './history'
