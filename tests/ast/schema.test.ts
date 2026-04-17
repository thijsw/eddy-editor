import { describe, it, expect } from 'vitest'
import {
  normalizeSiblingText,
  ensureNonEmptyBlocks,
  applySchema,
  defaultRules,
} from '../../src/ast/schema'
import { doc, p, text, ul } from './helpers'

describe('normalizeSiblingText', () => {
  it('merges adjacent text nodes with same marks', () => {
    const d = doc(p(text('hel'), text('lo')))
    const result = normalizeSiblingText(d)
    expect((result.blocks[0] as any).children.length).toBe(1)
    expect((result.blocks[0] as any).children[0].text).toBe('hello')
  })

  it('does not merge text nodes with different marks', () => {
    const d = doc(p(text('hel', 'bold'), text('lo')))
    const result = normalizeSiblingText(d)
    expect((result.blocks[0] as any).children.length).toBe(2)
  })

  it('merges inside list items', () => {
    const d = doc(ul(0, [text('a'), text('b')]))
    const result = normalizeSiblingText(d)
    expect((result.blocks[0] as any).children.length).toBe(1)
    expect((result.blocks[0] as any).children[0].text).toBe('ab')
  })
})

describe('ensureNonEmptyBlocks', () => {
  it('adds empty text node to a paragraph with no children', () => {
    const d = doc({ id: 'b0', type: 'paragraph', children: [] })
    const result = ensureNonEmptyBlocks(d)
    expect((result.blocks[0] as any).children.length).toBe(1)
    expect((result.blocks[0] as any).children[0].text).toBe('')
  })

  it('adds empty text to empty list items', () => {
    const d = doc({ id: 'b0', type: 'listItem', indent: 0, ordered: false, children: [] })
    const result = ensureNonEmptyBlocks(d)
    expect((result.blocks[0] as any).children.length).toBe(1)
  })
})

describe('applySchema (all rules)', () => {
  it('normalises a messy document', () => {
    const d = doc(
      ul(0, [text('a')]),
      ul(0, [text('b'), text('c')]),
      p(text('d'), text('e')), // mergeable text
    )
    const result = applySchema(d, defaultRules)
    // In current rules, list items are NOT merged (only siblings in SAME block are)
    // Text nodes merged
    expect(result.blocks.length).toBe(3)
    expect((result.blocks[1] as any).children.length).toBe(1) // merged 'bc'
    expect((result.blocks[2] as any).children.length).toBe(1) // merged 'de'
  })
})
