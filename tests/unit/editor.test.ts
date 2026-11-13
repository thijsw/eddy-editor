import { afterEach, describe, expect, it } from 'vitest'
import {
  createEditor,
  defaultPlugins,
  heading,
  list,
  markRange,
  marksAt,
  setLink,
  toggleList,
  type Editor,
  type Plugin,
} from '../../src'
import { applySelection } from '../../src/dom'

const divider: Plugin = {
  blocks: { divider: { match: 'hr', atom: true, render: ['hr', { contenteditable: 'false' }] } },
}

let ed: Editor
let html = ''

function mount(content: string, plugins: Plugin[] = [...defaultPlugins, divider]): Editor {
  const el = document.createElement('div')
  document.body.appendChild(el)
  ed = createEditor(el, { plugins, content, onChange: (h) => (html = h) })
  return ed
}

/** Select [from, to) in block `i` (to defaults to from), or across blocks. */
function select(i: number, from: number, to = from, j = i): void {
  applySelection(ed.el, {
    anchor: { block: ed.doc[i].id, offset: from },
    head: { block: ed.doc[j].id, offset: to },
  })
}

function key(k: string, mods: { shift?: boolean; meta?: boolean } = {}): boolean {
  const e = new KeyboardEvent('keydown', {
    key: k,
    shiftKey: !!mods.shift,
    metaKey: !!mods.meta,
    cancelable: true,
  })
  ed.el.dispatchEvent(e)
  return e.defaultPrevented
}

const types = () => ed.doc.map((b) => b.type)

// jsdom has no DataTransfer; fake just enough of a ClipboardEvent.
function paste(data: Record<string, string>): Event {
  const e = new Event('paste', { cancelable: true })
  Object.defineProperty(e, 'clipboardData', { value: { getData: (t: string) => data[t] || '' } })
  return e
}

afterEach(() => {
  ed?.destroy()
  document.body.innerHTML = ''
  html = ''
})

describe('content & change events', () => {
  it('emits canonical HTML, and empty string for an empty editor', () => {
    mount('<p><b>x</b></p>')
    expect(html).toBe('<p><strong>x</strong></p>')
    ed.setHTML('<p></p>')
    expect(html).toBe('')
    expect(ed.el.hasAttribute('data-empty')).toBe(true)
  })

  it('renders block ids into the live DOM only', () => {
    mount('<p>a</p>')
    expect(ed.el.innerHTML).toBe(`<p data-block-id="${ed.doc[0].id}">a</p>`)
    expect(ed.getHTML()).toBe('<p>a</p>')
  })

  it('syncs the model from DOM input', () => {
    mount('<p>a</p>')
    ed.el.querySelector('p')!.textContent = 'typed'
    ed.el.dispatchEvent(new Event('input'))
    expect(html).toBe('<p>typed</p>')
  })
})

describe('marks', () => {
  it('toggles a mark on a partial range and keeps the selection', () => {
    mount('<p>hello world</p>')
    select(0, 6, 11)
    ed.toggleMark('bold')
    expect(html).toBe('<p>hello <strong>world</strong></p>')
    expect(ed.selection).toEqual({
      anchor: { block: ed.doc[0].id, offset: 6 },
      head: { block: ed.doc[0].id, offset: 11 },
    })
    ed.toggleMark('bold')
    expect(html).toBe('<p>hello world</p>')
  })

  it('is a no-op on a collapsed cursor', () => {
    mount('<p>hello</p>')
    select(0, 2)
    ed.toggleMark('bold')
    expect(html).toBe('<p>hello</p>')
  })

  it('spans blocks and only removes when the whole range has the mark', () => {
    mount('<p><strong>ab</strong></p><h2>cd</h2>')
    select(0, 1, 1, 1)
    ed.toggleMark('bold')
    expect(html).toBe('<p><strong>ab</strong></p><h2><strong>c</strong>d</h2>')
  })

  it('applies excludes', () => {
    const hl: Plugin = { marks: { hl: { match: 'mark', render: 'mark', excludes: ['code'] } } }
    mount('<p><code>x</code></p>', [...defaultPlugins, hl])
    select(0, 0, 1)
    ed.toggleMark('hl')
    expect(html).toBe('<p><mark>x</mark></p>')
  })

  it('reports active marks: char before the cursor, or shared across a range', () => {
    mount('<p><strong>ab</strong>cd</p>')
    select(0, 1)
    expect(ed.getMarks()).toEqual({ bold: {} })
    select(0, 3)
    expect(ed.getMarks()).toEqual({})
    select(0, 1, 3)
    expect(ed.getMarks()).toEqual({})
  })
})

describe('links', () => {
  it('sets a link on a range and edits/removes the whole link from a cursor', () => {
    mount('<p>go home</p>')
    select(0, 3, 7)
    setLink(ed, 'https://a.example')
    expect(html).toBe('<p>go <a href="https://a.example">home</a></p>')
    select(0, 5)
    setLink(ed, 'https://b.example')
    expect(html).toBe('<p>go <a href="https://b.example">home</a></p>')
    setLink(ed, null)
    expect(html).toBe('<p>go home</p>')
  })

  it('refuses unsafe hrefs', () => {
    mount('<p>x</p>')
    select(0, 0, 1)
    setLink(ed, 'javascript:alert(1)')
    expect(html).toBe('<p>x</p>')
  })
})

describe('blocks', () => {
  it('setBlock toggles per block and leaves atoms alone', () => {
    mount('<p>a</p><hr><h2>b</h2>')
    select(0, 0, 0, 2)
    ed.setBlock('heading', { level: 2 })
    expect(html).toBe('<h2>a</h2><hr contenteditable="false"><p>b</p>')
  })

  it('toggleList converts a range and toggles back', () => {
    mount('<p>a</p><p>b</p>')
    select(0, 0, 0, 1)
    toggleList(ed, true)
    expect(html).toBe('<ol><li>a</li><li>b</li></ol>')
    toggleList(ed, true)
    expect(html).toBe('<p>a</p><p>b</p>')
  })
})

describe('Enter', () => {
  it('splits mid-block; a heading continues as a paragraph', () => {
    mount('<h2>HelloWorld</h2>')
    select(0, 5)
    expect(key('Enter')).toBe(true)
    expect(html).toBe('<h2>Hello</h2><p>World</p>')
    expect(ed.selection?.anchor).toEqual({ block: ed.doc[1].id, offset: 0 })
  })

  it('at block start inserts an empty paragraph before and keeps the cursor', () => {
    mount('<h2>Title</h2>')
    const id = ed.doc[0].id
    select(0, 0)
    key('Enter')
    expect(html).toBe('<p><br></p><h2>Title</h2>')
    expect(ed.selection?.anchor).toEqual({ block: id, offset: 0 })
  })

  it('continues list items and exits on an empty one', () => {
    mount('<ul><li>a</li></ul>')
    select(0, 1)
    key('Enter')
    expect(types()).toEqual(['listItem', 'listItem'])
    key('Enter')
    expect(html).toBe('<ul><li>a</li></ul><p><br></p>')
  })

  it('deletes a range first', () => {
    mount('<p>abc</p><p>def</p>')
    select(0, 1, 2, 1)
    key('Enter')
    expect(html).toBe('<p>a</p><p>f</p>')
  })

  it('Shift+Enter is left to the browser', () => {
    mount('<p>a</p>')
    select(0, 1)
    expect(key('Enter', { shift: true })).toBe(false)
  })
})

describe('paste / insertHTML', () => {
  it('inserts a single block inline, keeping the target type', () => {
    mount('<h2>ab</h2>')
    select(0, 1)
    ed.insertHTML('<p><b>X</b></p>')
    expect(html).toBe('<h2>a<strong>X</strong>b</h2>')
    expect(ed.selection?.anchor.offset).toBe(2)
  })

  it('splits the target around a multi-block insert', () => {
    mount('<p>ab</p>')
    select(0, 1)
    ed.insertHTML('<p>X</p><h3>Y</h3>')
    expect(html).toBe('<p>aX</p><h3>Yb</h3>')
    expect(ed.selection?.anchor).toEqual({ block: ed.doc[1].id, offset: 1 })
  })

  it('an empty target adopts the first inserted block type', () => {
    mount('<p></p>')
    select(0, 0)
    ed.insertHTML('<ul><li>a</li><li>b</li></ul>')
    expect(html).toBe('<ul><li>a</li><li>b</li></ul>')
  })

  it('drops Office spacer paragraphs but keeps <br>-only lines', () => {
    mount('<p></p>')
    select(0, 0)
    ed.insertHTML('<p class="MsoNormal">a<o:p></o:p></p><p>&nbsp;</p><p><br></p><p>b</p>')
    expect(html).toBe('<p>a</p><p><br></p><p>b</p>')
  })

  it('insertText turns lines into paragraphs', () => {
    mount('<p>x</p>')
    select(0, 1)
    ed.insertText('one\ntwo')
    expect(html).toBe('<p>xone</p><p>two</p>')
  })

  it('handles paste events; plugins can intercept first', () => {
    const seen: string[] = []
    const spy: Plugin = {
      setup: (e) => {
        const f = (ev: Event) => {
          seen.push((ev as ClipboardEvent).clipboardData!.getData('text/plain'))
          ev.preventDefault()
        }
        e.el.addEventListener('paste', f)
        return () => e.el.removeEventListener('paste', f)
      },
    }
    mount('<p>x</p>', [spy])
    select(0, 1)
    ed.el.dispatchEvent(paste({ 'text/plain': 'p' }))
    expect(seen).toEqual(['p'])
    expect(html).toBe('<p>x</p>')
  })

  it('pastes HTML, falling back to plain text', () => {
    mount('<p>x</p>')
    select(0, 1)
    ed.el.dispatchEvent(paste({ 'text/html': '<b>B</b>', 'text/plain': 'B' }))
    ed.el.dispatchEvent(paste({ 'text/plain': 'a\nb' }))
    expect(html).toBe('<p>x<strong>B</strong>a</p><p>b</p>')
  })
})

describe('history', () => {
  it('undoes and redoes commands', () => {
    mount('<p>ab</p>')
    select(0, 0, 2)
    ed.toggleMark('bold')
    ed.toggleMark('italic')
    ed.undo()
    expect(html).toBe('<p><strong>ab</strong></p>')
    ed.undo()
    expect(html).toBe('<p>ab</p>')
    ed.undo()
    expect(html).toBe('<p>ab</p>')
    ed.redo()
    expect(html).toBe('<p><strong>ab</strong></p>')
  })

  it('records typing before a command as its own step', () => {
    mount('<p>a</p>')
    ed.el.querySelector('p')!.textContent = 'ab'
    ed.el.dispatchEvent(new Event('input'))
    select(0, 0, 2)
    ed.toggleMark('bold')
    ed.undo()
    expect(html).toBe('<p>ab</p>')
    ed.undo()
    expect(html).toBe('<p>a</p>')
  })

  it('setHTML resets history', () => {
    mount('<p>a</p>')
    ed.setHTML('<p>b</p>')
    ed.undo()
    expect(html).toBe('<p>b</p>')
  })
})

describe('atom blocks', () => {
  it('insertBlock replaces an empty paragraph and adds a landing paragraph after an atom', () => {
    mount('<p></p>')
    select(0, 0)
    ed.insertBlock('divider')
    expect(types()).toEqual(['divider', 'paragraph'])
    expect(ed.selection?.anchor.block).toBe(ed.doc[1].id)
  })

  it('insertBlock reuses a following text block as the landing spot', () => {
    mount('<p>a</p><p>b</p>')
    const b = ed.doc[1].id
    select(0, 1)
    ed.insertBlock('divider')
    expect(types()).toEqual(['paragraph', 'divider', 'paragraph'])
    expect(ed.selection?.anchor.block).toBe(b)
  })

  it('insertBlock lands inside a new non-atom block', () => {
    mount('<p>a</p>')
    select(0, 1)
    ed.insertBlock('heading', { level: 3 })
    expect(html).toBe('<p>a</p><h3><br></h3>')
    expect(ed.selection?.anchor.block).toBe(ed.doc[1].id)
  })

  it('insertBlock throws for unknown types', () => {
    mount('<p>a</p>')
    expect(() => ed.insertBlock('mystery')).toThrow(/mystery/)
  })

  it('Backspace at the start of the next block removes the atom', () => {
    mount('<p>a</p><hr><p>b</p>')
    const b = ed.doc[2].id
    select(2, 0)
    expect(key('Backspace')).toBe(true)
    expect(types()).toEqual(['paragraph', 'paragraph'])
    expect(ed.selection?.anchor).toEqual({ block: b, offset: 0 })
  })

  it('Delete at the end of the previous block removes the atom', () => {
    mount('<p>a</p><hr><p>b</p>')
    select(0, 1)
    expect(key('Delete')).toBe(true)
    expect(types()).toEqual(['paragraph', 'paragraph'])
  })

  it('Backspace/Delete inside an atom removes it; the doc is never empty', () => {
    mount('<hr>')
    select(0, 0)
    key('Backspace')
    expect(types()).toEqual(['paragraph'])
  })

  it('leaves Backspace to the browser otherwise', () => {
    mount('<p>a</p><hr><p>b</p>')
    select(2, 1)
    expect(key('Backspace')).toBe(false)
    select(0, 0)
    expect(key('Backspace')).toBe(false)
  })

  it('keeps the live atom element attached across structural re-renders', () => {
    mount('<p>top</p><hr><p>bottom</p>')
    const atom = ed.el.querySelector('hr')!
    const removed: Node[] = []
    const mo = new MutationObserver((rs) => rs.forEach((r) => removed.push(...r.removedNodes)))
    mo.observe(ed.el, { childList: true, subtree: true })
    select(2, 0)
    key('Enter')
    select(0, 0)
    ed.insertBlock('heading', { level: 1 })
    select(0, 0, 3, 3)
    ed.setBlock('heading', { level: 2 })
    removed.push(...mo.takeRecords().flatMap((r) => [...r.removedNodes]))
    mo.disconnect()
    expect(ed.el.querySelector('hr')).toBe(atom)
    expect(removed).not.toContain(atom)
  })

  it('an atom spec can claim iframes; unclaimed iframes are dropped', () => {
    const video: Plugin = {
      blocks: {
        video: {
          match: 'iframe[data-video]',
          atom: true,
          attrs: (el) => ({ src: el.getAttribute('src') }),
          render: (b) => ['iframe', { src: b.attrs.src, 'data-video': '' }],
        },
      },
    }
    mount(
      '<p>a</p><iframe data-video src="https://v.example/1"></iframe><iframe src="x"></iframe>',
      [video],
    )
    expect(html).toBe('<p>a</p><iframe src="https://v.example/1" data-video=""></iframe>')
  })

  it('reuses unchanged block elements', () => {
    mount('<p>a</p><p>b</p>')
    const second = ed.el.children[1]
    select(0, 0, 1)
    ed.toggleMark('bold')
    expect(ed.el.children[1]).toBe(second)
  })
})

describe('plugins', () => {
  it('later plugin keys override earlier ones and built-ins; false passes through', () => {
    const calls: string[] = []
    const a: Plugin = { keys: { enter: () => void calls.push('a') } }
    const b: Plugin = { keys: { enter: () => (calls.push('b'), false) } }
    mount('<p>x</p>', [a, b])
    select(0, 1)
    expect(key('Enter')).toBe(true)
    expect(calls).toEqual(['b', 'a'])
    expect(html).toBe('<p>x</p>')
  })

  it('later specs override earlier ones of the same type, keeping position', () => {
    const boldB: Plugin = { marks: { bold: { match: 'strong,b', render: 'b' } } }
    mount('<p><i><b>x</b></i></p>', [...defaultPlugins, boldB])
    expect(html).toBe('<p><b><em>x</em></b></p>')
  })

  it('custom block with attrs, veto, and nested render', () => {
    const codeBlock: Plugin = {
      blocks: {
        codeBlock: {
          match: 'pre',
          attrs: (el) =>
            el.hasAttribute('data-skip') ? false : { lang: el.getAttribute('data-lang') || '' },
          render: (b) => [
            'pre',
            ['code', { class: b.attrs.lang ? 'language-' + b.attrs.lang : null }],
          ],
        },
      },
    }
    mount('<pre data-lang="js">x</pre><pre data-skip>y</pre>', [codeBlock])
    expect(html).toBe('<pre><code class="language-js">x</code></pre><p>y</p>')
  })

  it('custom grouped block (task list)', () => {
    const task: Plugin = {
      blocks: {
        task: {
          match: 'li.task',
          attrs: (el) => ({ done: el.hasAttribute('data-done') }),
          render: (b) => ['li', { class: 'task', 'data-done': b.attrs.done ? '' : null }],
          group: () => ['ul', 0],
          continues: true,
        },
      },
    }
    mount('<ul><li class="task" data-done>a</li><li class="task">b</li></ul>', [list, task])
    expect(types()).toEqual(['task', 'task'])
    expect(html).toBe('<ul><li class="task" data-done="">a</li><li class="task">b</li></ul>')
  })

  it('normalize rules run on every change', () => {
    const upper: Plugin = {
      normalize: (doc) =>
        doc.map((b) => ({
          ...b,
          children: b.children.map((t) => ({ ...t, text: t.text.toUpperCase() })),
        })),
    }
    mount('<p>ab</p>', [upper])
    expect(html).toBe('<p>AB</p>')
  })

  it('setup runs once and its cleanup runs on destroy', () => {
    let state = ''
    mount('<p>x</p>', [{ setup: () => ((state = 'up'), () => (state = 'down')) }])
    expect(state).toBe('up')
    ed.destroy()
    expect(state).toBe('down')
  })

  it('transforms compose with exported helpers', () => {
    mount('<p>ab</p>', [heading])
    select(0, 0, 2)
    ed.apply((doc, sel) => [markRange(doc, sel, 'shout', { level: 2 })])
    expect(marksAt(ed.doc, ed.selection!)).toEqual({ shout: { level: 2 } })
  })
})

describe('subscribe & editable', () => {
  it('notifies on changes and on editable toggles', () => {
    mount('<p>ab</p>')
    let n = 0
    const off = ed.subscribe(() => n++)
    select(0, 0, 2)
    ed.toggleMark('bold')
    ed.editable = false
    expect(ed.el.contentEditable).toBe('false')
    expect(n).toBe(2)
    off()
    ed.editable = true
    expect(n).toBe(2)
  })
})
