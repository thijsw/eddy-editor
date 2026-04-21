import type { BlockNode, DocumentNode, Mark } from './ast/types'
import type { ASTSelection } from './ast/selection'
import type { MarkSpec, BlockSpec, Schema, SchemaRule } from './ast/schema'
import type { CommandResult } from './ast/commands'

export type CommandFn = (api: EditorAPI, ...args: unknown[]) => void

export interface ToolbarItem {
  /** Name of a registered command to run on click. */
  command: string
  /** Optional positional arguments spread into `editor.run(command, ...args)`. */
  args?: unknown[]
  /** Short display text when no icon is present (also used as aria-label fallback). */
  label: string
  /** Tooltip text. */
  title: string
  /** Framework-specific icon component. Typed as unknown to stay framework-agnostic. */
  icon?: unknown
  /** Optional active-state query (drives `is-active` styling and aria-pressed). */
  isActive?(api: EditorAPI): boolean
}

export type EditorEvent = 'change' | 'selectionchange' | 'keydown' | 'paste' | 'destroy'

export interface EventHandlerMap {
  change: (html: string) => void
  selectionchange: (selection: ASTSelection | null) => void
  keydown: (event: KeyboardEvent) => void
  paste: (event: ClipboardEvent) => void
  destroy: () => void
}

export interface TransactionAPI {
  /**
   * Apply a pure function that transforms the document + selection. History,
   * schema normalisation, DOM rendering, and change emission are handled
   * automatically.
   */
  apply(fn: (doc: DocumentNode, sel: ASTSelection) => CommandResult): void
}

export interface PluginContext {
  readonly editor: EditorAPI
  /**
   * Dynamically register a command. Returns a cleanup handle — call it from
   * the function returned by `setup(ctx)` to tie the command's lifetime to
   * the plugin. Prefer declaring static commands via `plugin.commands`.
   *
   * Event subscription and transactions live on the editor itself:
   * `ctx.editor.on(...)`, `ctx.editor.tr.apply(...)`.
   */
  registerCommand(name: string, fn: CommandFn): () => void
}

export interface EddyPlugin {
  /** Unique identifier; duplicate names override one another (last wins). */
  name: string
  /** Mark specs this plugin contributes to the schema. */
  marks?: MarkSpec[]
  /** Block specs this plugin contributes to the schema. */
  blocks?: BlockSpec[]
  /**
   * Normalisation rules applied after every mutation, in addition to the
   * built-in rules (merge adjacent text nodes, ensure non-empty blocks).
   * Each rule is a pure function from doc to doc.
   */
  schemaRules?: SchemaRule[]
  /** Named commands registered into the editor's command registry. */
  commands?: Record<string, CommandFn>
  /** Keybinding string → command name. Matched keybindings preventDefault. */
  keybindings?: Record<string, string>
  /** Toolbar items rendered by `<EddyToolbar>`. */
  toolbar?: ToolbarItem[]
  /**
   * Lifecycle hook run once on editor construction. Return an optional cleanup
   * function called on editor destroy. Use this for event subscriptions,
   * imperative commands, or complex behavior that doesn't fit the declarative
   * contributions above.
   */
  setup?(ctx: PluginContext): (() => void) | void
}

export interface EditorAPI {
  readonly el: HTMLElement
  readonly doc: DocumentNode
  readonly selection: ASTSelection | null
  readonly schema: Schema
  readonly tr: TransactionAPI

  // Mutation primitives.
  toggleMark(type: string, attrs?: Record<string, unknown>): void
  setBlockType(type: string, attrs?: Record<string, unknown>): void
  /**
   * Parse an HTML string with the editor's schema and insert it at the
   * current selection. Used by the core plugin's paste handler and available
   * for programmatic content insertion.
   */
  insertHTML(html: string): void

  // History.
  undo(): void
  redo(): void
  /**
   * Flush any debounced typing state into history. Call this before passing
   * control to a native browser operation (e.g. Shift+Enter that lets the
   * browser insert a `<br>`) so subsequent edits undo cleanly.
   */
  pushHistory(): void

  // Inspection.
  isMarkActive(type: string): boolean
  getMarkAt(type: string): Mark | null
  getBlockAt(): BlockNode | null

  // Named command dispatch.
  run(command: string, ...args: unknown[]): void

  // Event subscription. Returns an unsubscribe function.
  on<E extends EditorEvent>(event: E, handler: EventHandlerMap[E]): () => void
}
