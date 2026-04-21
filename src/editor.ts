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
import { emptyParagraph } from './ast/types'
import type { ASTSelection } from './ast/selection'
import { positionsEqual } from './ast/selection'
import type { Schema, MarkSpec, BlockSpec, SchemaRule } from './ast/schema'
import { Schema as SchemaCls } from './ast/schema'
import { parseHTML, parseLiveDOM } from './ast/parse'
import { serializeToHTML, serializeToDOMHTML, serializeBlockInner } from './ast/serialize'
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

    for (const [key, cmdName] of this._keybindings) {
      if (matchesKeybinding(event, key)) {
        event.preventDefault()
        this.run(cmdName)
        return
      }
    }
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
        if (blockEl) blockEl.innerHTML = serializeBlockInner(newBlock, this._schema)
      }
    } else {
      this._el.innerHTML = serializeToDOMHTML(newDoc, this._schema)
    }

    this._updateEmptyAttr()
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

function buildSchema(plugins: EddyPlugin[]): Schema {
  const marks: MarkSpec[] = []
  const blocks: BlockSpec[] = []
  for (const plugin of plugins) {
    if (plugin.marks) marks.push(...plugin.marks)
    if (plugin.blocks) blocks.push(...plugin.blocks)
  }
  return new SchemaCls(marks, blocks)
}
