import type { Doc, Selection } from './model'
import { indexOf, isCollapsed, markRange, range } from './model'
import type { Editor, Plugin } from './types'

// Icons: Lucide (https://lucide.dev), ISC License,
// Copyright (c) Lucide Contributors 2022; portions Feather (MIT), Cole Bemis.
const p = (...d: string[]) => d.map((x) => `<path d="${x}"/>`).join('')

const mark = (
  type: string,
  match: string,
  tag: string,
  title: string,
  icon: string,
  key?: string,
): Plugin => {
  const run = (ed: Editor) => ed.toggleMark(type)
  return {
    marks: { [type]: { match, render: tag } },
    keys: key ? { [key]: run } : {},
    toolbar: [{ title, icon, run, active: (ed) => type in ed.getMarks() }],
  }
}

export const bold = mark(
  'bold',
  'strong,b',
  'strong',
  'Bold (Mod+B)',
  p('M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8'),
  'mod+b',
)
export const italic = mark(
  'italic',
  'em,i',
  'em',
  'Italic (Mod+I)',
  p('M19 4h-9', 'M14 20H5', 'M15 4 9 20'),
  'mod+i',
)
export const underline = mark(
  'underline',
  'u',
  'u',
  'Underline (Mod+U)',
  p('M6 4v6a6 6 0 0 0 12 0V4', 'M4 20h16'),
  'mod+u',
)
export const strikethrough = mark(
  'strikethrough',
  's,strike,del',
  's',
  'Strikethrough',
  p('M16 4H9a3 3 0 0 0-2.83 4', 'M14 12a4 4 0 0 1 0 8H6', 'M4 12h16'),
)
export const code = mark(
  'code',
  'code',
  'code',
  'Code (Mod+E)',
  p('m16 18 6-6-6-6', 'm8 6-6 6 6 6'),
  'mod+e',
)

// ── Link ────────────────────────────────────────────────────────────────────

/**
 * A safe href, or null. Allows http(s), mailto, tel, and relative URLs;
 * rejects javascript:, data:, vbscript:, and anything with control characters.
 */
export function sanitizeHref(raw: unknown): string | null {
  if (typeof raw != 'string') return null
  const s = raw.trim()
  // eslint-disable-next-line no-control-regex
  if (!s || /[\0-\x1f\x7f]/.test(s)) return null
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(s)?.[1].toLowerCase()
  return !scheme || /^(https?|mailto|tel)$/.test(scheme) ? s : null
}

/** The full extent of the link under a collapsed cursor. */
function linkRange(doc: Doc, s: Selection): Selection | null {
  if (!isCollapsed(s)) return s
  const { block, offset } = s.anchor
  const c = doc[indexOf(doc, block)].children
  let k = 0
  let start = 0
  // The run holding the character before the cursor (or after, at offset 0).
  while (k < c.length - 1 && start + c[k].text.length < Math.max(offset, 1))
    start += c[k++].text.length
  const href = c[k]?.marks.link?.href
  if (href == null) return null
  const same = (i: number) => c[i]?.marks.link?.href === href
  let i = k
  while (same(i - 1)) start -= c[--i].text.length
  let end = start
  while (same(i)) end += c[i++].text.length
  return { anchor: { block, offset: start }, head: { block, offset: end } }
}

/** Link the selection (or the link under the cursor) to `href`; `null` unlinks. */
export function setLink(ed: Editor, href: string | null): void {
  const safe = sanitizeHref(href)
  if (href != null && !safe) return
  ed.apply((d, s) => {
    const r = linkRange(d, s)
    return r && !isCollapsed(r)
      ? [markRange(d, r, 'link', safe ? { href: safe } : null)]
      : undefined
  })
}

/** `window.prompt` UX: edit the link under the cursor, or link the selection. */
export function promptLink(ed: Editor): void {
  const current = ed.getMarks().link?.href
  const s = ed.selection
  if (current == null && (!s || isCollapsed(s))) return
  const input = prompt(current ? 'Edit link URL' : 'Link URL', current || '')
  if (input != null) setLink(ed, input.trim() || null)
}

export const link: Plugin = {
  marks: {
    link: {
      match: 'a[href]',
      attrs: (el) => {
        const href = sanitizeHref(el.getAttribute('href'))
        return href ? { href } : false
      },
      render: (a) => ['a', { href: sanitizeHref(a.href) || '' }],
    },
  },
  keys: { 'mod+k': promptLink },
  toolbar: [
    {
      title: 'Link (Mod+K)',
      icon: p(
        'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
        'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
      ),
      run: promptLink,
      active: (ed) => 'link' in ed.getMarks(),
    },
  ],
}

// ── Heading ─────────────────────────────────────────────────────────────────

export const heading: Plugin = {
  blocks: {
    heading: {
      match: 'h1,h2,h3,h4,h5,h6',
      attrs: (el) => ({ level: +el.tagName[1] }),
      render: (b) => 'h' + Math.min(Math.max(b.attrs.level | 0, 1), 6),
    },
  },
  toolbar: [
    {
      title: 'Block type',
      options: [
        ['paragraph', 'Normal'],
        ...[1, 2, 3, 4, 5, 6].map((n) => ['h' + n, 'Heading ' + n] as const),
      ],
      value: (ed) => {
        const b = ed.getBlock()
        return b?.type == 'heading' ? 'h' + b.attrs.level : 'paragraph'
      },
      run: (ed, v) =>
        v[0] == 'h' ? ed.setBlock('heading', { level: +v[1] }) : ed.setBlock('paragraph'),
    },
  ],
}

// ── List ────────────────────────────────────────────────────────────────────

const isList = (ed: Editor, ordered: boolean) => {
  const b = ed.getBlock()
  return b?.type == 'listItem' && !!b.attrs.ordered == ordered
}

/** Toggle the selected blocks between list items and paragraphs. */
export function toggleList(ed: Editor, ordered: boolean): void {
  ed.apply((d, s) => {
    const [, , i, j] = range(d, s)
    const all = d
      .slice(i, j + 1)
      .every((b) => b.type == 'listItem' && !!b.attrs.ordered == ordered && !b.attrs.indent)
    return [
      d.map((b, k) =>
        k < i || k > j || ed.schema.blocks[b.type]?.atom
          ? b
          : all
            ? { ...b, type: 'paragraph', attrs: {} }
            : { ...b, type: 'listItem', attrs: { ordered, indent: 0 } },
      ),
    ]
  })
}

export const list: Plugin = {
  blocks: {
    listItem: {
      match: 'li',
      continues: true,
      attrs(el, root) {
        let ordered = false
        let depth = -1
        for (let n = el.parentNode; n && n != root; n = n.parentNode) {
          if (n.nodeName == 'UL' || n.nodeName == 'OL') {
            if (depth < 0) ordered = n.nodeName == 'OL'
            depth++
          }
        }
        return { ordered, indent: Math.max(depth, 0) }
      },
      render: 'li',
      group: (b) => [b.attrs.ordered ? 'ol' : 'ul', b.attrs.indent || 0],
    },
  },
  toolbar: [
    {
      title: 'Bullet list',
      icon: p('M3 12h.01', 'M3 18h.01', 'M3 6h.01', 'M8 12h13', 'M8 18h13', 'M8 6h13'),
      run: (ed: Editor) => toggleList(ed, false),
      active: (ed: Editor) => isList(ed, false),
    },
    {
      title: 'Numbered list',
      icon: p(
        'M10 12h11',
        'M10 18h11',
        'M10 6h11',
        'M4 10h2',
        'M4 6h1v4',
        'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
      ),
      run: (ed: Editor) => toggleList(ed, true),
      active: (ed: Editor) => isList(ed, true),
    },
  ],
}

export const defaultPlugins: Plugin[] = [
  bold,
  italic,
  underline,
  strikethrough,
  code,
  link,
  heading,
  list,
]
