import type { EditorAPI } from './types'
import type { DocumentNode, MarkType } from './ast/types'
import { emptyParagraph } from './ast/types'
import type { ASTSelection } from './ast/selection'
import { parseHTML, parseLiveDOM } from './ast/parse'
import { serializeToHTML, serializeToDOMHTML, serializeBlockInner } from './ast/serialize'
import { readSelection, applySelection } from './ast/dom-mapping'
import { applySchema, defaultRules } from './ast/schema'
import * as cmd from './ast/commands'
import * as inspect from './ast/inspect'
import * as history from './ast/history'

type EmitFn = (html: string) => void

export class Editor implements EditorAPI {
  private _doc: DocumentNode
  private _selection: ASTSelection | null = null
  private _history: history.HistoryStack
  private _historyDebounce: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly _el: HTMLElement,
    private readonly _emit: EmitFn,
  ) {
    this._doc = { type: 'document', blocks: [emptyParagraph()] }
    this._history = history.create(this._doc, null)
  }

  get el(): HTMLElement {
    return this._el
  }

  get doc(): DocumentNode {
    return this._doc
  }

  get selection(): ASTSelection | null {
    return this._selection
  }

  /** Replace the document with fresh HTML. Used on init and v-model changes. */
  loadHTML(html: string): void {
    this._doc = applySchema(parseHTML(html), defaultRules)
    this._selection = null
    this._history = history.create(this._doc, null)
    this._el.innerHTML = serializeToDOMHTML(this._doc)
    this._emitCanonical()
  }

  /** Called from the input handler after the browser mutates the DOM. */
  syncFromDOM(): void {
    this._doc = applySchema(parseLiveDOM(this._el), defaultRules)
    this._selection = readSelection(this._el)
    this._scheduleHistoryPush()
    this._emitCanonical()
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  toggleMark(mark: MarkType): void {
    this._apply((doc, sel) => cmd.toggleMark(doc, sel, mark))
  }

  setBlockType(type: 'paragraph' | 'heading', attrs?: { level?: 1 | 2 | 3 | 4 | 5 | 6 }): void {
    this._apply((doc, sel) => cmd.setBlockType(doc, sel, type, attrs))
  }

  toggleList(ordered: boolean): void {
    this._apply((doc, sel) => cmd.toggleList(doc, sel, ordered))
  }

  insertParagraph(): void {
    this._apply((doc, sel) => cmd.insertParagraph(doc, sel))
  }

  insertHardBreak(): void {
    this._apply((doc, sel) => cmd.insertHardBreak(doc, sel))
  }

  /**
   * Commits any pending typed state to history. Used before passing control
   * to the browser (e.g. Shift+Enter) so later edits undo cleanly.
   */
  pushHistory(): void {
    this._readSelectionFromDOM()
    this._flushHistoryDebounce()
  }

  // ── State inspection ──────────────────────────────────────────────────────

  isMarkActive(mark: MarkType): boolean {
    this._readSelectionFromDOM()
    return this._selection ? inspect.isMarkActive(this._doc, this._selection, mark) : false
  }

  getBlockType(): 'paragraph' | 'heading' | 'list' | 'mixed' {
    this._readSelectionFromDOM()
    return this._selection ? inspect.getBlockType(this._doc, this._selection) : 'paragraph'
  }

  getHeadingLevel(): 1 | 2 | 3 | 4 | 5 | 6 | null {
    this._readSelectionFromDOM()
    return this._selection ? inspect.getHeadingLevel(this._doc, this._selection) : null
  }

  getListType(): 'ordered' | 'unordered' | null {
    this._readSelectionFromDOM()
    return this._selection ? inspect.getListType(this._doc, this._selection) : null
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────

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

  // ── Private helpers ───────────────────────────────────────────────────────

  private _apply(
    command: (
      doc: DocumentNode,
      sel: ASTSelection,
    ) => { doc: DocumentNode; selection: ASTSelection },
  ): void {
    this._readSelectionFromDOM()
    if (!this._selection) return
    // Flush any pending typed state so it's in history before this snapshot.
    this._flushHistoryDebounce()

    const oldDoc = this._doc
    const result = command(this._doc, this._selection)
    const normalized = applySchema(result.doc, defaultRules)
    // Schema normalisation (e.g. merging adjacent text nodes with identical
    // marks) can shift inline indices, so remap the selection across it.
    const newSel = cmd.remapSelection(result.doc, normalized, result.selection)
    this._render(oldDoc, normalized, newSel)
    this._history = history.push(this._history, normalized, newSel)
    this._emitCanonical()
  }

  private _restore(entry: history.HistoryEntry): void {
    this._render(this._doc, entry.doc, entry.selection)
    this._emitCanonical()
  }

  private _emitCanonical(): void {
    this._emit(serializeToHTML(this._doc))
  }

  private _readSelectionFromDOM(): void {
    const sel = readSelection(this._el)
    if (sel) this._selection = sel
  }

  private _render(oldDoc: DocumentNode, newDoc: DocumentNode, newSel: ASTSelection | null): void {
    this._doc = newDoc
    this._selection = newSel

    if (canSurgicallyUpdate(oldDoc, newDoc)) {
      // Single DOM scan beats N querySelector calls when many blocks changed
      // (lists nest blocks inside <ul>/<ol>, so children iteration is unsafe).
      const elementsById = new Map<string, Element>()
      for (const el of this._el.querySelectorAll('[data-block-id]')) {
        elementsById.set(el.getAttribute('data-block-id')!, el)
      }
      for (let i = 0; i < newDoc.blocks.length; i++) {
        const oldBlock = oldDoc.blocks[i]
        const newBlock = newDoc.blocks[i]
        if (oldBlock === newBlock) continue
        const blockEl = elementsById.get(newBlock.id)
        if (blockEl) blockEl.innerHTML = serializeBlockInner(newBlock)
      }
    } else {
      this._el.innerHTML = serializeToDOMHTML(newDoc)
    }

    if (newSel) applySelection(this._el, newSel)
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
 * Surgical DOM updates are only safe when block IDs, types, and list-wrapper
 * attributes (ordered + indent) match in order — anything else changes the
 * HTML element tree (list grouping, heading level) and needs a full render.
 */
function canSurgicallyUpdate(oldDoc: DocumentNode, newDoc: DocumentNode): boolean {
  if (oldDoc.blocks.length !== newDoc.blocks.length) return false
  for (let i = 0; i < oldDoc.blocks.length; i++) {
    const a = oldDoc.blocks[i]
    const b = newDoc.blocks[i]
    if (a.id !== b.id || a.type !== b.type) return false
    if (a.type === 'heading' && b.type === 'heading' && a.level !== b.level) return false
    if (
      a.type === 'listItem' &&
      b.type === 'listItem' &&
      (a.ordered !== b.ordered || a.indent !== b.indent)
    ) {
      return false
    }
  }
  return true
}
