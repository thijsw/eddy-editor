// Document model + pure helpers. Everything here is DOM-free.
//
// A document is a flat list of blocks. A block holds a list of text runs;
// hard line breaks are `\n` characters inside a run. Positions are character
// offsets within a block, so normalisation (merging runs) never moves them.

export type Attrs = Record<string, any>
/** Mark type → mark attrs (`{}` for attribute-less marks like bold). */
export type Marks = Record<string, Attrs>

export interface TextNode {
  text: string
  marks: Marks
}

export interface Block {
  id: string
  type: string
  attrs: Attrs
  children: TextNode[]
}

export type Doc = Block[]

export interface Pos {
  /** Block id. */
  block: string
  /** Character offset within the block's text. */
  offset: number
}

export interface Selection {
  anchor: Pos
  head: Pos
}

/**
 * A pure document transform. Return `[doc]` to keep the selection,
 * `[doc, sel]` to move it, or nothing to abort.
 */
export type Transform = (doc: Doc, sel: Selection) => [Doc, Selection?] | void

let ids = 0
export const newId = (): string => (++ids).toString(36)

export const createBlock = (
  type = 'paragraph',
  children: TextNode[] = [],
  attrs: Attrs = {},
): Block => ({ id: newId(), type, attrs, children })

/** Structural equality for plain JSON-like values (marks, attrs, blocks). */
export const eq = (a: any, b: any): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    typeof a == 'object' &&
    typeof b == 'object' &&
    Object.keys(a).length == Object.keys(b).length &&
    Object.keys(a).every((k) => eq(a[k], b[k])))

export const textLength = (c: TextNode[]): number => c.reduce((n, t) => n + t.text.length, 0)

/** The runs between two character offsets, split at the boundaries. */
export function slice(c: TextNode[], from = 0, to = Infinity): TextNode[] {
  const out: TextNode[] = []
  let pos = 0
  for (const t of c) {
    const text = t.text.slice(Math.max(0, from - pos), Math.max(0, to - pos))
    if (text) out.push({ text, marks: t.marks })
    pos += t.text.length
  }
  return out
}

export const caret = (block: string, offset = 0): Selection => {
  const p = { block, offset }
  return { anchor: p, head: p }
}

export const isCollapsed = (s: Selection): boolean => eq(s.anchor, s.head)

export const indexOf = (doc: Doc, id: string): number => doc.findIndex((b) => b.id == id)

/** Selection endpoints in document order, plus their block indexes. */
export function range(doc: Doc, s: Selection): [Pos, Pos, number, number] {
  let a = s.anchor
  let h = s.head
  let i = indexOf(doc, a.block)
  let j = indexOf(doc, h.block)
  if (i > j || (i == j && a.offset > h.offset)) [a, h, i, j] = [h, a, j, i]
  return [a, h, i, j]
}

/** Add (`attrs`) or remove (`null`) a mark across the selection. */
export function markRange(
  doc: Doc,
  s: Selection,
  type: string,
  attrs: Attrs | null,
  excludes: readonly string[] = [],
): Doc {
  const [a, h, i, j] = range(doc, s)
  return doc.map((b, k) => {
    if (k < i || k > j) return b
    const from = k == i ? a.offset : 0
    const to = k == j ? h.offset : Infinity
    const mid = slice(b.children, from, to).map((t) => {
      const marks = { ...t.marks }
      delete marks[type]
      if (attrs) {
        for (const x of excludes) delete marks[x]
        marks[type] = attrs
      }
      return { text: t.text, marks }
    })
    return { ...b, children: [...slice(b.children, 0, from), ...mid, ...slice(b.children, to)] }
  })
}

/**
 * Marks shared by all text in the selection. For a collapsed selection,
 * the marks of the character before the cursor (or after, at block start).
 */
export function marksAt(doc: Doc, s: Selection): Marks {
  const [a, h, i, j] = range(doc, s)
  const runs: TextNode[] = []
  if (isCollapsed(s)) {
    const o = a.offset
    runs.push(...slice(doc[i].children, o ? o - 1 : 0, o || 1))
  } else {
    for (let k = i; k <= j; k++) {
      runs.push(...slice(doc[k].children, k == i ? a.offset : 0, k == j ? h.offset : Infinity))
    }
  }
  if (!runs.length) return {}
  const m = { ...runs[0].marks }
  for (const t of runs) for (const k in m) if (!eq(m[k], t.marks[k])) delete m[k]
  return m
}
