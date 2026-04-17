import type { EditorAPI } from './types'
import type { DocumentNode, MarkType } from './ast/types'
import { emptyParagraph } from './ast/types'
import type { ASTSelection } from './ast/selection'
import { parseLiveDOM } from './ast/parse'
import { serializeToHTML, serializeToDOMHTML, serializeBlockInner } from './ast/serialize'
import { readSelection, applySelection } from './ast/dom-mapping'
import { applySchema, defaultRules } from './ast/schema'
import * as cmd from './ast/commands'
import * as inspect from './ast/inspect'
import * as history from './ast/history'

export class EditorAPIImpl implements EditorAPI {
  private _el: HTMLElement | null = null
  private _doc: DocumentNode = { type: 'document', blocks: [emptyParagraph()] }
  private _selection: ASTSelection | null = null
  private _history = history.create(this._doc, null)
  private _historyDebounce: ReturnType<typeof setTimeout> | null = null
  private _onChange: (() => void) | null = null

  get el(): HTMLElement | null {
    return this._el
  }

  get doc(): DocumentNode {
    return this._doc
  }

  get selection(): ASTSelection | null {
    return this._selection
  }

  attach(el: HTMLElement): void {
    this._el = el
  }

  onChange(cb: () => void): void {
    this._onChange = cb
  }

  initDoc(doc: DocumentNode, selection: ASTSelection | null): void {
    this._doc = applySchema(doc, defaultRules)
    this._selection = selection
    this._history = history.create(this._doc, selection)
  }

  /**
   * Called from the editor's input handler after the browser mutates the DOM.
   * Re-parses the live DOM into the AST, normalises it, and returns the
   * canonical HTML for v-model emission.
   */
  syncFromDOM(): string | null {
    if (!this._el) return null

    const parsed = parseLiveDOM(this._el)
    this._doc = applySchema(parsed, defaultRules)
    this._selection = readSelection(this._el)

    this._scheduleHistoryPush()
    this._onChange?.()
    return serializeToHTML(this._doc)
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
    this._render(oldDoc, normalized, result.selection)
    this._history = history.push(this._history, normalized, result.selection)
    this._onChange?.()
  }

  private _restore(entry: history.HistoryEntry): void {
    this._render(this._doc, entry.doc, entry.selection)
    this._onChange?.()
  }

  private _readSelectionFromDOM(): void {
    if (!this._el) return
    const sel = readSelection(this._el)
    if (sel) this._selection = sel
  }

  private _render(oldDoc: DocumentNode, newDoc: DocumentNode, newSel: ASTSelection | null): void {
    this._doc = newDoc
    this._selection = newSel
    if (!this._el) return

    if (canSurgicallyUpdate(oldDoc, newDoc)) {
      for (let i = 0; i < newDoc.blocks.length; i++) {
        const oldBlock = oldDoc.blocks[i]
        const newBlock = newDoc.blocks[i]
        if (oldBlock === newBlock) continue
        const blockEl = this._el.querySelector(`[data-block-id="${newBlock.id}"]`)
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
