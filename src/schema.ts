// Schema: HTML ⇄ document. Parsing needs a DOM (browser, jsdom, happy-dom);
// serialising is pure string building and runs anywhere.

import type { Attrs, Block, Doc, TextNode } from './model'
import { createBlock, eq, newId } from './model'
import type { Plugin } from './types'

/**
 * Rendering shape: a tag name, or `[tag, attrs?, ...children]` where a child
 * is a nested shape or `0` (the content hole). Without children the content
 * goes directly inside the tag: `['a', { href }]` → `<a href="…">…</a>`.
 */
export type DOMSpec = string | readonly [string, ...(Attrs | DOMSpec | 0)[]]

export interface MarkSpec {
  /** CSS selector of elements that carry this mark, e.g. `'strong,b'`. */
  match: string
  /** Read attrs from a matched element. Return `false` to reject the match. */
  attrs?(el: Element): Attrs | false | void
  render: DOMSpec | ((attrs: Attrs) => DOMSpec)
  /** Mark types removed from the range when this mark is applied. */
  excludes?: readonly string[]
}

export interface BlockSpec {
  /** CSS selector of elements that become this block, e.g. `'h1,h2'`. */
  match: string
  /**
   * Read attrs from a matched element. Return `false` to reject the match.
   * `root` is the node being parsed, for walking up through wrappers.
   */
  attrs?(el: Element, root: Node): Attrs | false | void
  render: DOMSpec | ((block: Block) => DOMSpec)
  /**
   * Leaf block rendered entirely by `render` (embeds, dividers). Its live
   * element survives re-renders untouched, so iframes never reload.
   */
  atom?: boolean
  /** Enter continues this block type (list items); Enter on an empty one exits to a paragraph. */
  continues?: boolean
  /** Wrap consecutive blocks in a container: `[tag, depth]`, e.g. `['ul', 0]`. */
  group?(block: Block): [tag: string, depth: number]
}

export interface Schema {
  marks: Record<string, MarkSpec>
  blocks: Record<string, BlockSpec>
  normalize: ((doc: Doc) => Doc)[]
  /** Selector matching any block element. */
  sel: string
}

export function createSchema(plugins: readonly Plugin[] = []): Schema {
  const s: Schema = {
    marks: {},
    blocks: { paragraph: { match: 'p,div', render: 'p' } },
    normalize: [],
    sel: '',
  }
  // Object.assign keeps the first key position but takes the last value:
  // later plugins override, canonical order (mark nesting) stays stable.
  for (const p of plugins) {
    Object.assign(s.marks, p.marks)
    Object.assign(s.blocks, p.blocks)
    if (p.normalize) s.normalize.push(p.normalize)
  }
  s.sel = Object.values(s.blocks)
    .map((b) => b.match)
    .join()
  return s
}

/** Merge adjacent runs with equal marks, drop empty runs, run plugin rules. */
export function normalize(doc: Doc, schema: Schema): Doc {
  doc = doc.map((b) => {
    const c: TextNode[] = []
    for (const t of b.children) {
      const last = c[c.length - 1]
      if (!t.text) continue
      if (last && eq(last.marks, t.marks))
        c[c.length - 1] = { text: last.text + t.text, marks: last.marks }
      else c.push(t)
    }
    return c.length == b.children.length && c.every((t, i) => t == b.children[i])
      ? b
      : { ...b, children: c }
  })
  doc = schema.normalize.reduce((d, f) => f(d), doc)
  return doc.length ? doc : [createBlock()]
}

// Subtrees whose text must never leak into the document. <o:p> is Word padding.
const DROP = 'script,style,template,head,title,meta,link,noscript,xml,o\\:p'
// Dropped unless a block spec claims them (embed plugins).
const EMBED = 'iframe,object,embed'
const SKIP = DROP + ',' + EMBED
const ID = 'data-block-id'

/**
 * Parse HTML (a string, or a live node's children) into a document. Pass
 * `live` (the blocks currently shown) when parsing the editor's own DOM:
 * block ids are then read from — and written back to — the elements, and
 * atom blocks keep their identity.
 */
export function parse(input: string | Node, schema: Schema, live?: Map<string, Block>): Doc {
  let root = input as Node
  if (typeof input == 'string') {
    // <template> is inert: no image loads, no event handlers fire.
    const t = document.createElement('template')
    t.innerHTML = input
    root = t.content
  }
  const blocks = Object.entries(schema.blocks).reverse()
  const marks = Object.entries(schema.marks)
  const seen = new Set<string>()
  const isEl = (n: Node): n is Element => n.nodeType == 1
  const blocky = (n: Node) => isEl(n) && (n.matches(schema.sel) || !!n.querySelector(schema.sel))
  const hasText = (c: TextNode[]) => c.some((t) => t.text.trim())
  // A block's trailing <br> never renders; it is a placeholder, not a line break.
  const strip = (c: TextNode[]) => {
    const l = c[c.length - 1]
    if (l?.text.endsWith('\n')) c[c.length - 1] = { text: l.text.slice(0, -1), marks: l.marks }
    return c
  }

  const match = (el: Element) => {
    for (const [type, spec] of blocks) {
      if (!el.matches(spec.match)) continue
      const attrs = spec.attrs ? spec.attrs(el, root) : {}
      if (attrs !== false) return [type, spec, attrs || {}] as const
    }
    return undefined
  }

  const inline = (n: Node, m: Attrs): TextNode[] => {
    if (n.nodeType == 3) return [{ text: (n as Text).data.replace(/[\r\n]/g, ' '), marks: m }]
    if (!isEl(n) || n.matches(SKIP)) return []
    if (n.nodeName == 'BR') return [{ text: '\n', marks: m }]
    for (const [type, spec] of marks) {
      if (!n.matches(spec.match)) continue
      const attrs = spec.attrs ? spec.attrs(n) : {}
      if (attrs !== false) m = { ...m, [type]: attrs || {} }
    }
    return [...n.childNodes].flatMap((c) => inline(c, m))
  }

  // An element that isn't a block itself: its loose inline content becomes
  // paragraphs, block descendants are parsed in place (unwrapping).
  const container = (el: Node, out: Doc) => {
    let run: TextNode[] = []
    const flush = () => {
      if (hasText(run)) out.push(createBlock('paragraph', strip(run)))
      run = []
    }
    for (const n of el.childNodes) {
      if (blocky(n)) {
        flush()
        block(n as Element, out)
      } else run.push(...inline(n, {}))
    }
    flush()
  }

  const block = (el: Element, out: Doc): void => {
    if (el.matches(DROP)) return
    const m = match(el)
    if (!m) {
      if (!el.matches(EMBED)) container(el, out)
      return
    }
    const [type, spec, attrs] = m
    let id = live && el.getAttribute(ID)
    if (!id || !/^\w+$/.test(id) || seen.has(id)) {
      id = newId()
      if (live) el.setAttribute(ID, id)
    }
    seen.add(id)
    const old = live?.get(id)
    if (spec.atom) {
      out.push(old?.type == type ? old : { id, type, attrs, children: [] })
      return
    }
    const b: Block = { id, type, attrs, children: [] }
    const after: Doc = []
    out.push(b)
    for (const n of el.childNodes) {
      if (!blocky(n)) b.children.push(...inline(n, {}))
      else if (!after.length && !hasText(b.children) && match(n as Element)) {
        // `<li><p>text</p></li>`: adopt the first nested block's content.
        block(n as Element, after)
        const first = after[0]
        if (first && !schema.blocks[first.type].atom) b.children = after.shift()!.children
      } else block(n as Element, after)
    }
    strip(b.children)
    out.push(...after)
  }

  const doc: Doc = []
  container(root, doc)
  return normalize(doc, schema)
}

const VOID = /^(area|br|col|embed|hr|img|input|source|track|wbr)$/i
const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (s: string, attr?: 1) => s.replace(attr ? /[&<>"]/g : /[&<>]/g, (c) => ENT[c])
const call = <T>(r: DOMSpec | ((x: T) => DOMSpec), x: T): DOMSpec =>
  typeof r == 'function' ? r(x) : r

function dom(spec: DOMSpec, inner: string, extra = ''): string {
  const [tag, ...rest] = typeof spec == 'string' ? [spec] : spec
  let attrs = ''
  const first = rest[0]
  if (first && typeof first == 'object' && !Array.isArray(first)) {
    rest.shift()
    for (const [k, v] of Object.entries(first))
      if (v != null) attrs += ` ${k}="${esc(String(v), 1)}"`
  }
  if (VOID.test(tag)) return `<${tag}${attrs}${extra}>`
  const body = rest.length
    ? rest.map((c) => (c === 0 ? inner : dom(c as DOMSpec, inner))).join('')
    : inner
  return `<${tag}${attrs}${extra}>${body}</${tag}>`
}

/** Serialise a document to HTML. `ids` adds `data-block-id` (editor DOM only). */
export function serialize(doc: Doc, schema: Schema, ids?: boolean): string {
  const markTypes = Object.keys(schema.marks).reverse()
  const stack: string[] = []
  let html = ''
  for (const b of doc) {
    const spec = schema.blocks[b.type] || schema.blocks.paragraph
    const [tag, depth] = spec.group?.(b) ?? ['', -1]
    while (
      stack.length > depth + 1 ||
      (stack.length && stack.length == depth + 1 && stack[depth] != tag)
    ) {
      html += `</${stack.pop()}>`
    }
    while (stack.length <= depth) html += `<${(stack[stack.length] = tag)}>`
    const last = b.children[b.children.length - 1]
    const inner = spec.atom
      ? ''
      : b.children
          .map((t) =>
            markTypes.reduce(
              (h, m) => (t.marks[m] ? dom(call(schema.marks[m].render, t.marks[m]), h) : h),
              esc(t.text).replace(/\n/g, '<br>'),
            ),
          )
          .join('') + (last?.text.endsWith('\n') ? '<br>' : '') || '<br>'
    html += dom(call(spec.render, b), inner, ids ? ` ${ID}="${b.id}"` : '')
  }
  while (stack.length) html += `</${stack.pop()}>`
  return html
}
