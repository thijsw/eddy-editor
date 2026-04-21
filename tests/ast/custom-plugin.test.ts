import { describe, it, expect } from 'vitest'
import { Schema } from '../../src/ast/schema'
import type { MarkSpec, BlockSpec } from '../../src/ast/schema'
import { parseHTML } from '../../src/ast/parse'
import { serializeToHTML } from '../../src/ast/serialize'
import { applyMarkToBlock } from '../../src/ast/commands'

/**
 * These tests prove that a third-party can contribute new mark and block
 * types to the schema without modifying the core — the whole point of the
 * refactored plugin system.
 */

// Built-in baseline specs (copies of what the default plugins contribute —
// duplicated here so these tests don't depend on plugin internals).
const paragraphSpec: BlockSpec = {
  type: 'paragraph',
  parseDOM: [{ tag: 'p' }, { tag: 'div' }],
  toDOM: () => ['p'],
}
const boldSpec: MarkSpec = {
  type: 'bold',
  parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
  toDOM: () => ['strong'],
}

describe('Schema: last-wins dedup', () => {
  it('later MarkSpec for the same type overrides the earlier, keeping canonical position', () => {
    const a: MarkSpec = { type: 'bold', parseDOM: [{ tag: 'strong' }], toDOM: () => ['strong'] }
    const b: MarkSpec = {
      type: 'italic',
      parseDOM: [{ tag: 'em' }],
      toDOM: () => ['em'],
    }
    const boldOverride: MarkSpec = {
      type: 'bold',
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM: () => ['b'],
    }
    const schema = new Schema([a, b, boldOverride], [paragraphSpec])

    // Spec registered under 'bold' is the override (toDOM produces <b>).
    const out = serializeToHTML(parseHTML('<p><strong>x</strong></p>', schema), schema)
    expect(out).toBe('<p><b>x</b></p>')

    // Canonical order is fixed by first declaration — bold still wraps italic.
    expect(schema.markOrder).toEqual(['bold', 'italic'])
  })

  it('later BlockSpec for the same type overrides the earlier', () => {
    const first: BlockSpec = {
      type: 'heading',
      parseDOM: [{ tag: 'h1' }],
      toDOM: () => ['h1'],
    }
    const override: BlockSpec = {
      type: 'heading',
      parseDOM: [{ tag: 'h1' }, { tag: 'h2' }],
      toDOM: () => ['h2'],
    }
    const schema = new Schema([], [paragraphSpec, first, override])
    expect(schema.blocks.get('heading')).toBe(override)
    // Override's rule for h2 is now registered (and after the `first`'s h1).
    const h2Rules = schema.blockRulesForTag('h2')
    expect(h2Rules).toHaveLength(1)
    expect(h2Rules[0].spec).toBe(override)
  })
})

describe('Schema: paragraph is a baseline invariant', () => {
  it('auto-injects a paragraph spec when none is contributed', () => {
    const schema = new Schema([boldSpec], [])
    const spec = schema.blocks.get('paragraph')
    expect(spec).toBeDefined()
    expect(spec?.toDOM({ id: 'x', type: 'paragraph', attrs: {}, children: [] })).toEqual(['p'])
  })

  it('uses a consumer-provided paragraph spec when present', () => {
    const custom: BlockSpec = {
      type: 'paragraph',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', { class: 'custom' }],
    }
    const schema = new Schema([], [custom])
    const out = serializeToHTML(parseHTML('<p>hi</p>', schema), schema)
    expect(out).toBe('<p class="custom">hi</p>')
  })
})

describe('custom mark plugin: highlight', () => {
  const highlightSpec: MarkSpec = {
    type: 'highlight',
    parseDOM: [{ tag: 'mark' }],
    toDOM: () => ['mark'],
  }

  const schema = new Schema([boldSpec, highlightSpec], [paragraphSpec])

  it('parses <mark> into the custom highlight mark', () => {
    const doc = parseHTML('<p>before <mark>yellow</mark> after</p>', schema)
    const children = (doc.blocks[0] as any).children
    expect(children[1].text).toBe('yellow')
    expect(children[1].marks).toContainEqual({ type: 'highlight' })
  })

  it('serialises the highlight mark back to <mark>', () => {
    const doc = parseHTML('<p><mark>hl</mark></p>', schema)
    expect(serializeToHTML(doc, schema)).toBe('<p><mark>hl</mark></p>')
  })

  it('combines with built-in marks in canonical order', () => {
    // bold (registered first) wraps highlight (registered second)
    const doc = parseHTML('<p><mark><strong>x</strong></mark></p>', schema)
    expect(serializeToHTML(doc, schema)).toBe('<p><strong><mark>x</mark></strong></p>')
  })

  it('is dropped if the schema does not recognise it', () => {
    const baseSchema = new Schema([boldSpec], [paragraphSpec])
    const doc = parseHTML('<p><mark>no-plugin</mark></p>', baseSchema)
    // <mark> isn't a mark spec, isn't a block, isn't inline-like — the parser
    // unwraps it, so the text survives without any highlight mark.
    expect(serializeToHTML(doc, baseSchema)).toBe('<p>no-plugin</p>')
  })
})

describe('custom block plugin: blockquote', () => {
  const blockquoteSpec: BlockSpec = {
    type: 'blockquote',
    parseDOM: [{ tag: 'blockquote' }],
    toDOM: () => ['blockquote'],
  }

  const schema = new Schema([boldSpec], [paragraphSpec, blockquoteSpec])

  it('parses <blockquote> into a blockquote block', () => {
    const doc = parseHTML('<blockquote>quoted</blockquote>', schema)
    expect(doc.blocks.length).toBe(1)
    expect(doc.blocks[0].type).toBe('blockquote')
  })

  it('serialises back to <blockquote>', () => {
    const doc = parseHTML('<blockquote>quoted</blockquote>', schema)
    expect(serializeToHTML(doc, schema)).toBe('<blockquote>quoted</blockquote>')
  })

  it('preserves inline marks inside the custom block', () => {
    const doc = parseHTML('<blockquote>hello <strong>world</strong></blockquote>', schema)
    expect(serializeToHTML(doc, schema)).toBe(
      '<blockquote>hello <strong>world</strong></blockquote>',
    )
  })
})

describe('plugin-contributed schema rules', () => {
  it('normalisation rule contributed by a plugin runs on every mutation', async () => {
    // Rule: whenever a paragraph's text starts with "# ", promote it to h1.
    const { applySchema } = await import('../../src/ast/schema')
    const { defaultRules } = await import('../../src/ast/schema')
    const autoHeading = (d: import('../../src/ast/types').DocumentNode) => ({
      type: 'document' as const,
      blocks: d.blocks.map((b) => {
        if (b.type !== 'paragraph') return b
        const first = b.children[0]
        if (first?.type !== 'text' || !first.text.startsWith('# ')) return b
        return {
          ...b,
          type: 'heading',
          attrs: { level: 1 },
          children: [{ ...first, text: first.text.slice(2) }, ...b.children.slice(1)],
        }
      }),
    })

    const doc: import('../../src/ast/types').DocumentNode = {
      type: 'document',
      blocks: [
        {
          id: 'b0',
          type: 'paragraph',
          attrs: {},
          children: [{ type: 'text', text: '# Title', marks: [] }],
        },
      ],
    }
    const out = applySchema(doc, [...defaultRules, autoHeading])
    expect(out.blocks[0].type).toBe('heading')
    expect(out.blocks[0].attrs.level).toBe(1)
    expect((out.blocks[0] as any).children[0].text).toBe('Title')
  })
})

describe('MarkSpec.excludes', () => {
  const highlightSpec: MarkSpec = {
    type: 'highlight',
    parseDOM: [{ tag: 'mark' }],
    toDOM: () => ['mark'],
    excludes: ['code'],
  }
  const codeSpec: MarkSpec = {
    type: 'code',
    parseDOM: [{ tag: 'code' }],
    toDOM: () => ['code'],
  }
  const schema = new Schema([highlightSpec, codeSpec], [paragraphSpec])

  it('applying a mark strips excluded marks from the range', () => {
    const block = {
      id: 'b0',
      type: 'paragraph',
      attrs: {},
      children: [{ type: 'text' as const, text: 'hello', marks: [{ type: 'code' }] }],
    }
    const result = applyMarkToBlock(
      block,
      { blockId: 'b0', inlineIndex: 0, offset: 0 },
      { blockId: 'b0', inlineIndex: 0, offset: 5 },
      'highlight',
      false,
      undefined,
      ['code'],
    )
    expect(result.children[0]).toMatchObject({
      text: 'hello',
      marks: [{ type: 'highlight' }],
    })
  })

  it('schema exposes excludes on the spec so the Editor can thread it through', () => {
    expect(schema.marks.get('highlight')?.excludes).toEqual(['code'])
  })
})

describe('ParseRule.getAttrs', () => {
  it('returning `false` vetoes the rule; parser falls through', () => {
    // Simulate a `link` mark that rejects unsafe hrefs via getAttrs.
    const linkSpec: MarkSpec = {
      type: 'link',
      parseDOM: [
        {
          tag: 'a',
          getAttrs: (el) => {
            const href = el.getAttribute('href')
            if (!href || href.startsWith('javascript:')) return false
            return { href }
          },
        },
      ],
      attrs: { href: {} },
      toDOM: (mark) => ['a', { href: String(mark.attrs?.href ?? '') }],
    }
    const schema = new Schema([linkSpec], [paragraphSpec])

    // Safe href: mark applied.
    const ok = parseHTML('<p><a href="https://example.com">ok</a></p>', schema)
    expect(serializeToHTML(ok, schema)).toBe('<p><a href="https://example.com">ok</a></p>')

    // javascript: href: rule vetoes, mark dropped, text preserved.
    const bad = parseHTML('<p><a href="javascript:alert(1)">bad</a></p>', schema)
    expect(serializeToHTML(bad, schema)).toBe('<p>bad</p>')
  })

  it('returning an object supplies attrs directly (multiple rules per tag are tried in order)', () => {
    // A "bold" plugin that claims both <strong> and <span style=font-weight>.
    const boldSpec: MarkSpec = {
      type: 'bold',
      parseDOM: [
        { tag: 'strong' },
        {
          tag: 'span',
          getAttrs: (el) => {
            const w = (el as HTMLElement).style.fontWeight
            if (w === '' || w === 'normal') return false
            return {} // accept with no attrs
          },
        },
      ],
      toDOM: () => ['strong'],
    }
    const schema = new Schema([boldSpec], [paragraphSpec])

    // Bare <span> — bold rule vetoes, span unwraps normally.
    const plain = parseHTML('<p><span>hi</span></p>', schema)
    expect(serializeToHTML(plain, schema)).toBe('<p>hi</p>')

    // <span style="font-weight:700"> — bold rule matches via getAttrs.
    const styled = parseHTML('<p><span style="font-weight:700">hi</span></p>', schema)
    expect(serializeToHTML(styled, schema)).toBe('<p><strong>hi</strong></p>')
  })
})

describe('nested DOMOutput', () => {
  it('serialises a code block as <pre><code>…</code></pre>', () => {
    const codeBlockSpec: BlockSpec = {
      type: 'codeBlock',
      parseDOM: [{ tag: 'pre' }],
      toDOM: () => ['pre', ['code', 0]],
    }
    const schema = new Schema([], [paragraphSpec, codeBlockSpec])
    const doc = parseHTML('<pre>hello</pre>', schema)
    expect(serializeToHTML(doc, schema)).toBe('<pre><code>hello</code></pre>')
  })

  it('supports attrs at a nested level', () => {
    const calloutSpec: BlockSpec = {
      type: 'callout',
      parseDOM: [{ tag: 'aside' }],
      toDOM: () => ['aside', { role: 'note' }, ['div', { class: 'body' }, 0]],
    }
    const schema = new Schema([], [paragraphSpec, calloutSpec])
    const doc = parseHTML('<aside>hi</aside>', schema)
    expect(serializeToHTML(doc, schema)).toBe(
      '<aside role="note"><div class="body">hi</div></aside>',
    )
  })
})

describe('custom grouped-block plugin: task list', () => {
  const taskItemSpec: BlockSpec = {
    type: 'taskItem',
    parseDOM: [{ tag: 'li' }],
    attrs: {
      checked: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-checked') === 'true',
      },
    },
    toDOM: (block) => ['li', block.attrs.checked ? { 'data-checked': 'true' } : {}],
    group: {
      containerTags: ['task-list'],
      parseContainer: () => ({}),
      containerTag: () => 'task-list',
      depth: () => 0,
    },
  }

  const schema = new Schema([], [paragraphSpec, taskItemSpec])

  it('parses and serialises a grouped custom block', () => {
    const html = '<task-list><li data-checked="true">A</li><li>B</li></task-list>'
    const doc = parseHTML(html, schema)
    expect(doc.blocks.length).toBe(2)
    expect(doc.blocks[0].type).toBe('taskItem')
    expect(doc.blocks[0].attrs.checked).toBe(true)
    expect(doc.blocks[1].attrs.checked).toBe(false)

    const out = serializeToHTML(doc, schema)
    expect(out).toBe('<task-list><li data-checked="true">A</li><li>B</li></task-list>')
  })
})
