import type { EditorAPI } from './types'
import type { DocumentNode, Mark, MarkType } from './ast/types'
import type { ASTSelection } from './ast/selection'
import type { HistoryStack } from './ast/history'
import { parseLiveDOM } from './ast/parse'
import { serializeToHTML } from './ast/serialize'
import { readSelection, applySelection } from './ast/dom-mapping'
import { applySchema, defaultRules } from './ast/schema'
import {
  toggleMark as cmdToggleMark,
  setBlockType as cmdSetBlockType,
  toggleList as cmdToggleList,
  insertParagraph as cmdInsertParagraph,
  insertHardBreak as cmdInsertHardBreak,
} from './ast/commands'
import {
  isMarkActive as inspectMarkActive,
  getBlockType as inspectBlockType,
  getHeadingLevel as inspectHeadingLevel,
} from './ast/inspect'
import { createHistory, push as historyPush, undo as historyUndo, redo as historyRedo, current as historyCurrent } from './ast/history'

// ── EditorAPIImpl ─────────────────────────────────────────────────────────────

export class EditorAPIImpl implements EditorAPI {
  private _el: HTMLElement | null = null
  private _doc: DocumentNode = { type: 'document', children: [{ type: 'paragraph', children: [{ type: 'text', text: '', marks: [] }] }] }
  private _selection: ASTSelection | null = null
  private _storedMarks: Mark[] = []
  private _history: HistoryStack = createHistory(this._doc, null)
  private _historyDebounce: ReturnType<typeof setTimeout> | null = null
  private _suppressInputSync = false
  private _onChangeCallbacks: Array<() => void> = []

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
    this._onChangeCallbacks.push(cb)
  }

  private _notifyChange(): void {
    for (const cb of this._onChangeCallbacks) cb()
  }

  // ── AST initialisation ────────────────────────────────────────────────────

  initDoc(doc: DocumentNode, selection: ASTSelection | null): void {
    this._doc = doc
    this._selection = selection
    this._history = createHistory(doc, selection)
  }

  // ── Sync browser DOM → AST (called from onInput) ─────────────────────────

  syncFromDOM(): string | null {
    if (!this._el || this._suppressInputSync) return null

    const parsed = parseLiveDOM(this._el)
    const normalized = applySchema(parsed, defaultRules)

    this._doc = normalized
    this._selection = readSelection(this._el, this._doc)

    const parsedHTML = serializeToHTML(parsed)
    const normalizedHTML = serializeToHTML(normalized)
    if (parsedHTML !== normalizedHTML) {
      this._renderDOM()
    }

    this._scheduleHistoryPush()
    this._notifyChange()
    return serializeToHTML(this._doc)
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  toggleMark(mark: MarkType): void {
    this._readSelectionFromDOM()
    if (!this._selection) return
    this._pushHistoryNow()

    const result = cmdToggleMark(this._doc, this._selection, mark, this._storedMarks)
    this._doc = applySchema(result.doc, defaultRules)
    this._selection = result.selection
    if (result.storedMarks !== null) {
      this._storedMarks = result.storedMarks
      this._injectStoredMarkCursor()
    } else {
      this._storedMarks = []
      this._renderDOM()
    }
    this._notifyChange()
  }

  setBlockType(type: 'paragraph' | 'heading', attrs?: { level?: 1 | 2 | 3 | 4 | 5 | 6 }): void {
    this._readSelectionFromDOM()
    if (!this._selection) return
    this._pushHistoryNow()

    const result = cmdSetBlockType(this._doc, this._selection, type, attrs)
    this._doc = applySchema(result.doc, defaultRules)
    this._selection = result.selection
    this._storedMarks = []
    this._renderDOM()
    this._notifyChange()
  }

  toggleList(ordered: boolean): void {
    this._readSelectionFromDOM()
    if (!this._selection) return
    this._pushHistoryNow()

    const result = cmdToggleList(this._doc, this._selection, ordered)
    this._doc = applySchema(result.doc, defaultRules)
    this._selection = result.selection
    this._storedMarks = []
    this._renderDOM()
    this._notifyChange()
  }

  insertParagraph(): void {
    this._readSelectionFromDOM()
    if (!this._selection) return
    this._pushHistoryNow()

    const result = cmdInsertParagraph(this._doc, this._selection)
    this._doc = applySchema(result.doc, defaultRules)
    this._selection = result.selection
    this._storedMarks = []
    this._renderDOM()
    this._notifyChange()
  }

  insertHardBreak(): void {
    this._readSelectionFromDOM()
    if (!this._selection) return
    this._pushHistoryNow()

    const result = cmdInsertHardBreak(this._doc, this._selection)
    this._doc = applySchema(result.doc, defaultRules)
    this._selection = result.selection
    this._storedMarks = []
    this._renderDOM()
    this._notifyChange()
  }

  // ── State inspection ──────────────────────────────────────────────────────

  isMarkActive(mark: MarkType): boolean {
    this._readSelectionFromDOM()
    if (!this._selection) return false
    return inspectMarkActive(this._doc, this._selection, this._storedMarks, mark)
  }

  getBlockType(): 'paragraph' | 'heading' | 'list' | 'mixed' {
    this._readSelectionFromDOM()
    if (!this._selection) return 'paragraph'
    return inspectBlockType(this._doc, this._selection)
  }

  getHeadingLevel(): 1 | 2 | 3 | 4 | 5 | 6 | null {
    this._readSelectionFromDOM()
    if (!this._selection) return null
    return inspectHeadingLevel(this._doc, this._selection)
  }

  getListType(): 'ordered' | 'unordered' | null {
    this._readSelectionFromDOM()
    if (!this._selection) return null
    const block = this._doc.children[this._selection.anchor.blockIndex]
    if (block?.type !== 'list') return null
    return block.ordered ? 'ordered' : 'unordered'
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  undo(): void {
    this._flushHistoryDebounce()
    const result = historyUndo(this._history)
    if (!result) return
    this._history = result
    const entry = historyCurrent(this._history)
    this._doc = entry.doc
    this._selection = entry.selection
    this._storedMarks = []
    this._renderDOM()
    this._notifyChange()
  }

  redo(): void {
    const result = historyRedo(this._history)
    if (!result) return
    this._history = result
    const entry = historyCurrent(this._history)
    this._doc = entry.doc
    this._selection = entry.selection
    this._storedMarks = []
    this._renderDOM()
    this._notifyChange()
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _readSelectionFromDOM(): void {
    if (!this._el) return
    this._selection = readSelection(this._el, this._doc)
  }

  private _renderDOM(): void {
    if (!this._el) return
    this._suppressInputSync = true
    this._el.innerHTML = serializeToHTML(this._doc)
    if (this._selection) {
      applySelection(this._el, this._doc, this._selection)
    }
    this._suppressInputSync = false
  }

  /**
   * Injects empty mark wrapper elements into the live DOM and places the
   * cursor inside them so the browser naturally types within the marks.
   */
  private _injectStoredMarkCursor(): void {
    if (!this._el || this._storedMarks.length === 0) return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return

    const MARK_TO_TAG: Record<string, string> = {
      bold: 'strong',
      italic: 'em',
      underline: 'u',
      strikethrough: 's',
    }

    let innermost: HTMLElement | null = null
    let outermost: HTMLElement | null = null
    for (const mark of this._storedMarks) {
      const tag = MARK_TO_TAG[mark.type]
      if (!tag) continue
      const el = document.createElement(tag)
      if (!outermost) outermost = el
      if (innermost) {
        innermost.appendChild(el)
      }
      innermost = el
    }

    if (!outermost || !innermost) return

    const zws = document.createTextNode('\u200B')
    innermost.appendChild(zws)
    range.insertNode(outermost)

    const newRange = document.createRange()
    newRange.setStart(zws, 1)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
  }

  private _pushHistoryNow(): void {
    this._flushHistoryDebounce()
    this._history = historyPush(this._history, this._doc, this._selection)
  }

  private _scheduleHistoryPush(): void {
    if (this._historyDebounce !== null) {
      clearTimeout(this._historyDebounce)
    }
    this._historyDebounce = setTimeout(() => {
      this._history = historyPush(this._history, this._doc, this._selection)
      this._historyDebounce = null
    }, 300)
  }

  private _flushHistoryDebounce(): void {
    if (this._historyDebounce !== null) {
      clearTimeout(this._historyDebounce)
      this._history = historyPush(this._history, this._doc, this._selection)
      this._historyDebounce = null
    }
  }
}
