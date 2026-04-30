import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '../../src/editor'
import { core } from '../../src/plugins/core'
import { heading } from '../../src/plugins/headings'
import type { BlockSpec, EddyPlugin } from '../../src'
import { applySelection } from '../../src/ast/dom-mapping'

/**
 * Atomic (leaf) blocks. The "divider" used here is a minimal stand-in for
 * any embed-like block (YouTube, image, callout, …) — these tests cover the
 * core machinery, not anything YouTube-specific.
 */
const dividerSpec: BlockSpec = {
  type: 'divider',
  atom: true,
  parseDOM: [{ tag: 'hr' }],
  toDOM: () => ['hr', { class: 'divider', contenteditable: 'false' }],
}

const dividerPlugin: EddyPlugin = {
  name: 'divider',
  blocks: [dividerSpec],
}

let editor: Editor
let el: HTMLDivElement
let lastEmitted = ''

function mount(html: string, plugins: EddyPlugin[] = [core, heading, dividerPlugin]): Editor {
  el = document.createElement('div')
  el.contentEditable = 'true'
  document.body.appendChild(el)
  lastEmitted = ''
  editor = new Editor(
    el,
    (h: string) => {
      lastEmitted = h
    },
    plugins,
  )
  editor.loadHTML(html)
  return editor
}

function selectAt(blockId: string, inlineIndex = 0, offset = 0): void {
  const ok = applySelection(el, {
    anchor: { blockId, inlineIndex, offset },
    head: { blockId, inlineIndex, offset },
  })
  if (!ok) throw new Error(`couldn't position selection at ${blockId}/${inlineIndex}/${offset}`)
}

function key(name: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: name, cancelable: true, bubbles: true })
}

afterEach(() => {
  editor?.destroy()
  document.body.innerHTML = ''
})

// ── insertBlock: non-atom ───────────────────────────────────────────────────

describe('Editor.insertBlock — non-atom blocks', () => {
  it('inserts after the current block when cursor is in non-empty content', () => {
    mount('<p>hello</p>')
    const firstId = editor.doc.blocks[0].id
    selectAt(firstId, 0, 5)

    editor.insertBlock({ type: 'heading', attrs: { level: 2 } })

    expect(editor.doc.blocks).toHaveLength(2)
    expect(editor.doc.blocks[0].type).toBe('paragraph')
    expect(editor.doc.blocks[0].id).toBe(firstId)
    expect(editor.doc.blocks[1].type).toBe('heading')
    expect(editor.doc.blocks[1].attrs.level).toBe(2)
  })

  it('lands the cursor inside the new block', () => {
    mount('<p>hello</p>')
    selectAt(editor.doc.blocks[0].id, 0, 5)

    editor.insertBlock({ type: 'heading', attrs: { level: 2 } })

    const newBlockId = editor.doc.blocks[1].id
    expect(editor.selection?.anchor).toEqual({ blockId: newBlockId, inlineIndex: 0, offset: 0 })
  })

  it('replaces an empty paragraph instead of appending after it', () => {
    mount('<p></p>')
    selectAt(editor.doc.blocks[0].id, 0, 0)

    editor.insertBlock({ type: 'heading', attrs: { level: 1 } })

    expect(editor.doc.blocks).toHaveLength(1)
    expect(editor.doc.blocks[0].type).toBe('heading')
  })
})

// ── insertBlock: atom ───────────────────────────────────────────────────────

describe('Editor.insertBlock — atom blocks', () => {
  it('inserts the atom and creates a trailing paragraph for the cursor', () => {
    mount('<p>hello</p>')
    selectAt(editor.doc.blocks[0].id, 0, 5)

    editor.insertBlock({ type: 'divider' })

    expect(editor.doc.blocks).toHaveLength(3)
    expect(editor.doc.blocks[0].type).toBe('paragraph')
    expect(editor.doc.blocks[1].type).toBe('divider')
    expect(editor.doc.blocks[2].type).toBe('paragraph')
    expect(editor.selection?.anchor.blockId).toBe(editor.doc.blocks[2].id)
  })

  it('reuses the existing next non-atom block instead of inserting a fresh trailing paragraph', () => {
    mount('<p>first</p><p>second</p>')
    const secondId = editor.doc.blocks[1].id
    selectAt(editor.doc.blocks[0].id, 0, 5)

    editor.insertBlock({ type: 'divider' })

    expect(editor.doc.blocks).toHaveLength(3)
    expect(editor.doc.blocks[1].type).toBe('divider')
    // The second paragraph kept its identity — no extra trailing paragraph created.
    expect(editor.doc.blocks[2].id).toBe(secondId)
    expect(editor.selection?.anchor.blockId).toBe(secondId)
  })

  it('creates a trailing paragraph when the next block is also atomic', () => {
    mount('<p>top</p><hr>')
    selectAt(editor.doc.blocks[0].id, 0, 3)

    editor.insertBlock({ type: 'divider' })

    // [paragraph, divider, NEW trailing paragraph, divider]
    expect(editor.doc.blocks).toHaveLength(4)
    expect(editor.doc.blocks[1].type).toBe('divider')
    expect(editor.doc.blocks[2].type).toBe('paragraph')
    expect(editor.doc.blocks[3].type).toBe('divider')
    expect(editor.selection?.anchor.blockId).toBe(editor.doc.blocks[2].id)
  })

  it('replaces an empty leading paragraph and still adds a trailing landing spot', () => {
    mount('<p></p>')
    selectAt(editor.doc.blocks[0].id, 0, 0)

    editor.insertBlock({ type: 'divider' })

    expect(editor.doc.blocks.map((b) => b.type)).toEqual(['divider', 'paragraph'])
    expect(editor.selection?.anchor.blockId).toBe(editor.doc.blocks[1].id)
  })

  it('serialises atom block via toDOM only — no <br> sneaks in', () => {
    mount('<p>hi</p>')
    selectAt(editor.doc.blocks[0].id, 0, 2)
    editor.insertBlock({ type: 'divider' })
    expect(lastEmitted).toContain('<hr')
    // The atom block must not pick up the empty-inline `<br>` that paragraphs use.
    expect(lastEmitted).not.toMatch(/<hr[^>]*><br>/)
  })
})

// ── insertBlock: error paths ────────────────────────────────────────────────

describe('Editor.insertBlock — error paths', () => {
  it('warns and is a no-op for an unknown block type', () => {
    mount('<p>hi</p>')
    selectAt(editor.doc.blocks[0].id, 0, 0)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    editor.insertBlock({ type: 'mystery' })

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('mystery'))
    expect(editor.doc.blocks).toHaveLength(1)
    expect(editor.doc.blocks[0].type).toBe('paragraph')
    warn.mockRestore()
  })
})

// ── Atom-block deletion: Backspace ──────────────────────────────────────────

describe('built-in atom deletion — Backspace', () => {
  it('at start of the block following an atom removes the atom', () => {
    mount('<p>before</p><hr><p>after</p>')
    expect(editor.doc.blocks).toHaveLength(3)
    const afterId = editor.doc.blocks[2].id
    selectAt(afterId, 0, 0)

    editor.handleKeydown(key('Backspace'))

    expect(editor.doc.blocks).toHaveLength(2)
    expect(editor.doc.blocks.map((b) => b.type)).toEqual(['paragraph', 'paragraph'])
  })

  it('places the cursor at the start of the surviving block', () => {
    mount('<p>before</p><hr><p>after</p>')
    const afterId = editor.doc.blocks[2].id
    selectAt(afterId, 0, 0)

    editor.handleKeydown(key('Backspace'))

    expect(editor.selection?.anchor).toEqual({ blockId: afterId, inlineIndex: 0, offset: 0 })
  })

  it('with the cursor inside the atom block itself, removes it', () => {
    mount('<p>before</p><hr><p>after</p>')
    const dividerId = editor.doc.blocks[1].id
    selectAt(dividerId, 0, 0)

    editor.handleKeydown(key('Backspace'))

    expect(editor.doc.blocks.find((b) => b.type === 'divider')).toBeUndefined()
  })

  it('does nothing when the cursor is mid-text (not at block start)', () => {
    mount('<p>before</p><hr><p>after</p>')
    const afterId = editor.doc.blocks[2].id
    selectAt(afterId, 0, 2)

    editor.handleKeydown(key('Backspace'))

    expect(editor.doc.blocks).toHaveLength(3)
    expect(editor.doc.blocks[1].type).toBe('divider')
  })

  it('does nothing when the previous block is not atomic', () => {
    mount('<p>top</p><p>bottom</p>')
    const bottomId = editor.doc.blocks[1].id
    selectAt(bottomId, 0, 0)

    editor.handleKeydown(key('Backspace'))

    // Browser would normally merge — we don't; we just don't intercept.
    expect(editor.doc.blocks).toHaveLength(2)
  })

  it('handles a doc that contains only an atom block', () => {
    mount('<hr>')
    const id = editor.doc.blocks[0].id
    selectAt(id, 0, 0)

    editor.handleKeydown(key('Backspace'))

    // Schema invariant: doc never empty — left with an empty paragraph.
    expect(editor.doc.blocks).toHaveLength(1)
    expect(editor.doc.blocks[0].type).toBe('paragraph')
  })
})

// ── Atom-block deletion: Delete ─────────────────────────────────────────────

describe('built-in atom deletion — Delete', () => {
  it('at end of the block before an atom removes the atom', () => {
    mount('<p>before</p><hr><p>after</p>')
    const beforeId = editor.doc.blocks[0].id
    selectAt(beforeId, 0, 6) // end of "before"

    editor.handleKeydown(key('Delete'))

    expect(editor.doc.blocks).toHaveLength(2)
    expect(editor.doc.blocks.find((b) => b.type === 'divider')).toBeUndefined()
  })

  it('does nothing when the cursor is mid-text in the preceding block', () => {
    mount('<p>before</p><hr><p>after</p>')
    selectAt(editor.doc.blocks[0].id, 0, 3)

    editor.handleKeydown(key('Delete'))

    expect(editor.doc.blocks).toHaveLength(3)
    expect(editor.doc.blocks[1].type).toBe('divider')
  })

  it('with the cursor inside the atom, removes it', () => {
    mount('<p>before</p><hr><p>after</p>')
    selectAt(editor.doc.blocks[1].id, 0, 0)

    editor.handleKeydown(key('Delete'))

    expect(editor.doc.blocks.find((b) => b.type === 'divider')).toBeUndefined()
  })
})

// ── Plugin override of atom deletion ────────────────────────────────────────

describe('plugin keydown can override atom deletion', () => {
  it('a plugin that preventDefaults Backspace stops the built-in deletion', () => {
    const blocker: EddyPlugin = {
      name: 'blocker',
      setup(ctx) {
        return ctx.editor.on('keydown', (event) => {
          if (event.key === 'Backspace') event.preventDefault()
        })
      },
    }
    mount('<p>before</p><hr><p>after</p>', [core, dividerPlugin, blocker])
    selectAt(editor.doc.blocks[2].id, 0, 0)

    editor.handleKeydown(key('Backspace'))

    expect(editor.doc.blocks).toHaveLength(3)
    expect(editor.doc.blocks[1].type).toBe('divider')
  })
})

// ── Atom DOM preservation across re-renders ─────────────────────────────────

describe('atom block DOM preservation', () => {
  it('keeps the same DOM element across structural changes (full re-render path)', () => {
    mount('<p>top</p><hr><p>bottom</p>')
    const dividerId = editor.doc.blocks[1].id
    const dividerEl = el.querySelector(`[data-block-id="${dividerId}"]`)
    expect(dividerEl).not.toBeNull()
    // Mark the element so we can assert identity even after a tree rewrite.
    ;(dividerEl as HTMLElement).dataset.testMarker = 'live'

    // Trigger a structural change: insertBlock changes blocks.length, which
    // forces canSurgicallyUpdate=false and a full innerHTML rebuild.
    selectAt(editor.doc.blocks[0].id, 0, 3)
    editor.insertBlock({ type: 'heading', attrs: { level: 1 } })

    const stillThere = el.querySelector(`[data-block-id="${dividerId}"]`) as HTMLElement | null
    expect(stillThere).not.toBeNull()
    expect(stillThere?.dataset.testMarker).toBe('live')
    expect(stillThere).toBe(dividerEl)
  })

  it('keeps the same DOM element when an unrelated block changes type (surgical path)', () => {
    mount('<p>top</p><hr><p>bottom</p>')
    const dividerId = editor.doc.blocks[1].id
    const dividerEl = el.querySelector(`[data-block-id="${dividerId}"]`) as HTMLElement
    dividerEl.dataset.testMarker = 'live'

    // Convert the top paragraph to a heading. blocks.length is preserved,
    // ids stay the same, but block[0]'s type changes — surgical path runs.
    selectAt(editor.doc.blocks[0].id, 0, 0)
    editor.setBlockType('heading', { level: 2 })

    const stillThere = el.querySelector(`[data-block-id="${dividerId}"]`) as HTMLElement | null
    expect(stillThere).toBe(dividerEl)
    expect(stillThere?.dataset.testMarker).toBe('live')
  })

  it('does NOT serialise inline children into the atom outer element', () => {
    mount('<p>x</p><hr><p>y</p>')
    const dividerEl = el.querySelector('hr')
    expect(dividerEl).not.toBeNull()
    // The atom <hr> should have no inline children leaked in (no <br>, no text).
    expect(dividerEl?.innerHTML).toBe('')
  })

  it('atom element is never removed from _el during a structural re-render', () => {
    // This is the contract that prevents iframes from reloading: removing
    // an iframe from the document — even momentarily — forces a navigation.
    // We verify here that the atom element's parent never changes and that
    // it's never in a removedNodes mutation record.
    mount('<p>top</p><hr><p>bottom</p>')
    const dividerId = editor.doc.blocks[1].id
    const atom = el.querySelector(`[data-block-id="${dividerId}"]`) as HTMLElement
    expect(atom).not.toBeNull()
    expect(atom.parentNode).toBe(el)

    let detached = false
    const observer = new MutationObserver(() => {
      /* records flushed via takeRecords below */
    })
    observer.observe(el, { childList: true, subtree: true })

    // Trigger a structural change identical to the user's failing flow:
    // cursor in the bottom paragraph, press Enter to split it.
    selectAt(editor.doc.blocks[2].id, 0, 0)
    editor.handleKeydown(key('Enter'))

    for (const record of observer.takeRecords()) {
      for (const removed of Array.from(record.removedNodes)) {
        if (removed === atom) detached = true
      }
    }
    observer.disconnect()

    expect(detached).toBe(false)
    expect(atom.parentNode).toBe(el)
    expect(el.contains(atom)).toBe(true)
  })

  it('atom element is never removed when blocks are inserted before AND after it', () => {
    mount('<p>middle</p><hr><p>middle2</p>')
    const dividerId = editor.doc.blocks[1].id
    const atom = el.querySelector(`[data-block-id="${dividerId}"]`) as HTMLElement

    let detached = false
    const observer = new MutationObserver(() => {})
    observer.observe(el, { childList: true, subtree: true })

    // Insert a heading before the atom.
    selectAt(editor.doc.blocks[0].id, 0, 0)
    editor.insertBlock({ type: 'heading', attrs: { level: 1 } })

    // Insert another heading after the atom.
    selectAt(editor.doc.blocks[editor.doc.blocks.length - 1].id, 0, 0)
    editor.insertBlock({ type: 'heading', attrs: { level: 2 } })

    for (const record of observer.takeRecords()) {
      for (const removed of Array.from(record.removedNodes)) {
        if (removed === atom) detached = true
      }
    }
    observer.disconnect()

    expect(detached).toBe(false)
    expect(atom.parentNode).toBe(el)
  })
})

// ── Round-tripping atom blocks through HTML ─────────────────────────────────

describe('atom block round-trip', () => {
  it('survives HTML → AST → HTML', () => {
    mount('<p>a</p><hr><p>b</p>')
    expect(editor.doc.blocks.map((b) => b.type)).toEqual(['paragraph', 'divider', 'paragraph'])
    expect(lastEmitted).toContain('<hr')
    // Canonical HTML omits data-block-id.
    expect(lastEmitted).not.toContain('data-block-id')
  })
})
