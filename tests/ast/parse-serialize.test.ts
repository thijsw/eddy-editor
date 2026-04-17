import { describe, it, expect } from 'vitest'
import { parseHTML } from '../../src/ast/parse'
import { serializeToHTML } from '../../src/ast/serialize'

describe('parseHTML', () => {
  it('parses a simple paragraph', () => {
    const doc = parseHTML('<p>hello</p>')
    expect(doc.blocks.length).toBe(1)
    expect(doc.blocks[0].type).toBe('paragraph')
    expect((doc.blocks[0] as any).children[0].text).toBe('hello')
  })

  it('parses bold text', () => {
    const doc = parseHTML('<p><strong>bold</strong></p>')
    const node = (doc.blocks[0] as any).children[0]
    expect(node.text).toBe('bold')
    expect(node.marks).toContainEqual({ type: 'bold' })
  })

  it('parses <b> as bold', () => {
    const doc = parseHTML('<p><b>bold</b></p>')
    const node = (doc.blocks[0] as any).children[0]
    expect(node.marks).toContainEqual({ type: 'bold' })
  })

  it('parses nested marks', () => {
    const doc = parseHTML('<p><strong><em>both</em></strong></p>')
    const node = (doc.blocks[0] as any).children[0]
    expect(node.marks).toContainEqual({ type: 'bold' })
    expect(node.marks).toContainEqual({ type: 'italic' })
  })

  it('parses mixed marks correctly', () => {
    const doc = parseHTML('<p><strong><em>mixed</em> plain bold</strong></p>')
    const children = (doc.blocks[0] as any).children
    expect(children[0].text).toBe('mixed')
    expect(children[0].marks.length).toBe(2) // bold + italic
    expect(children[1].text).toBe(' plain bold')
    expect(children[1].marks.length).toBe(1) // just bold
  })

  it('parses headings', () => {
    const doc = parseHTML('<h2>Title</h2>')
    expect(doc.blocks[0].type).toBe('heading')
    expect((doc.blocks[0] as any).level).toBe(2)
  })

  it('parses unordered lists', () => {
    const doc = parseHTML('<ul><li>a</li><li>b</li></ul>')
    expect(doc.blocks.length).toBe(2)
    expect(doc.blocks[0].type).toBe('listItem')
    expect((doc.blocks[0] as any).ordered).toBe(false)
    expect((doc.blocks[1] as any).type).toBe('listItem')
  })

  it('parses ordered lists', () => {
    const doc = parseHTML('<ol><li>one</li></ol>')
    expect((doc.blocks[0] as any).ordered).toBe(true)
  })

  it('parses nested lists', () => {
    const doc = parseHTML('<ul><li>a<ul><li>b</li></ul></li></ul>')
    expect(doc.blocks.length).toBe(2)
    expect(doc.blocks[0].type).toBe('listItem')
    expect((doc.blocks[0] as any).indent).toBe(0)
    expect(doc.blocks[1].type).toBe('listItem')
    expect((doc.blocks[1] as any).indent).toBe(1)
  })

  it('parses <br> as hard break', () => {
    const doc = parseHTML('<p>line1<br>line2</p>')
    const children = (doc.blocks[0] as any).children
    expect(children[1].type).toBe('hardBreak')
  })

  it('wraps bare text in a paragraph', () => {
    const doc = parseHTML('bare text')
    expect(doc.blocks.length).toBe(1)
    expect(doc.blocks[0].type).toBe('paragraph')
  })

  it('treats <div> as paragraph', () => {
    const doc = parseHTML('<div>content</div>')
    expect(doc.blocks[0].type).toBe('paragraph')
  })

  it('produces an empty paragraph for empty input', () => {
    const doc = parseHTML('')
    expect(doc.blocks.length).toBe(1)
    expect(doc.blocks[0].type).toBe('paragraph')
  })

  it('preserves zero-width spaces in text', () => {
    const doc = parseHTML('<p>\u200Bhello\u200B</p>')
    const text = (doc.blocks[0] as any).children[0].text
    expect(text).toBe('\u200Bhello\u200B')
  })

  it('unwraps bare <span> tags', () => {
    const doc = parseHTML('<p><span>text</span></p>')
    const node = (doc.blocks[0] as any).children[0]
    expect(node.text).toBe('text')
    expect(node.marks).toEqual([])
  })
})

describe('parseHTML — sanitisation', () => {
  it('strips style/class/id/onclick/data-* attributes from supported tags', () => {
    const html =
      '<p style="color:red" class="foo" id="bar" onclick="alert(1)" data-x="y">hello</p>'
    expect(serializeToHTML(parseHTML(html))).toBe('<p>hello</p>')
  })

  it('strips attributes from headings and list items', () => {
    const html = '<h2 style="font-size:20px">Title</h2><ul><li class="x">item</li></ul>'
    expect(serializeToHTML(parseHTML(html))).toBe('<h2>Title</h2><ul><li>item</li></ul>')
  })

  it('strips attributes from mark tags', () => {
    const html = '<p><strong style="color:red" class="hot">bold</strong></p>'
    expect(serializeToHTML(parseHTML(html))).toBe('<p><strong>bold</strong></p>')
  })

  it('rejects a foreign data-block-id (would otherwise allow attribute injection)', () => {
    const evil = `evil"><script>alert(1)</script><`
    const doc = parseHTML(`<p data-block-id='${evil}'>hello</p>`)
    // The accepted block id format is base36 only.
    expect(doc.blocks[0].id).toMatch(/^[0-9a-z]+$/)
    // No injected markup survives serialisation.
    expect(serializeToHTML(doc)).toBe('<p>hello</p>')
  })

  it('preserves a well-formed data-block-id', () => {
    const doc = parseHTML('<p data-block-id="abc123">hello</p>')
    expect(doc.blocks[0].id).toBe('abc123')
  })

  it('drops <script> tags entirely', () => {
    const doc = parseHTML('<p>before</p><script>alert(1)</script><p>after</p>')
    expect(serializeToHTML(doc)).toBe('<p>before</p><p>after</p>')
  })

  it('drops <style> tags entirely', () => {
    const doc = parseHTML('<style>body { color: red }</style><p>hi</p>')
    expect(serializeToHTML(doc)).toBe('<p>hi</p>')
  })

  it('input containing only a <script> yields an empty paragraph', () => {
    expect(serializeToHTML(parseHTML('<script>alert(1)</script>'))).toBe('<p><br></p>')
  })

  it('converts <b> to <strong> and never emits <b>', () => {
    expect(serializeToHTML(parseHTML('<p><b>bold</b></p>'))).toBe('<p><strong>bold</strong></p>')
  })

  it('converts <i> to <em> and never emits <i>', () => {
    expect(serializeToHTML(parseHTML('<p><i>italic</i></p>'))).toBe('<p><em>italic</em></p>')
  })

  it('unwraps unknown block elements while keeping nested block structure', () => {
    const html = '<section><h1>Title</h1><p>Body</p></section>'
    expect(serializeToHTML(parseHTML(html))).toBe('<h1>Title</h1><p>Body</p>')
  })

  it('unwraps deeply nested unknown wrappers', () => {
    const html = '<article><header><h2>T</h2></header><main><p>B</p></main></article>'
    expect(serializeToHTML(parseHTML(html))).toBe('<h2>T</h2><p>B</p>')
  })

  it('treats inline mark tags at the document root as a paragraph with the mark applied', () => {
    expect(serializeToHTML(parseHTML('<strong>bold</strong>'))).toBe('<p><strong>bold</strong></p>')
  })

  it('unwraps unknown inline-ish tags (e.g. <a>) preserving their text', () => {
    expect(serializeToHTML(parseHTML('<p>see <a href="x">link</a> here</p>'))).toBe(
      '<p>see link here</p>',
    )
  })

  it('parser output is idempotent — re-parsing canonical output yields the same HTML', () => {
    const messy =
      '<section><div style="x" class="y"><b>bold</b> and <i>italic</i></div><p>more</p></section>'
    const once = serializeToHTML(parseHTML(messy))
    const twice = serializeToHTML(parseHTML(once))
    expect(twice).toBe(once)
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

  it('serializes nested lists (flat indent model)', () => {
    const doc = parseHTML('<ul><li>a<ul><li>b</li></ul></li></ul>')
    expect(serializeToHTML(doc)).toBe('<ul><li>a</li><ul><li>b</li></ul></ul>')
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
    '<ul><li>a</li><ul><li>b</li></ul></ul>',
  ]

  for (const html of cases) {
    it(`round-trips: ${html}`, () => {
      const doc1 = parseHTML(html)
      const html1 = serializeToHTML(doc1)
      const doc2 = parseHTML(html1)
      const html2 = serializeToHTML(doc2)
      expect(html2).toBe(html1)
    })
  }

  it('normalises <b> to <strong> on first pass', () => {
    expect(serializeToHTML(parseHTML('<p><b>text</b></p>'))).toBe('<p><strong>text</strong></p>')
  })

  it('normalises <i> to <em> on first pass', () => {
    expect(serializeToHTML(parseHTML('<p><i>text</i></p>'))).toBe('<p><em>text</em></p>')
  })

  it('normalises mark nesting order', () => {
    // italic wrapping bold → canonical order: bold wraps italic
    expect(serializeToHTML(parseHTML('<p><em><strong>text</strong></em></p>'))).toBe(
      '<p><strong><em>text</em></strong></p>',
    )
  })
})
