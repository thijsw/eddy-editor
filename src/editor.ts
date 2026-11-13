import type { Block, Doc, Selection, TextNode, Transform } from './model'
import {
  caret,
  createBlock,
  eq,
  indexOf,
  isCollapsed,
  markRange,
  marksAt,
  range,
  slice,
  textLength,
} from './model'
import { createSchema, normalize, parse, serialize } from './schema'
import { applySelection, readSelection } from './dom'
import type { Editor, EditorOptions, KeyHandler } from './types'

const ID = 'data-block-id'
// set() modes
const COMMAND = 0 // render, record history
const INPUT = 1 // DOM already updated by the browser; debounce history
const LOAD = 2 // render, reset history
const HISTORY = 3 // render only

function matches(e: KeyboardEvent, binding: string): boolean {
  const mods = binding.split('+')
  const key = mods.pop()
  // "mod" accepts Cmd or Ctrl, so bindings work regardless of platform sniffing.
  return (
    e.key.toLowerCase() == key &&
    (mods.includes('mod') ? e.metaKey || e.ctrlKey : !(e.metaKey || e.ctrlKey)) &&
    e.shiftKey == mods.includes('shift') &&
    e.altKey == mods.includes('alt')
  )
}

export function createEditor(el: HTMLElement, opts: EditorOptions = {}): Editor {
  const plugins = opts.plugins || []
  const schema = createSchema(plugins)
  const spec = (b: Block) => schema.blocks[b.type] || schema.blocks.paragraph
  const atom = (b?: Block) => !!b && !!spec(b).atom

  let doc: Doc = []
  let sel: Selection | null = null
  let shown = new Map<string, Block>() // id → block its element currently displays
  let html = ''
  let hist: [Doc, Selection | null][] = []
  let at = -1
  let timer: ReturnType<typeof setTimeout> | 0 = 0
  let composing = false
  const subs = new Set<() => void>()
  const cleanups: (() => void)[] = []
  const ac = new AbortController()
  const on = (t: EventTarget, type: string, f: (e: any) => void) =>
    t.addEventListener(type, f, { signal: ac.signal })
  const notify = () => subs.forEach((f) => f())

  const valid = (s: Selection | null) =>
    s && indexOf(doc, s.anchor.block) >= 0 && indexOf(doc, s.head.block) >= 0 ? s : null
  const current = () => valid(readSelection(el)) || valid(sel)

  const record = () => {
    clearTimeout(timer)
    timer = 0
    hist = hist.slice(0, at + 1)
    hist.push([doc, sel])
    if (hist.length > 100) hist.shift()
    at = hist.length - 1
  }

  function render(d: Doc) {
    // Reuse the element of every top-level block whose content is unchanged;
    // render the rest. Reused elements are never detached (iframes survive).
    const keep = new Map<Block, Element>()
    for (const c of el.children) {
      const b = shown.get(c.getAttribute(ID)!)
      if (b) keep.set(b, c)
    }
    const nodes: Node[] = []
    let pending: Doc = []
    const flush = () => {
      if (!pending.length) return
      const t = document.createElement('template')
      t.innerHTML = serialize(pending, schema, true)
      nodes.push(...t.content.childNodes)
      pending = []
    }
    for (const b of d) {
      const e = !spec(b).group && keep.get(b)
      if (e) {
        flush()
        nodes.push(e)
      } else pending.push(b)
    }
    flush()
    const want = new Set(nodes)
    for (const c of [...el.childNodes]) if (!want.has(c)) c.remove()
    nodes.forEach((n, i) => {
      if (el.childNodes[i] != n) el.insertBefore(n, el.childNodes[i] || null)
    })
  }

  function set(d: Doc, s: Selection | null, mode: number) {
    if (mode == COMMAND && timer) record() // typing before a command undoes separately
    const prev = new Map(doc.map((b) => [b.id, b]))
    // Keep identity for unchanged blocks: cheap equality checks downstream.
    d = normalize(d, schema).map((b) => {
      const o = prev.get(b.id)
      return o && eq(o, b) ? o : b
    })
    if (mode != INPUT) render(d)
    shown = new Map(d.map((b) => [b.id, b]))
    doc = d
    sel = s
    if (mode != INPUT && s) applySelection(el, s)
    if (mode == LOAD) at = -1
    if (mode == INPUT) {
      clearTimeout(timer)
      timer = setTimeout(record, 300)
    } else if (mode != HISTORY) record()
    const empty = api.isEmpty()
    el.toggleAttribute('data-empty', empty)
    const h = empty ? '' : serialize(doc, schema)
    if (h != html) {
      html = h
      opts.onChange?.(h)
    }
    notify()
  }

  function apply(fn: Transform) {
    const s = current()
    if (!s) return
    const r = fn(doc, s)
    if (r) set(r[0], r[1] || s, COMMAND)
  }

  const cut = (d: Doc, s: Selection): [Doc, Selection] => {
    const [a, h, i, j] = range(d, s)
    const b = {
      ...d[i],
      children: [...slice(d[i].children, 0, a.offset), ...slice(d[j].children, h.offset)],
    }
    return [[...d.slice(0, i), b, ...d.slice(j + 1)], caret(a.block, a.offset)]
  }

  const split: Transform = (d, s) => {
    ;[d, s] = cut(d, s)
    const { block: id, offset } = s.anchor
    const i = indexOf(d, id)
    const b = d[i]
    const { continues } = spec(b)
    const len = textLength(b.children)
    if (continues && !len) {
      return [[...d.slice(0, i), { ...b, type: 'paragraph', attrs: {} }, ...d.slice(i + 1)]]
    }
    // The new block continues the type (lists) or falls back to a paragraph.
    const fresh = (c: TextNode[]) =>
      continues ? createBlock(b.type, c, b.attrs) : createBlock('paragraph', c)
    if (!offset && len) return [[...d.slice(0, i), fresh([]), ...d.slice(i)]]
    const right = fresh(slice(b.children, offset))
    const left = { ...b, children: slice(b.children, 0, offset) }
    return [[...d.slice(0, i), left, right, ...d.slice(i + 1)], caret(right.id)]
  }

  const insert =
    (ins: Doc): Transform =>
    (d, s) => {
      if (!ins.length) return
      ;[d, s] = cut(d, s)
      // Pad atoms at the edges so the merge below lands in a text block.
      if (atom(ins[0])) ins = [createBlock(), ...ins]
      if (atom(ins[ins.length - 1])) ins = [...ins, createBlock()]
      const i = indexOf(d, s.anchor.block)
      const b = d[i]
      const before = slice(b.children, 0, s.anchor.offset)
      const after = slice(b.children, s.anchor.offset)
      const last = ins.length - 1
      const out = ins.map((x, k) => ({
        ...x,
        children: [...(k ? [] : before), ...x.children, ...(k == last ? after : [])],
      }))
      // The first block merges into the target; an empty target adopts its type.
      out[0] = b.children.length
        ? { ...out[0], id: b.id, type: b.type, attrs: b.attrs }
        : { ...out[0], id: b.id }
      const end = out[last]
      return [
        [...d.slice(0, i), ...out, ...d.slice(i + 1)],
        caret(end.id, textLength(end.children) - textLength(after)),
      ]
    }

  // Backspace/Delete next to (or inside) an atom removes the atom.
  const deleteAtom =
    (forward: boolean): KeyHandler =>
    () => {
      let hit = false
      apply((d, s) => {
        if (!isCollapsed(s)) return
        const i = indexOf(d, s.anchor.block)
        const o = s.anchor.offset
        const t = atom(d[i])
          ? i
          : !forward && !o && atom(d[i - 1])
            ? i - 1
            : forward && o >= textLength(d[i].children) && atom(d[i + 1])
              ? i + 1
              : -1
        if (t < 0) return
        hit = true
        const rest = d.filter((_, k) => k != t)
        if (!rest.length) rest.push(createBlock())
        return [rest, t == i ? caret((rest[t] || rest[t - 1]).id) : s]
      })
      return hit
    }

  const noop = () => {}
  const keys: [string, KeyHandler][] = [
    ['enter', () => apply(split)],
    ['shift+enter', () => (api.commit(), false)], // the browser inserts the <br>
    ['mod+z', () => api.undo()],
    ['mod+shift+z', () => api.redo()],
    ['mod+y', () => api.redo()],
    ['backspace', deleteAtom(false)],
    ['delete', deleteAtom(true)],
    // Block the browser's native formatting, which would desync the model.
    ['mod+b', noop],
    ['mod+i', noop],
    ['mod+u', noop],
  ]

  const api: Editor = {
    el,
    schema,
    plugins,
    get doc() {
      return doc
    },
    get selection() {
      return sel
    },
    get editable() {
      return el.contentEditable == 'true'
    },
    set editable(v) {
      el.contentEditable = String(v)
      notify()
    },
    apply,
    toggleMark: (type, attrs = {}) =>
      apply((d, s) =>
        isCollapsed(s)
          ? undefined
          : [
              markRange(
                d,
                s,
                type,
                type in marksAt(d, s) ? null : attrs,
                schema.marks[type]?.excludes,
              ),
            ],
      ),
    setBlock: (type, attrs = {}) =>
      apply((d, s) => {
        const [, , i, j] = range(d, s)
        return [
          d.map((b, k) =>
            k < i || k > j || atom(b)
              ? b
              : b.type == type && eq(b.attrs, attrs)
                ? { ...b, type: 'paragraph', attrs: {} }
                : { ...b, type, attrs },
          ),
        ]
      }),
    insertBlock(type, attrs = {}) {
      if (!schema.blocks[type]) throw Error(`eddy: unknown block type "${type}"`)
      apply((d, s) => {
        const i = indexOf(d, s.anchor.block)
        const b = d[i]
        const nb = createBlock(type, [], attrs)
        const replace = b.type == 'paragraph' && !b.children.length
        d = [...d.slice(0, replace ? i : i + 1), nb, ...d.slice(i + 1)]
        let land = nb
        if (atom(nb)) {
          const k = d.indexOf(nb) + 1
          if (!d[k] || atom(d[k])) d.splice(k, 0, createBlock())
          land = d[k]
        }
        return [d, caret(land.id)]
      })
    },
    insertHTML: (h) =>
      apply(
        insert(
          // Drop whitespace-only blocks (Office's <p>&nbsp;</p> spacers); keep empty lines.
          parse(h, schema).filter(
            (b) => !/^[^\S\n]+$/.test(b.children.map((t) => t.text).join('')),
          ),
        ),
      ),
    insertText: (text) =>
      apply(
        insert(
          text
            .split(/\r?\n/)
            .map((l) => createBlock('paragraph', l ? [{ text: l, marks: {} }] : [])),
        ),
      ),
    getMarks() {
      const s = current()
      return s ? marksAt(doc, s) : {}
    },
    getBlock() {
      const s = current()
      return s ? doc[indexOf(doc, s.anchor.block)] : null
    },
    getHTML: () => html,
    setHTML: (h) => set(parse(h, schema), null, LOAD),
    isEmpty: () => doc.length == 1 && doc[0].type == 'paragraph' && !doc[0].children.length,
    undo() {
      if (timer) record()
      if (at > 0) set(...hist[--at], HISTORY)
    },
    redo() {
      if (at < hist.length - 1) set(...hist[++at], HISTORY)
    },
    commit() {
      if (timer) record()
    },
    subscribe(f) {
      subs.add(f)
      return () => subs.delete(f)
    },
    destroy() {
      ac.abort()
      clearTimeout(timer)
      cleanups.splice(0).forEach((f) => f())
      subs.clear()
    },
  }

  // Plugins first: their DOM listeners run before ours and may preventDefault.
  for (const p of plugins) {
    for (const [k, f] of Object.entries(p.keys || {})) keys.push([k.toLowerCase(), f])
    const c = p.setup?.(api)
    if (c) cleanups.push(c)
  }

  const sync = () => composing || set(parse(el, schema, shown), readSelection(el), INPUT)
  on(el, 'input', sync)
  on(el, 'compositionstart', () => (composing = true))
  on(el, 'compositionend', () => {
    composing = false
    sync()
  })
  on(el, 'keydown', (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return
    for (let k = keys.length; k--; ) {
      if (matches(e, keys[k][0]) && keys[k][1](api, e) !== false) return e.preventDefault()
    }
  })
  on(el, 'paste', (e: ClipboardEvent) => {
    if (e.defaultPrevented) return
    e.preventDefault()
    const h = e.clipboardData?.getData('text/html')
    if (h) api.insertHTML(h)
    else api.insertText(e.clipboardData?.getData('text/plain') || '')
  })
  on(document, 'selectionchange', () => {
    const s = readSelection(el)
    if (s && !eq(s, sel)) {
      sel = s
      notify()
    }
  })

  el.contentEditable = 'true'
  api.setHTML(opts.content || '')
  return api
}
