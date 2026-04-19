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
  setLink(href: string): void
  removeLink(): void
  insertHardBreak(): void
  insertParagraph(): void

  // State inspection
  isMarkActive(mark: MarkType): boolean
  getBlockType(): 'paragraph' | 'heading' | 'list' | 'mixed'
  getHeadingLevel(): 1 | 2 | 3 | 4 | 5 | 6 | null
  getListType(): 'ordered' | 'unordered' | null
  getLinkHref(): string | null
}

export interface ToolbarConfig {
  /** Short display text shown when no icon is present, e.g. "B". Also used as aria-label. */
  label: string
  /** Tooltip text, e.g. "Bold (Mod+B)" */
  title: string
  /**
   * Framework-specific component rendered as the button content. The Vue
   * toolbar expects a Vue `Component`; the React toolbar expects a
   * `ComponentType<{ size: number }>`. Typed as `unknown` here so this
   * interface stays framework-agnostic.
   */
  icon?: unknown
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
