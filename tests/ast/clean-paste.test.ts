import { describe, it, expect } from 'vitest'
import { cleanPastedHTML } from '../../src/ast/clean-paste'

describe('cleanPastedHTML', () => {
  it('returns empty string for empty input', () => {
    expect(cleanPastedHTML('')).toBe('')
  })

  it('leaves well-formed content untouched', () => {
    const input = '<p>hello <strong>world</strong></p>'
    expect(cleanPastedHTML(input)).toBe('<p>hello <strong>world</strong></p>')
  })

  it('drops <script> blocks', () => {
    expect(cleanPastedHTML('<p>before</p><script>alert(1)</script><p>after</p>')).toBe(
      '<p>before</p><p>after</p>',
    )
  })

  it('drops <style> blocks', () => {
    expect(cleanPastedHTML('<style>.x{color:red}</style><p>hi</p>')).toBe('<p>hi</p>')
  })

  it('strips inline style/class/id attributes', () => {
    expect(
      cleanPastedHTML(
        '<p style="color:red" class="foo" id="bar"><strong style="x">bold</strong></p>',
      ),
    ).toBe('<p><strong>bold</strong></p>')
  })

  it('preserves href on <a> tags', () => {
    expect(cleanPastedHTML('<a href="https://example.com" class="x">x</a>')).toBe(
      '<a href="https://example.com">x</a>',
    )
  })

  it('drops MS Office conditional comments and their wrapped markup', () => {
    const input = '<p>before</p><!--[if gte mso 9]><xml><o:p/></xml><![endif]--><p>after</p>'
    expect(cleanPastedHTML(input)).toBe('<p>before</p><p>after</p>')
  })

  it('drops <o:p> and similar Office-namespaced tags', () => {
    expect(cleanPastedHTML('<p>hi<o:p></o:p></p>')).toBe('<p>hi</p>')
  })

  it('preserves <p class="MsoNormal"> as a bare <p> (class stripped)', () => {
    // Allowed tag with a noisy class: keep the tag, drop the attrs.
    const out = cleanPastedHTML('<p class="MsoNormal">Hello <b>world</b></p>')
    expect(out).toBe('<p>Hello <b>world</b></p>')
  })

  it('unwraps unknown tags, keeping their children', () => {
    // <section>, <article>, <font> are not in the allowlist — unwrap.
    expect(cleanPastedHTML('<section><p>hello</p></section>')).toBe('<p>hello</p>')
    expect(cleanPastedHTML('<font color="red">hi</font>')).toBe('hi')
  })

  it('strips empty <p>&nbsp;</p> spacers', () => {
    expect(cleanPastedHTML('<p>a</p><p>\u00A0</p><p>b</p>')).toBe('<p>a</p><p>b</p>')
  })

  it('preserves empty <p><br></p> (intentional line break)', () => {
    expect(cleanPastedHTML('<p>a</p><p><br></p><p>b</p>')).toBe('<p>a</p><p><br></p><p>b</p>')
  })

  it('drops HTML comments', () => {
    expect(cleanPastedHTML('<p>a</p><!-- note --><p>b</p>')).toBe('<p>a</p><p>b</p>')
  })

  it('handles Google Docs wrapper <b id="docs-internal-guid-…">', () => {
    const input = '<b id="docs-internal-guid-abc" style="font-weight:normal"><p>Hello</p></b>'
    // The outer <b> keeps its tag but loses attrs; content is preserved.
    const out = cleanPastedHTML(input)
    expect(out).toContain('<p>Hello</p>')
    expect(out).not.toContain('docs-internal-guid')
    expect(out).not.toContain('style=')
  })
})
