import { describe, expect, it } from 'vitest'
import { createSchema, defaultPlugins, parse, serialize } from '../../src'

const schema = createSchema(defaultPlugins)
const roundTrip = (html: string) => serialize(parse(html, schema), schema)

describe('parse', () => {
  it('parses paragraphs, marks and headings', () => {
    const doc = parse('<h2>T</h2><p>a <strong>b <em>c</em></strong></p>', schema)
    expect(doc.map((b) => b.type)).toEqual(['heading', 'paragraph'])
    expect(doc[0].attrs).toEqual({ level: 2 })
    expect(doc[1].children).toEqual([
      { text: 'a ', marks: {} },
      { text: 'b ', marks: { bold: {} } },
      { text: 'c', marks: { bold: {}, italic: {} } },
    ])
  })

  it('parses lists with order and nesting depth', () => {
    const doc = parse('<ol><li>a<ul><li>b</li></ul></li></ol><ul><li>c</li></ul>', schema)
    expect(doc.map((b) => b.attrs)).toEqual([
      { ordered: true, indent: 0 },
      { ordered: false, indent: 1 },
      { ordered: false, indent: 0 },
    ])
  })

  it('adopts a nested paragraph as list item content', () => {
    expect(roundTrip('<ul><li><p>a</p></li></ul>')).toBe('<ul><li>a</li></ul>')
  })

  it('splits a paragraph-like wrapper around nested blocks', () => {
    expect(roundTrip('<div><p>a</p><p>b</p></div>')).toBe('<p>a</p><p>b</p>')
  })

  it('maps <br> to \\n, dropping the trailing placeholder <br>', () => {
    expect(parse('<p>a<br>b<br></p>', schema)[0].children).toEqual([{ text: 'a\nb', marks: {} }])
    expect(parse('<p><br></p>', schema)[0].children).toEqual([])
  })

  it('treats source newlines as spaces, not breaks', () => {
    expect(parse('<p>a\nb</p>', schema)[0].children[0].text).toBe('a b')
  })

  it('wraps loose inline content in paragraphs and skips blank runs', () => {
    expect(roundTrip('hello <b>x</b><p>y</p>\n  ')).toBe('<p>hello <strong>x</strong></p><p>y</p>')
  })

  it('produces one empty paragraph for empty input', () => {
    const doc = parse('', schema)
    expect(doc).toHaveLength(1)
    expect(doc[0]).toMatchObject({ type: 'paragraph', children: [] })
  })

  it('preserves zero-width spaces', () => {
    expect(parse('<p>​x​</p>', schema)[0].children[0].text).toBe('​x​')
  })

  it('ignores data-block-id in parsed HTML (only the live editor DOM uses it)', () => {
    const doc = parse('<p data-block-id="abc">x</p>', schema)
    expect(doc[0].id).not.toBe('abc')
  })
})

describe('parse — sanitisation', () => {
  it('strips attributes from everything', () => {
    expect(
      roundTrip('<p style="x" class="y" onclick="z"><b data-x="1">b</b></p><h2 id="t">T</h2>'),
    ).toBe('<p><strong>b</strong></p><h2>T</h2>')
  })

  it('drops script, style, and Office XML subtrees without leaking their text', () => {
    expect(
      roundTrip('<p>a</p><script>alert(1)</script><style>.x{}</style><xml>96</xml><p>b</p>'),
    ).toBe('<p>a</p><p>b</p>')
    expect(roundTrip('<p>a<script>alert(1)</script></p>')).toBe('<p>a</p>')
  })

  it('drops comments, including MS Office conditional comments', () => {
    expect(roundTrip('<p>a</p><!--[if gte mso 9]><p>x</p><![endif]--><p>b</p>')).toBe(
      '<p>a</p><p>b</p>',
    )
  })

  it('unwraps unknown elements, keeping their content', () => {
    expect(roundTrip('<section><article><h1>T</h1><p>B</p></article></section>')).toBe(
      '<h1>T</h1><p>B</p>',
    )
    expect(roundTrip('<p><font color="red">hi</font><o:p></o:p></p>')).toBe('<p>hi</p>')
  })

  it('unwraps the Google Docs <b id="docs-internal-guid"> wrapper', () => {
    expect(
      roundTrip('<b style="font-weight:normal" id="docs-internal-guid-1"><p>a</p><p>b</p></b>'),
    ).toBe('<p>a</p><p>b</p>')
  })

  it('drops links with unsafe hrefs but keeps the text', () => {
    expect(
      roundTrip('<p><a href="javascript:alert(1)">x</a> <a href="data:text/html,1">y</a></p>'),
    ).toBe('<p>x y</p>')
  })

  it('never fires handlers while parsing (inert template)', () => {
    ;(globalThis as any).__fired = false
    parse('<img src="x" onerror="globalThis.__fired = true">', schema)
    expect((globalThis as any).__fired).toBe(false)
  })
})

describe('serialize', () => {
  it('escapes text and attributes', () => {
    const doc = parse('<p>&lt;b&gt; &amp; "q"</p>', schema)
    expect(serialize(doc, schema)).toBe('<p>&lt;b&gt; &amp; "q"</p>')
    const link = parse("<p><a href='https://x.example/?q=\"e'>x</a></p>", schema)
    expect(serialize(link, schema)).toBe('<p><a href="https://x.example/?q=&quot;e">x</a></p>')
  })

  it('renders empty blocks and trailing breaks with a placeholder <br>', () => {
    expect(roundTrip('<p></p>')).toBe('<p><br></p>')
    expect(roundTrip('<p>a<br><br></p>')).toBe('<p>a<br><br></p>')
  })

  it('serialises nested lists with the flat indent model', () => {
    expect(roundTrip('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul><ol><li>d</li></ol>')).toBe(
      '<ul><li>a</li><ul><li>b</li></ul><li>c</li></ul><ol><li>d</li></ol>',
    )
  })

  it('normalises tags and mark nesting to canonical order', () => {
    expect(roundTrip('<p><i><b>x</b></i><code><b>y</b></code></p>')).toBe(
      '<p><strong><em>x</em></strong><strong><code>y</code></strong></p>',
    )
  })

  it('adds data-block-id only when asked', () => {
    const doc = parse('<p>x</p>', schema)
    expect(serialize(doc, schema, true)).toBe(`<p data-block-id="${doc[0].id}">x</p>`)
  })

  it('clamps heading levels', () => {
    const doc = [{ id: 'a', type: 'heading', attrs: { level: '9 onclick=x' }, children: [] }]
    expect(serialize(doc, schema)).toBe('<h1><br></h1>')
  })
})

describe('round-trip is idempotent', () => {
  for (const html of [
    '<p>hello</p>',
    '<p><strong>bold</strong> and <em>italic</em></p>',
    '<h1>Title</h1><p>Body</p>',
    '<ul><li>a</li><li>b</li></ul>',
    '<ol><li>a</li><ul><li>b</li></ul></ol>',
    '<p>line<br>break</p>',
    '<p><a href="https://x.example">a</a><a href="https://y.example">b</a></p>',
    '<p><u>u</u><s>s</s><code>c</code></p>',
  ]) {
    it(html, () => {
      expect(roundTrip(html)).toBe(html)
      expect(roundTrip(roundTrip(html))).toBe(html)
    })
  }
})
