import { describe, it, expect } from 'vitest'
import {
  emptyListsRemoved,
  normalizeAdjacentLists,
  normalizeSiblingText,
  ensureNonEmptyBlocks,
  applySchema,
  defaultRules,
} from '../../src/ast/schema'
import { doc, p, h, text, li, ul, ol } from './helpers'

describe('emptyListsRemoved', () => {
  it('removes a list with zero items', () => {
    const d = doc(p(text('a')), { type: 'list', ordered: false, items: [] }, p(text('b')))
    const result = emptyListsRemoved(d)
    expect(result.children.length).toBe(2)
    expect(result.children.every((b) => b.type === 'paragraph')).toBe(true)
  })

  it('returns same doc when no empty lists', () => {
    const d = doc(ul(li(text('a'))))
    const result = emptyListsRemoved(d)
    expect(result).toBe(d) // same reference
  })

  it('produces empty paragraph when only block was empty list', () => {
    const d = doc({ type: 'list', ordered: false, items: [] })
    const result = emptyListsRemoved(d)
    expect(result.children.length).toBe(1)
    expect(result.children[0].type).toBe('paragraph')
  })
})

describe('normalizeAdjacentLists', () => {
  it('merges two adjacent unordered lists', () => {
    const d = doc(ul(li(text('a'))), ul(li(text('b'))))
    const result = normalizeAdjacentLists(d)
    expect(result.children.length).toBe(1)
    expect(result.children[0].type).toBe('list')
    expect((result.children[0] as any).items.length).toBe(2)
  })

  it('does not merge ul + ol', () => {
    const d = doc(ul(li(text('a'))), ol(li(text('b'))))
    const result = normalizeAdjacentLists(d)
    expect(result.children.length).toBe(2)
  })

  it('merges three adjacent same-type lists', () => {
    const d = doc(ul(li(text('a'))), ul(li(text('b'))), ul(li(text('c'))))
    const result = normalizeAdjacentLists(d)
    expect(result.children.length).toBe(1)
    expect((result.children[0] as any).items.length).toBe(3)
  })

  it('returns same doc reference when nothing to merge', () => {
    const d = doc(p(text('a')), ul(li(text('b'))))
    const result = normalizeAdjacentLists(d)
    expect(result).toBe(d)
  })
})

describe('normalizeSiblingText', () => {
  it('merges adjacent text nodes with same marks', () => {
    const d = doc(p(text('hel'), text('lo')))
    const result = normalizeSiblingText(d)
    expect((result.children[0] as any).children.length).toBe(1)
    expect((result.children[0] as any).children[0].text).toBe('hello')
  })

  it('does not merge text nodes with different marks', () => {
    const d = doc(p(text('hel', 'bold'), text('lo')))
    const result = normalizeSiblingText(d)
    expect((result.children[0] as any).children.length).toBe(2)
  })

  it('merges inside list items', () => {
    const d = doc(ul(li(text('a'), text('b'))))
    const result = normalizeSiblingText(d)
    expect((result.children[0] as any).items[0].children.length).toBe(1)
    expect((result.children[0] as any).items[0].children[0].text).toBe('ab')
  })
})

describe('ensureNonEmptyBlocks', () => {
  it('adds empty text node to a paragraph with no children', () => {
    const d = doc({ type: 'paragraph', children: [] })
    const result = ensureNonEmptyBlocks(d)
    expect((result.children[0] as any).children.length).toBe(1)
    expect((result.children[0] as any).children[0].text).toBe('')
  })

  it('adds empty text to empty list items', () => {
    const d = doc({ type: 'list', ordered: false, items: [{ type: 'listItem', children: [] }] })
    const result = ensureNonEmptyBlocks(d)
    expect((result.children[0] as any).items[0].children.length).toBe(1)
  })
})

describe('applySchema (all rules)', () => {
  it('normalises a messy document', () => {
    const d = doc(
      ul(li(text('a'))),
      ul(li(text('b'), text('c'))), // adjacent list + mergeable text
      { type: 'list', ordered: false, items: [] }, // empty list
      p(text('d'), text('e')), // mergeable text
    )
    const result = applySchema(d, defaultRules)
    // Two adjacent ul merged → one list with 2 items
    // Empty list removed
    // Text nodes merged
    expect(result.children.length).toBe(2) // one list + one paragraph
    expect(result.children[0].type).toBe('list')
    expect((result.children[0] as any).items.length).toBe(2)
    expect((result.children[0] as any).items[1].children.length).toBe(1) // merged 'bc'
    expect((result.children[1] as any).children.length).toBe(1) // merged 'de'
  })
})
