import type { Attrs, Block, Doc, Marks, Selection, Transform } from './model'
import type { BlockSpec, MarkSpec, Schema } from './schema'

/** Return `false` to pass the key on (to earlier plugins, then the browser). */
export type KeyHandler = (editor: Editor, event: KeyboardEvent) => boolean | void

export interface ButtonItem {
  title: string
  /** Text shown when there is no icon. Defaults to `title`. */
  label?: string
  /** Inner SVG markup for a 24×24 stroke icon. */
  icon?: string
  run(editor: Editor): void
  active?(editor: Editor): boolean
}

export interface SelectItem {
  title: string
  /** `[value, label]` pairs. */
  options: readonly (readonly [string, string])[]
  value(editor: Editor): string
  run(editor: Editor, value: string): void
}

export type ToolbarItem = ButtonItem | SelectItem

export interface Plugin {
  marks?: Record<string, MarkSpec>
  blocks?: Record<string, BlockSpec>
  /** Keybinding (`'mod+shift+x'`, `'enter'`) → handler. Later plugins win. */
  keys?: Record<string, KeyHandler>
  toolbar?: ToolbarItem[]
  /** Runs after every change, after the built-in normalisation. */
  normalize?(doc: Doc): Doc
  /** Runs once on creation. Return a cleanup for `destroy()`. */
  setup?(editor: Editor): (() => void) | void
}

export interface EditorOptions {
  plugins?: readonly Plugin[]
  content?: string
  onChange?(html: string): void
}

export interface Editor {
  readonly el: HTMLElement
  readonly schema: Schema
  readonly plugins: readonly Plugin[]
  readonly doc: Doc
  readonly selection: Selection | null
  editable: boolean

  /** Run a transform with history, normalisation and rendering handled. */
  apply(fn: Transform): void
  toggleMark(type: string, attrs?: Attrs): void
  /** Per-block toggle: blocks already of this type and attrs become paragraphs. */
  setBlock(type: string, attrs?: Attrs): void
  /** Insert after the current block (or replace it, if an empty paragraph). */
  insertBlock(type: string, attrs?: Attrs): void
  insertHTML(html: string): void
  /** Insert plain text; newlines start new paragraphs. */
  insertText(text: string): void

  getMarks(): Marks
  getBlock(): Block | null
  getHTML(): string
  setHTML(html: string): void
  isEmpty(): boolean

  undo(): void
  redo(): void
  /** Close the current typing group in history. */
  commit(): void

  /** Called after every document or selection change. Returns unsubscribe. */
  subscribe(fn: () => void): () => void
  destroy(): void
}
