import { describe, it, expect } from 'vitest'
import {
  toggleMark,
  setBlockType,
  toggleList,
  insertParagraph,
  insertHardBreak,
  deleteContent,
} from '../../src/ast/commands'
import { doc, p, h, text, li, ul, ol, br, pos, cursor, range, marks } from './helpers'

// ── toggleMark ────────────────────────────────────────────────────────────────

describe('toggleMark', () => {
  it('adds bold to a plain text range', () => {
    const d = doc(p(text('hello world')))
    const sel = range(pos(0, 0, 0), pos(0, 0, 5))
    const result = toggleMark(d, sel, 'bold', [])
    const children = (result.doc.children[0] as any).children
    expect(children[0]).toEqual(text('hello', 'bold'))
    expect(children[1]).toEqual(text(' world'))
  })

  it('removes bold from an already-bold range', () => {
    const d = doc(p(text('hello', 'bold'), text(' world')))
    const sel = range(pos(0, 0, 0), pos(0, 0, 5))
    const result = toggleMark(d, sel, 'bold', [])
    const children = (result.doc.children[0] as any).children
    expect(children[0].marks).toEqual([])
    expect(children[0].text).toBe('hello')
  })

  it('adds mark to partial text node (splits at boundaries)', () => {
    const d = doc(p(text('hello world')))
    const sel = range(pos(0, 0, 6), pos(0, 0, 11))
    const result = toggleMark(d, sel, 'italic', [])
    const children = (result.doc.children[0] as any).children
    expect(children[0]).toEqual(text('hello '))
    expect(children[1]).toEqual(text('world', 'italic'))
  })

  it('toggles stored marks on collapsed cursor', () => {
    const d = doc(p(text('hello')))
    const sel = cursor(0, 0, 5)
    const result = toggleMark(d, sel, 'bold', [])
    expect(result.storedMarks).toEqual(marks('bold'))
    // Doc unchanged
    expect(result.doc).toEqual(d)
  })

  it('toggles off stored marks when already active', () => {
    const d = doc(p(text('hello')))
    const sel = cursor(0, 0, 5)
    const result = toggleMark(d, sel, 'bold', marks('bold'))
    expect(result.storedMarks).toEqual([])
  })

  it('spans multiple blocks', () => {
    const d = doc(p(text('aaa')), p(text('bbb')))
    const sel = range(pos(0, 0, 1), pos(1, 0, 2))
    const result = toggleMark(d, sel, 'bold', [])
    const p0 = (result.doc.children[0] as any).children
    const p1 = (result.doc.children[1] as any).children
    expect(p0[0]).toEqual(text('a'))
    expect(p0[1]).toEqual(text('aa', 'bold'))
    expect(p1[0]).toEqual(text('bb', 'bold'))
    expect(p1[1]).toEqual(text('b'))
  })

  it('spans paragraph into list item', () => {
    const d = doc(p(text('aaa')), ul(li(text('bbb'))))
    const sel = range(pos(0, 0, 1), pos(1, 0, 2, 0))
    const result = toggleMark(d, sel, 'bold', [])
    const para = (result.doc.children[0] as any).children
    const item = (result.doc.children[1] as any).items[0].children
    expect(para[1]).toEqual(text('aa', 'bold'))
    expect(item[0]).toEqual(text('bb', 'bold'))
  })

  it('preserves existing marks when adding a new one', () => {
    const d = doc(p(text('hello', 'italic')))
    const sel = range(pos(0, 0, 0), pos(0, 0, 5))
    const result = toggleMark(d, sel, 'bold', [])
    const node = (result.doc.children[0] as any).children[0]
    expect(node.marks).toContainEqual({ type: 'italic' })
    expect(node.marks).toContainEqual({ type: 'bold' })
  })
})

// ── setBlockType ──────────────────────────────────────────────────────────────

describe('setBlockType', () => {
  it('converts paragraph to heading', () => {
    const d = doc(p(text('hello')))
    const sel = cursor(0, 0, 0)
    const result = setBlockType(d, sel, 'heading', { level: 1 })
    expect(result.doc.children[0].type).toBe('heading')
    expect((result.doc.children[0] as any).level).toBe(1)
  })

  it('toggles heading off (same level → paragraph)', () => {
    const d = doc(h(2, text('hello')))
    const sel = cursor(0, 0, 0)
    const result = setBlockType(d, sel, 'heading', { level: 2 })
    expect(result.doc.children[0].type).toBe('paragraph')
  })

  it('switches heading level directly', () => {
    const d = doc(h(1, text('hello')))
    const sel = cursor(0, 0, 0)
    const result = setBlockType(d, sel, 'heading', { level: 3 })
    expect(result.doc.children[0].type).toBe('heading')
    expect((result.doc.children[0] as any).level).toBe(3)
  })

  it('converts heading to paragraph', () => {
    const d = doc(h(1, text('hello')))
    const sel = cursor(0, 0, 0)
    const result = setBlockType(d, sel, 'paragraph')
    expect(result.doc.children[0].type).toBe('paragraph')
  })

  it('skips list blocks', () => {
    const d = doc(ul(li(text('item'))))
    const sel = cursor(0, 0, 0, 0)
    const result = setBlockType(d, sel, 'heading', { level: 1 })
    expect(result.doc.children[0].type).toBe('list')
  })

  it('converts multiple blocks', () => {
    const d = doc(p(text('a')), p(text('b')), p(text('c')))
    const sel = range(pos(0, 0, 0), pos(2, 0, 1))
    const result = setBlockType(d, sel, 'heading', { level: 2 })
    expect(result.doc.children.every((b) => b.type === 'heading')).toBe(true)
  })
})

// ── toggleList ────────────────────────────────────────────────────────────────

describe('toggleList', () => {
  it('wraps a paragraph in an unordered list', () => {
    const d = doc(p(text('hello')))
    const sel = cursor(0, 0, 0)
    const result = toggleList(d, sel, false)
    expect(result.doc.children[0].type).toBe('list')
    expect((result.doc.children[0] as any).ordered).toBe(false)
    expect((result.doc.children[0] as any).items[0].children[0].text).toBe('hello')
  })

  it('wraps a paragraph in an ordered list', () => {
    const d = doc(p(text('hello')))
    const sel = cursor(0, 0, 0)
    const result = toggleList(d, sel, true)
    expect((result.doc.children[0] as any).ordered).toBe(true)
  })

  it('unwraps an unordered list to paragraphs', () => {
    const d = doc(ul(li(text('a')), li(text('b')), li(text('c'))))
    const sel = range(pos(0, 0, 0, 0), pos(0, 0, 1, 2))
    const result = toggleList(d, sel, false)
    expect(result.doc.children.length).toBe(3)
    expect(result.doc.children.every((b) => b.type === 'paragraph')).toBe(true)
  })

  it('wraps multiple paragraphs into one list', () => {
    const d = doc(p(text('a')), p(text('b')))
    const sel = range(pos(0, 0, 0), pos(1, 0, 1))
    const result = toggleList(d, sel, false)
    expect(result.doc.children.length).toBe(1)
    expect(result.doc.children[0].type).toBe('list')
    expect((result.doc.children[0] as any).items.length).toBe(2)
  })

  it('preserves blocks outside the selection', () => {
    const d = doc(p(text('before')), p(text('target')), p(text('after')))
    const sel = cursor(1, 0, 0)
    const result = toggleList(d, sel, false)
    expect(result.doc.children.length).toBe(3)
    expect(result.doc.children[0].type).toBe('paragraph')
    expect(result.doc.children[1].type).toBe('list')
    expect(result.doc.children[2].type).toBe('paragraph')
  })

  it('selection is valid after unwrap', () => {
    const d = doc(ul(li(text('a')), li(text('b'))))
    // Cursor in second list item
    const sel = cursor(0, 0, 1, 1)
    const result = toggleList(d, sel, false)
    // Should be in the second paragraph (blockIndex 1)
    expect(result.selection.anchor.blockIndex).toBe(1)
    expect(result.selection.anchor.itemIndex).toBe(0)
  })
})

// ── insertParagraph ───────────────────────────────────────────────────────────

describe('insertParagraph', () => {
  it('splits a paragraph at cursor', () => {
    const d = doc(p(text('hello world')))
    const sel = cursor(0, 0, 5)
    const result = insertParagraph(d, sel)
    expect(result.doc.children.length).toBe(2)
    expect((result.doc.children[0] as any).children[0].text).toBe('hello')
    expect((result.doc.children[1] as any).children[0].text).toBe(' world')
    expect(result.selection.anchor.blockIndex).toBe(1)
  })

  it('creates empty paragraph at end of block', () => {
    const d = doc(p(text('hello')))
    const sel = cursor(0, 0, 5)
    const result = insertParagraph(d, sel)
    expect(result.doc.children.length).toBe(2)
    expect((result.doc.children[1] as any).children[0].text).toBe('')
    expect(result.selection.anchor.blockIndex).toBe(1)
  })

  it('creates empty paragraph before heading when cursor at start', () => {
    const d = doc(h(1, text('Title')))
    const sel = cursor(0, 0, 0)
    const result = insertParagraph(d, sel)
    expect(result.doc.children.length).toBe(2)
    expect(result.doc.children[0].type).toBe('paragraph')
    expect(result.doc.children[1].type).toBe('heading')
    // Cursor in the new empty paragraph
    expect(result.selection.anchor.blockIndex).toBe(0)
  })

  it('splits heading in middle → heading + paragraph', () => {
    const d = doc(h(2, text('Hello World')))
    const sel = cursor(0, 0, 5)
    const result = insertParagraph(d, sel)
    expect(result.doc.children[0].type).toBe('heading')
    expect((result.doc.children[0] as any).children[0].text).toBe('Hello')
    expect(result.doc.children[1].type).toBe('paragraph')
    expect((result.doc.children[1] as any).children[0].text).toBe(' World')
  })

  it('splits list item', () => {
    const d = doc(ul(li(text('hello world'))))
    const sel = cursor(0, 0, 5, 0)
    const result = insertParagraph(d, sel)
    const list = result.doc.children[0] as ListNode
    expect(list.items.length).toBe(2)
    expect(list.items[0].children[0]).toEqual(text('hello'))
    expect(list.items[1].children[0]).toEqual(text(' world'))
  })

  it('exits list on empty item', () => {
    const d = doc(ul(li(text('item')), li(text(''))))
    const sel = cursor(0, 0, 0, 1)
    const result = insertParagraph(d, sel)
    // The empty item should become a paragraph
    const hasP = result.doc.children.some((b) => b.type === 'paragraph')
    expect(hasP).toBe(true)
  })

  it('deletes selection before splitting', () => {
    const d = doc(p(text('hello world')))
    const sel = range(pos(0, 0, 5), pos(0, 0, 11))
    const result = insertParagraph(d, sel)
    expect(result.doc.children.length).toBe(2)
    expect((result.doc.children[0] as any).children[0].text).toBe('hello')
  })
})

// ── insertHardBreak ───────────────────────────────────────────────────────────

describe('insertHardBreak', () => {
  it('inserts <br> at cursor position', () => {
    const d = doc(p(text('hello world')))
    const sel = cursor(0, 0, 5)
    const result = insertHardBreak(d, sel)
    const children = (result.doc.children[0] as any).children
    expect(children[0]).toEqual(text('hello'))
    expect(children[1]).toEqual(br())
    expect(children[2].text).toBe(' world')
  })

  it('cursor lands after the break', () => {
    const d = doc(p(text('hello')))
    const sel = cursor(0, 0, 5)
    const result = insertHardBreak(d, sel)
    expect(result.selection.anchor.inlineIndex).toBe(2) // after br
    expect(result.selection.anchor.offset).toBe(0)
  })
})

// ── deleteContent ─────────────────────────────────────────────────────────────

describe('deleteContent', () => {
  it('deletes within a single text node', () => {
    const d = doc(p(text('hello world')))
    const sel = range(pos(0, 0, 5), pos(0, 0, 11))
    const result = deleteContent(d, sel)
    expect((result.doc.children[0] as any).children[0].text).toBe('hello')
    expect(result.selection.anchor.offset).toBe(5)
  })

  it('merges two paragraphs', () => {
    const d = doc(p(text('hello')), p(text(' world')))
    const sel = range(pos(0, 0, 5), pos(1, 0, 0))
    const result = deleteContent(d, sel)
    expect(result.doc.children.length).toBe(1)
    expect((result.doc.children[0] as any).children[0].text).toBe('hello')
    // Second text node with ' world' should follow
    const c = (result.doc.children[0] as any).children
    expect(c.length).toBe(2)
    expect(c[1].text).toBe(' world')
  })

  it('is a no-op for collapsed selection', () => {
    const d = doc(p(text('hello')))
    const sel = cursor(0, 0, 3)
    const result = deleteContent(d, sel)
    expect(result.doc).toEqual(d)
  })

  it('leaves at least an empty text node', () => {
    const d = doc(p(text('hello')))
    const sel = range(pos(0, 0, 0), pos(0, 0, 5))
    const result = deleteContent(d, sel)
    const c = (result.doc.children[0] as any).children
    expect(c.length).toBe(1)
    expect(c[0].text).toBe('')
  })

  it('deletes across list item to paragraph', () => {
    const d = doc(ul(li(text('aaa'))), p(text('bbb')))
    const sel = range(pos(0, 0, 1, 0), pos(1, 0, 2))
    const result = deleteContent(d, sel)
    // First block (list) keeps partial content merged with remainder of paragraph
    expect(result.doc.children.length).toBe(1)
  })
})
