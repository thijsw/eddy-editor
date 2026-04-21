import type { EddyPlugin } from '../types'
import type { BlockSpec } from '../ast/schema'
import type { CommandResult } from '../ast/commands'
import { blockRangeIdx, mapBlocksInRange } from '../ast/commands'
import type { BlockNode, DocumentNode } from '../ast/types'
import type { ASTSelection } from '../ast/selection'

const listItemSpec: BlockSpec = {
  type: 'listItem',
  parseDOM: [{ tag: 'li' }],
  attrs: {
    ordered: { default: false },
    indent: { default: 0 },
  },
  toDOM: () => ['li'],
  group: {
    containerTags: ['ul', 'ol'],
    parseContainer: (el) => ({ ordered: el.tagName.toLowerCase() === 'ol' }),
    containerTag: (block) => (block.attrs.ordered ? 'ol' : 'ul'),
    depth: (block) => Number(block.attrs.indent ?? 0),
  },
}

/**
 * Toggle each block in the selection between paragraph and listItem. When
 * every block in the range is already a top-level listItem of the requested
 * variant, unwrap to paragraphs; otherwise convert to listItems.
 */
export function toggleList(doc: DocumentNode, sel: ASTSelection, ordered: boolean): CommandResult {
  const [, , startIdx, endIdx] = blockRangeIdx(doc, sel)

  let allSameList = true
  for (let i = startIdx; i <= endIdx; i++) {
    const b = doc.blocks[i]
    if (b.type !== 'listItem' || b.attrs.ordered !== ordered || b.attrs.indent !== 0) {
      allSameList = false
      break
    }
  }

  const newDoc = mapBlocksInRange(
    doc,
    startIdx,
    endIdx,
    (block): BlockNode =>
      allSameList
        ? { id: block.id, type: 'paragraph', attrs: {}, children: block.children }
        : {
            id: block.id,
            type: 'listItem',
            attrs: { ordered, indent: 0 },
            children: block.children,
          },
  )
  return { doc: newDoc, selection: sel }
}

/**
 * Owns the `listItem` block type (with `ordered` and `indent` attrs) and the
 * grouped <ul>/<ol> serialisation rules. Exposes two commands that toggle
 * between a run of list items and paragraphs.
 */
export const list: EddyPlugin = {
  name: 'list',
  blocks: [listItemSpec],
  commands: {
    'list.toggleUnordered': (api) => {
      api.tr.apply((doc, sel) => toggleList(doc, sel, false))
    },
    'list.toggleOrdered': (api) => {
      api.tr.apply((doc, sel) => toggleList(doc, sel, true))
    },
  },
  toolbar: [
    {
      command: 'list.toggleUnordered',
      label: 'UL',
      title: 'Bullet list',
      isActive: (api) => {
        const block = api.getBlockAt()
        return block?.type === 'listItem' && !block.attrs.ordered
      },
    },
    {
      command: 'list.toggleOrdered',
      label: 'OL',
      title: 'Numbered list',
      isActive: (api) => {
        const block = api.getBlockAt()
        return block?.type === 'listItem' && block.attrs.ordered === true
      },
    },
  ],
}
