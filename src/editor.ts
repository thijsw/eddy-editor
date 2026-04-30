import type {
  CommandFn,
  EddyPlugin,
  EditorAPI,
  EditorEvent,
  EventHandlerMap,
  PluginContext,
  TransactionAPI,
} from './types'
import type { BlockNode, DocumentNode, Mark } from './ast/types'
import { emptyParagraph, emptyText, generateId } from './ast/types'
import type { ASTSelection } from './ast/selection'
import { blockIndexOf, collapsedAt, isCollapsed, positionsEqual } from './ast/selection'
import type { Schema, MarkSpec, BlockSpec, SchemaRule } from './ast/schema'
import { Schema as SchemaCls } from './ast/schema'
import { parseHTML, parseLiveDOM } from './ast/parse'
import {
  serializeToHTML,
  serializeToDOMHTML,
  serializeBlockInner,
  serializeSingleBlock,
} from './ast/serialize'
import { readSelection, applySelection } from './ast/dom-mapping'
import { applySchema, defaultRules } from './ast/schema'
import { matchesKeybinding } from './matches-keybinding'
import * as cmd from './ast/commands'
import * as inspect from './ast/inspect'
import * as history from './ast/history'

type EmitFn = (html: string) => void

export class Editor implements EditorAPI {
  private _doc: DocumentNode
  private _selection: ASTSelection | null = null
  private _history: history.HistoryStack
  private _historyDebounce: ReturnType<typeof setTimeout> | null = null

  private readonly _schema: Schema
  private readonly _rules: SchemaRule[]
  private readonly _commands: Map<string, CommandFn> = new Map()
  private readonly _keybindings: Map<string, string> = new Map()
  private readonly _listeners: Map<EditorEvent, Set<(...args: never[]) => void>> = new Map()
  private readonly _cleanups: Array<() => void> = []
  private _onDocSelectionChange: (() => void) | null = null

  constructor(
    private readonly _el: HTMLElement,
    private readonly _emit: EmitFn,
    plugins: EddyPlugin[],
  ) {
    this._schema = buildSchema(plugins)
    this._rules = [...defaultRules, ...plugins.flatMap((p) => p.schemaRules ?? [])]
    this._doc = { type: 'document', blocks: [emptyParagraph()] }
    this._history = history.create(this._doc, null)

    for (const plugin of plugins) {
      if (plugin.commands) {
        for (const [name, fn] of Object.entries(plugin.commands)) {
          this._commands.set(name, fn)
        }
      }
      if (plugin.keybindings) {
        for (const [key, cmdName] of Object.entries(plugin.keybindings)) {
          this._keybindings.set(key.toLowerCase(), cmdName)
        }
      }
    }

    const ctx: PluginContext = {
      editor: this,
      registerCommand: (name: string, fn: CommandFn): (() => void) => {
        this._commands.set(name, fn)
        return () => this._commands.delete(name)
      },
    }

    for (const plugin of plugins) {
      if (plugin.setup) {
        const cleanup = plugin.setup(ctx)
        if (cleanup) this._cleanups.push(cleanup)
      }
    }

    if (typeof document !== 'undefined') {
      this._onDocSelectionChange = () => this._readSelectionFromDOM()
      document.addEventListener('selectionchange', this._onDocSelectionChange)
    }
  }

  // ── EditorAPI — properties ────────────────────────────────────────────────

  get el(): HTMLElement {
    return this._el
  }

  get doc(): DocumentNode {
    return this._doc
  }

  get selection(): ASTSelection | null {
    return this._selection
  }

  get schema(): Schema {
    return this._schema
  }

  get tr(): TransactionAPI {
    return {
      apply: (fn) => this._apply(fn),
    }
  }

  // ── EditorAPI — mutation primitives ───────────────────────────────────────

  toggleMark(type: string, attrs?: Record<string, unknown>): void {
    const excludes = this._schema.marks.get(type)?.excludes
    this._apply((doc, sel) => cmd.toggleMark(doc, sel, type, attrs, excludes))
  }

  setBlockType(type: string, attrs?: Record<string, unknown>): void {
    this._apply((doc, sel) => cmd.setBlockType(doc, sel, type, attrs))
  }

  insertBlock(spec: { type: string; attrs?: Record<string, unknown> }): void {
    const blockSpec = this._schema.blocks.get(spec.type)
    if (!blockSpec) {
      if (typeof console !== 'undefined') {
        console.warn(`[eddy] insertBlock: unknown block type "${spec.type}"`)
      }
      return
    }
    this._apply((doc, sel) => {
      const idx = blockIndexOf(doc).get(sel.anchor.blockId) ?? -1
      if (idx < 0) return { doc, selection: sel }
      const current = doc.blocks[idx]

      const newBlock: BlockNode = {
        id: generateId(),
        type: spec.type,
        attrs: spec.attrs ? { ...spec.attrs } : {},
        children: [emptyText()],
      }

      const blocks = [...doc.blocks]
      let insertedIdx: number
      if (isEmptyParagraph(current)) {
        blocks.splice(idx, 1, newBlock)
        insertedIdx = idx
      } else {
        blocks.splice(idx + 1, 0, newBlock)
        insertedIdx = idx + 1
      }

      let cursorBlock: BlockNode = newBlock
      if (blockSpec.atom) {
        const after = blocks[insertedIdx + 1]
        const afterIsLandable = after && !this._schema.blocks.get(after.type)?.atom
        if (afterIsLandable) {
          cursorBlock = after
        } else {
          const trailing = emptyParagraph()
          blocks.splice(insertedIdx + 1, 0, trailing)
          cursorBlock = trailing
        }
      }

      return {
        doc: { type: 'document', blocks },
        selection: collapsedAt({ blockId: cursorBlock.id, inlineIndex: 0, offset: 0 }),
      }
    })
  }

  // ── EditorAPI — inspection ────────────────────────────────────────────────

  isMarkActive(type: string): boolean {
    this._readSelectionFromDOM()
    return this._selection ? inspect.isMarkActive(this._doc, this._selection, type) : false
  }

  getMarkAt(type: string): Mark | null {
    this._readSelectionFromDOM()
    return this._selection ? inspect.getMarkAt(this._doc, this._selection, type) : null
  }

  getBlockAt(): BlockNode | null {
    this._readSelectionFromDOM()
    return this._selection ? inspect.getBlockAt(this._doc, this._selection) : null
  }

  // ── EditorAPI — command dispatch ──────────────────────────────────────────

  run(command: string, ...args: unknown[]): void {
    const fn = this._commands.get(command)
    if (!fn) {
      if (typeof console !== 'undefined') console.warn(`[eddy] unknown command: ${command}`)
      return
    }
    fn(this, ...args)
  }

  on<E extends EditorEvent>(event: E, handler: EventHandlerMap[E]): () => void {
    return this._subscribe(event, handler as (...args: never[]) => void)
  }

  // ── Editor lifecycle (not part of EditorAPI) ──────────────────────────────

  loadHTML(html: string): void {
    this._doc = applySchema(parseHTML(html, this._schema), this._rules)
    this._selection = null
    this._history = history.create(this._doc, null)
    this._el.innerHTML = serializeToDOMHTML(this._doc, this._schema)
    this._updateEmptyAttr()
    this._emitCanonical()
  }

  isEmpty(): boolean {
    const { blocks } = this._doc
    if (blocks.length !== 1) return false
    const b = blocks[0]
    if (b.type !== 'paragraph') return false
    for (const node of b.children) {
      if (node.type === 'text' && node.text !== '') return false
    }
    return true
  }

  syncFromDOM(): void {
    this._doc = applySchema(parseLiveDOM(this._el, this._schema), this._rules)
    this._selection = readSelection(this._el)
    this._scheduleHistoryPush()
    this._updateEmptyAttr()
    this._emitCanonical()
  }

  insertHTML(html: string): void {
    const inserted = parseHTML(html, this._schema)
    if (inserted.blocks.length === 0) return
    this._apply((doc, sel) => cmd.insertDocument(doc, sel, inserted))
  }

  pushHistory(): void {
    this._readSelectionFromDOM()
    this._flushHistoryDebounce()
  }

  undo(): void {
    this._flushHistoryDebounce()
    const result = history.undo(this._history)
    if (!result) return
    this._history = result
    this._restore(history.current(this._history))
  }

  redo(): void {
    const result = history.redo(this._history)
    if (!result) return
    this._history = result
    this._restore(history.current(this._history))
  }

  destroy(): void {
    this._flushHistoryDebounce()
    if (this._onDocSelectionChange && typeof document !== 'undefined') {
      document.removeEventListener('selectionchange', this._onDocSelectionChange)
      this._onDocSelectionChange = null
    }
    for (const cleanup of this._cleanups.splice(0)) {
      try {
        cleanup()
      } catch (err) {
        if (typeof console !== 'undefined') console.error('[eddy] plugin cleanup failed:', err)
      }
    }
    this._dispatch('destroy')
    this._listeners.clear()
  }

  // ── Raw event hooks (framework wrappers call these) ───────────────────────

  handleKeydown(event: KeyboardEvent): void {
    this._dispatch('keydown', event)
    if (event.defaultPrevented) return

    if ((event.key === 'Backspace' || event.key === 'Delete') && this._handleAtomDeletion(event))
      return

    for (const [key, cmdName] of this._keybindings) {
      if (matchesKeybinding(event, key)) {
        event.preventDefault()
        this.run(cmdName)
        return
      }
    }
  }

  /**
   * Built-in atom-block deletion: Backspace at the start of the block after
   * an atom (or Delete at the end of the block before one) removes the atom.
   * Backspace/Delete with the cursor inside an atom block removes the block
   * itself. Returns true when the event was handled.
   *
   * Plugins that want different behaviour can preventDefault in their own
   * keydown handler; the dispatch loop short-circuits before this runs.
   */
  private _handleAtomDeletion(event: KeyboardEvent): boolean {
    this._readSelectionFromDOM()
    const sel = this._selection
    if (!sel || !isCollapsed(sel)) return false
    const idx = blockIndexOf(this._doc).get(sel.anchor.blockId) ?? -1
    if (idx < 0) return false
    const current = this._doc.blocks[idx]
    const currentIsAtom = !!this._schema.blocks.get(current.type)?.atom

    let targetIdx = -1
    if (currentIsAtom) {
      targetIdx = idx
    } else if (
      event.key === 'Backspace' &&
      sel.anchor.inlineIndex === 0 &&
      sel.anchor.offset === 0
    ) {
      const prev = this._doc.blocks[idx - 1]
      if (prev && this._schema.blocks.get(prev.type)?.atom) targetIdx = idx - 1
    } else if (event.key === 'Delete' && inspect.isCursorAtBlockEnd(this._doc, sel)) {
      const next = this._doc.blocks[idx + 1]
      if (next && this._schema.blocks.get(next.type)?.atom) targetIdx = idx + 1
    }

    if (targetIdx < 0) return false
    event.preventDefault()
    this._deleteBlockAt(targetIdx)
    return true
  }

  private _deleteBlockAt(targetIdx: number): void {
    this._apply((doc, sel) => {
      if (targetIdx < 0 || targetIdx >= doc.blocks.length) return { doc, selection: sel }
      const blocks = [...doc.blocks]
      blocks.splice(targetIdx, 1)
      if (blocks.length === 0) blocks.push(emptyParagraph())
      const target = blocks[targetIdx] ?? blocks[targetIdx - 1] ?? blocks[0]
      return {
        doc: { type: 'document', blocks },
        selection: collapsedAt({ blockId: target.id, inlineIndex: 0, offset: 0 }),
      }
    })
  }

  handlePaste(event: ClipboardEvent): void {
    this._dispatch('paste', event)
  }

  // ── Private — event bus ───────────────────────────────────────────────────

  private _subscribe(event: EditorEvent, handler: (...args: never[]) => void): () => void {
    let set = this._listeners.get(event)
    if (!set) {
      set = new Set()
      this._listeners.set(event, set)
    }
    set.add(handler)
    return () => set!.delete(handler)
  }

  private _dispatch<E extends EditorEvent>(
    event: E,
    ...args: Parameters<EventHandlerMap[E]>
  ): void {
    const set = this._listeners.get(event)
    if (!set) return
    for (const handler of set) (handler as (...a: unknown[]) => void)(...args)
  }

  // ── Private — apply / render ──────────────────────────────────────────────

  private _apply(
    command: (
      doc: DocumentNode,
      sel: ASTSelection,
    ) => { doc: DocumentNode; selection: ASTSelection },
  ): void {
    this._readSelectionFromDOM()
    if (!this._selection) return
    this._flushHistoryDebounce()

    const oldDoc = this._doc
    const oldSel = this._selection
    const result = command(this._doc, this._selection)
    const normalized = applySchema(result.doc, this._rules)
    const newSel = cmd.remapSelection(result.doc, normalized, result.selection)
    this._render(oldDoc, normalized, newSel)
    this._history = history.push(this._history, normalized, newSel)
    this._emitCanonical()
    if (!oldSel || !selectionsEqual(oldSel, newSel)) this._dispatch('selectionchange', newSel)
  }

  private _restore(entry: history.HistoryEntry): void {
    this._render(this._doc, entry.doc, entry.selection)
    this._emitCanonical()
  }

  private _emitCanonical(): void {
    const html = serializeToHTML(this._doc, this._schema)
    this._emit(html)
    this._dispatch('change', html)
  }

  private _readSelectionFromDOM(): void {
    const sel = readSelection(this._el)
    if (!sel) return
    if (this._selection && selectionsEqual(this._selection, sel)) return
    this._selection = sel
    this._dispatch('selectionchange', sel)
  }

  private _updateEmptyAttr(): void {
    this._el.toggleAttribute('data-empty', this.isEmpty())
  }

  private _render(oldDoc: DocumentNode, newDoc: DocumentNode, newSel: ASTSelection | null): void {
    this._doc = newDoc
    this._selection = newSel

    if (canSurgicallyUpdate(oldDoc, newDoc)) {
      const elementsById = new Map<string, Element>()
      for (const el of this._el.querySelectorAll('[data-block-id]')) {
        elementsById.set(el.getAttribute('data-block-id')!, el)
      }
      for (let i = 0; i < newDoc.blocks.length; i++) {
        const oldBlock = oldDoc.blocks[i]
        const newBlock = newDoc.blocks[i]
        if (oldBlock === newBlock) continue
        const blockEl = elementsById.get(newBlock.id)
        if (!blockEl) continue
        const spec = this._schema.blocks.get(newBlock.type)
        if (spec?.atom) {
          replaceAtomElement(blockEl, newBlock, this._schema)
        } else {
          blockEl.innerHTML = serializeBlockInner(newBlock, this._schema)
        }
      }
    } else {
      this._fullRender(oldDoc, newDoc)
    }

    this._updateEmptyAttr()
    if (newSel) applySelection(this._el, newSel)
  }

  /**
   * Full re-render path used when the block list structure has changed
   * (insertion, deletion, type change). Critical invariant: live atom-block
   * elements (e.g. iframes) MUST stay attached to `_el` throughout. Detaching
   * an iframe — even momentarily, even into a same-document fragment — and
   * re-attaching it forces a navigation reload in WebKit/Blink.
   *
   * Strategy: identify which atom blocks are referentially unchanged in the
   * new doc (so their visual content is identical), keep those elements
   * exactly where they are, and rebuild the gaps around them. List/group
   * containers (ul/ol) carry no atoms so they get rebuilt freely.
   */
  private _fullRender(oldDoc: DocumentNode, newDoc: DocumentNode): void {
    const survivingAtomIds = new Set<string>()
    for (const newBlock of newDoc.blocks) {
      const spec = this._schema.blocks.get(newBlock.type)
      if (!spec?.atom) continue
      const oldBlock = oldDoc.blocks.find((b) => b.id === newBlock.id)
      // Only treat the atom as "surviving" when its block reference is
      // unchanged — that's the contract that the visual is identical and
      // we can safely leave the live DOM in place.
      if (oldBlock === newBlock) survivingAtomIds.add(newBlock.id)
    }

    if (survivingAtomIds.size === 0) {
      this._el.innerHTML = serializeToDOMHTML(newDoc, this._schema)
      return
    }

    const atomEls = new Map<string, Element>()
    for (const id of survivingAtomIds) {
      const el = this._el.querySelector(`[data-block-id="${id}"]`)
      if (el) atomEls.set(id, el)
    }

    // Drop everything from `_el` except the surviving atoms. Atoms stay
    // attached (just with siblings removed around them), so iframes don't
    // navigate. List containers (ul/ol) have no data-block-id and are
    // removed unconditionally — they'll be rebuilt by the segment renderer.
    for (const child of Array.from(this._el.children)) {
      const id = child.getAttribute('data-block-id')
      if (id && atomEls.has(id)) continue
      child.remove()
    }

    // Walk the new doc, partitioned at surviving atoms. Each "blocks"
    // segment renders to HTML once and gets inserted as a fragment; each
    // surviving atom is repositioned via insertBefore (same-parent move,
    // no detach).
    let cursorAfter: ChildNode | null = null
    let pending: BlockNode[] = []

    const flushPending = (): void => {
      if (pending.length === 0) return
      const html = serializeToDOMHTML({ type: 'document', blocks: pending }, this._schema)
      const tmp = document.createElement('template')
      tmp.innerHTML = html
      const inserted = Array.from(tmp.content.children)
      const ref = cursorAfter ? cursorAfter.nextSibling : this._el.firstChild
      this._el.insertBefore(tmp.content, ref)
      if (inserted.length > 0) cursorAfter = inserted[inserted.length - 1]
      pending = []
    }

    for (const block of newDoc.blocks) {
      if (survivingAtomIds.has(block.id)) {
        flushPending()
        const atomEl = atomEls.get(block.id)!
        const expectedNext: ChildNode | null = cursorAfter
          ? cursorAfter.nextSibling
          : this._el.firstChild
        if (atomEl !== expectedNext) {
          this._el.insertBefore(atomEl, expectedNext)
        }
        cursorAfter = atomEl
      } else {
        pending.push(block)
      }
    }
    flushPending()
  }

  private _scheduleHistoryPush(): void {
    if (this._historyDebounce !== null) clearTimeout(this._historyDebounce)
    this._historyDebounce = setTimeout(() => {
      this._history = history.push(this._history, this._doc, this._selection)
      this._historyDebounce = null
    }, 300)
  }

  private _flushHistoryDebounce(): void {
    if (this._historyDebounce === null) return
    clearTimeout(this._historyDebounce)
    this._historyDebounce = null
    this._history = history.push(this._history, this._doc, this._selection)
  }
}

/**
 * Surgical DOM updates are only safe when block IDs, types, and grouping-
 * relevant attrs (list ordered/indent, heading level) match in order —
 * anything else changes the HTML element tree and needs a full render.
 */
function canSurgicallyUpdate(oldDoc: DocumentNode, newDoc: DocumentNode): boolean {
  if (oldDoc.blocks.length !== newDoc.blocks.length) return false
  for (let i = 0; i < oldDoc.blocks.length; i++) {
    const a = oldDoc.blocks[i]
    const b = newDoc.blocks[i]
    if (a.id !== b.id || a.type !== b.type) return false
    const aAttrs = a.attrs
    const bAttrs = b.attrs
    if (a.type === 'heading' && aAttrs.level !== bAttrs.level) return false
    if (
      a.type === 'listItem' &&
      (aAttrs.ordered !== bAttrs.ordered || aAttrs.indent !== bAttrs.indent)
    ) {
      return false
    }
  }
  return true
}

function selectionsEqual(a: ASTSelection, b: ASTSelection): boolean {
  return positionsEqual(a.anchor, b.anchor) && positionsEqual(a.head, b.head)
}

function isEmptyParagraph(block: BlockNode): boolean {
  if (block.type !== 'paragraph') return false
  if (block.children.length !== 1) return false
  const c = block.children[0]
  return c.type === 'text' && c.text === ''
}

function replaceAtomElement(blockEl: Element, block: BlockNode, schema: Schema): void {
  const tmp = document.createElement('template')
  tmp.innerHTML = serializeSingleBlock(block, true, schema)
  const fresh = tmp.content.firstElementChild
  if (fresh) blockEl.replaceWith(fresh)
}

function buildSchema(plugins: EddyPlugin[]): Schema {
  const marks: MarkSpec[] = []
  const blocks: BlockSpec[] = []
  for (const plugin of plugins) {
    if (plugin.marks) marks.push(...plugin.marks)
    if (plugin.blocks) blocks.push(...plugin.blocks)
  }
  return new SchemaCls(marks, blocks)
}
