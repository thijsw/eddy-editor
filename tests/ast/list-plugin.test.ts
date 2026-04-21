import { describe, it, expect } from 'vitest'
import { toggleList } from '../../src/plugins/lists'
import { doc, p, text, ul, pos, cursor, range } from './helpers'

describe('toggleList (list plugin)', () => {
  it('wraps a paragraph in an unordered list', () => {
    const d = doc(p(text('hello')))
    const sel = cursor(0, 0, 0)
    const result = toggleList(d, sel, false)
    expect(result.doc.blocks[0].type).toBe('listItem')
    expect((result.doc.blocks[0] as any).attrs.ordered).toBe(false)
    expect((result.doc.blocks[0] as any).children[0].text).toBe('hello')
  })

  it('wraps a paragraph in an ordered list', () => {
    const d = doc(p(text('hello')))
    const sel = cursor(0, 0, 0)
    const result = toggleList(d, sel, true)
    expect((result.doc.blocks[0] as any).attrs.ordered).toBe(true)
  })

  it('unwraps an unordered list to paragraphs', () => {
    const d = doc(ul(0, [text('a')], [text('b')], [text('c')]))
    const sel = range(pos(0, 0, 0), pos(2, 0, 1))
    const result = toggleList(d, sel, false)
    expect(result.doc.blocks.length).toBe(3)
    expect(result.doc.blocks.every((b) => b.type === 'paragraph')).toBe(true)
  })

  it('wraps multiple paragraphs into one list', () => {
    const d = doc(p(text('a')), p(text('b')))
    const sel = range(pos(0, 0, 0), pos(1, 0, 1))
    const result = toggleList(d, sel, false)
    expect(result.doc.blocks.length).toBe(2)
    expect(result.doc.blocks[0].type).toBe('listItem')
    expect(result.doc.blocks[1].type).toBe('listItem')
  })

  it('preserves blocks outside the selection', () => {
    const d = doc(p(text('before')), p(text('target')), p(text('after')))
    const sel = cursor(1, 0, 0)
    const result = toggleList(d, sel, false)
    expect(result.doc.blocks.length).toBe(3)
    expect(result.doc.blocks[0].type).toBe('paragraph')
    expect(result.doc.blocks[1].type).toBe('listItem')
    expect(result.doc.blocks[2].type).toBe('paragraph')
  })

  it('selection is valid after unwrap', () => {
    const d = doc(ul(0, [text('a')], [text('b')]))
    const sel = cursor(1, 0, 1)
    const result = toggleList(d, sel, false)
    expect(result.selection.anchor.blockId).toBe('b1')
  })
})
