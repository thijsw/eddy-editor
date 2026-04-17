import type { Component } from 'vue'
import type { DocumentNode, MarkType } from './ast/types'
import type { ASTSelection } from './ast/selection'

export interface EditorAPI {
  readonly el: HTMLElement
  readonly doc: DocumentNode
  readonly selection: ASTSelection | null

  // Commands
  toggleMark(mark: MarkType): void
  setBlockType(type: 'paragraph' | 'heading', attrs?: { level?: 1 | 2 | 3 | 4 | 5 | 6 }): void
  toggleList(ordered: boolean): void
  insertHardBreak(): void
  insertParagraph(): void

  // State inspection
  isMarkActive(mark: MarkType): boolean
  getBlockType(): 'paragraph' | 'heading' | 'list' | 'mixed'
  getHeadingLevel(): 1 | 2 | 3 | 4 | 5 | 6 | null
  getListType(): 'ordered' | 'unordered' | null
}

export interface ToolbarConfig {
  /** Short display text shown when no icon is present, e.g. "B". Also used as aria-label. */
  label: string
  /** Tooltip text, e.g. "Bold (Mod+B)" */
  title: string
  /**
   * Optional Vue component rendered as the button content (e.g. a `@lucide/vue` icon).
   * When absent, `label` text is shown instead.
   */
  icon?: Component
}

export interface EddyPlugin {
  /** Unique identifier used for deduplication and active-state lookup */
  name: string
  /** Keyboard shortcut string, e.g. "mod+b". "mod" = Cmd on Mac, Ctrl elsewhere */
  keybinding?: string
  /** When present, a toolbar button is rendered for this plugin */
  toolbar?: ToolbarConfig
  command(api: EditorAPI): void
  isActive?(api: EditorAPI): boolean
}
