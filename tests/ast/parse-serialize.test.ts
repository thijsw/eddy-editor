import { describe, it, expect } from 'vitest'
import { parseHTML } from '../../src/ast/parse'
import { serializeToHTML } from '../../src/ast/serialize'

describe('parseHTML', () => {
  it('parses a simple paragraph', () => {
    const doc = parseHTML('<p>hello</p>')
    expect(doc.children.length).toBe(1)
    expect(doc.children[0].type).toBe('paragraph')
    expect((doc.children[0] as any).children[0].text).toBe('hello')
  })

  it('parses bold text', () => {
    const doc = parseHTML('<p><strong>bold</strong></p>')
    const node = (doc.children[0] as any).children[0]
    expect(node.text).toBe('bold')
    expect(node.marks).toContainEqual({ type: 'bold' })
  })

  it('parses <b> as bold', () => {
    const doc = parseHTML('<p><b>bold</b></p>')
    const node = (doc.children[0] as any).children[0]
    expect(node.marks).toContainEqual({ type: 'bold' })
  })

  it('parses nested marks', () => {
    const doc = parseHTML('<p><strong><em>both</em></strong></p>')
    const node = (doc.children[0] as any).children[0]
    expect(node.marks).toContainEqual({ type: 'bold' })
    expect(node.marks).toContainEqual({ type: 'italic' })
  })

  it('parses mixed marks correctly', () => {
    const doc = parseHTML('<p><strong><em>mixed</em> plain bold</strong></p>')
    const children = (doc.children[0] as any).children
    expect(children[0].text).toBe('mixed')
    expect(children[0].marks.length).toBe(2) // bold + italic
    expect(children[1].text).toBe(' plain bold')
    expect(children[1].marks.length).toBe(1) // just bold
  })

  it('parses headings', () => {
    const doc = parseHTML('<h2>Title</h2>')
    expect(doc.children[0].type).toBe('heading')
    expect((doc.children[0] as any).level).toBe(2)
  })

  it('parses unordered lists', () => {
    const doc = parseHTML('<ul><li>a</li><li>b</li></ul>')
    expect(doc.children[0].type).toBe('list')
    expect((doc.children[0] as any).ordered).toBe(false)
    expect((doc.children[0] as any).items.length).toBe(2)
  })

  it('parses ordered lists', () => {
    const doc = parseHTML('<ol><li>one</li></ol>')
    expect((doc.children[0] as any).ordered).toBe(true)
  })

  it('parses <br> as hard break', () => {
    const doc = parseHTML('<p>line1<br>line2</p>')
    const children = (doc.children[0] as any).children
    expect(children[1].type).toBe('hardBreak')
  })

  it('wraps bare text in a paragraph', () => {
    const doc = parseHTML('bare text')
    expect(doc.children.length).toBe(1)
    expect(doc.children[0].type).toBe('paragraph')
  })

  it('treats <div> as paragraph', () => {
    const doc = parseHTML('<div>content</div>')
    expect(doc.children[0].type).toBe('paragraph')
  })

  it('produces an empty paragraph for empty input', () => {
    const doc = parseHTML('')
    expect(doc.children.length).toBe(1)
    expect(doc.children[0].type).toBe('paragraph')
  })

  it('preserves zero-width spaces in text', () => {
    const doc = parseHTML('<p>\u200Bhello\u200B</p>')
    const text = (doc.children[0] as any).children[0].text
    expect(text).toBe('\u200Bhello\u200B')
  })

  it('unwraps bare <span> tags', () => {
    const doc = parseHTML('<p><span>text</span></p>')
    const node = (doc.children[0] as any).children[0]
    expect(node.text).toBe('text')
    expect(node.marks).toEqual([])
  })
})

describe('serializeToHTML', () => {
  it('serializes a paragraph', () => {
    const doc = parseHTML('<p>hello</p>')
    expect(serializeToHTML(doc)).toBe('<p>hello</p>')
  })

  it('serializes bold as <strong>', () => {
    const doc = parseHTML('<p><b>bold</b></p>')
    expect(serializeToHTML(doc)).toBe('<p><strong>bold</strong></p>')
  })

  it('serializes italic as <em>', () => {
    const doc = parseHTML('<p><i>italic</i></p>')
    expect(serializeToHTML(doc)).toBe('<p><em>italic</em></p>')
  })

  it('escapes HTML entities', () => {
    const doc = parseHTML('<p>&lt;script&gt;</p>')
    expect(serializeToHTML(doc)).toContain('&lt;script&gt;')
  })

  it('serializes empty blocks with <br>', () => {
    const doc = parseHTML('<p></p>')
    expect(serializeToHTML(doc)).toBe('<p><br></p>')
  })

  it('serializes lists', () => {
    const doc = parseHTML('<ul><li>a</li><li>b</li></ul>')
    expect(serializeToHTML(doc)).toBe('<ul><li>a</li><li>b</li></ul>')
  })
})

describe('round-trip: parse → serialize → parse', () => {
  const cases = [
    '<p>hello world</p>',
    '<p><strong>bold</strong></p>',
    '<p><strong><em>both</em></strong></p>',
    '<p>before <strong>bold</strong> after</p>',
    '<h1>Title</h1>',
    '<h3>Sub</h3>',
    '<ul><li>a</li><li>b</li></ul>',
    '<ol><li>one</li><li>two</li></ol>',
    '<p>line1<br>line2</p>',
    '<p>a</p><p>b</p><p>c</p>',
    '<h2>Title</h2><p>Body</p><ul><li>item</li></ul>',
  ]

  for (const html of cases) {
    it(`round-trips: ${html}`, () => {
      const doc1 = parseHTML(html)
      const html1 = serializeToHTML(doc1)
      const doc2 = parseHTML(html1)
      const html2 = serializeToHTML(doc2)
      // Second round-trip should be stable
      expect(html2).toBe(html1)
    })
  }

  it('normalises <b> to <strong> on first pass', () => {
    const html1 = serializeToHTML(parseHTML('<p><b>text</b></p>'))
    expect(html1).toBe('<p><strong>text</strong></p>')
  })

  it('normalises <i> to <em> on first pass', () => {
    const html1 = serializeToHTML(parseHTML('<p><i>text</i></p>'))
    expect(html1).toBe('<p><em>text</em></p>')
  })

  it('normalises mark nesting order', () => {
    // italic wrapping bold → canonical order: bold wraps italic
    const html1 = serializeToHTML(parseHTML('<p><em><strong>text</strong></em></p>'))
    expect(html1).toBe('<p><strong><em>text</em></strong></p>')
  })
})
