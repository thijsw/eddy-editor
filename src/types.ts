import type { InjectionKey, Ref } from 'vue'

export interface EditorAPI {
  readonly el: HTMLElement | null
  execute(command: string, value?: string): void
  isCommandActive(command: string): boolean
  getCommandValue(command: string): string
}

export interface ToolbarConfig {
  /** Short display text shown on the toolbar button, e.g. "B" */
  label: string
  /** Tooltip text, e.g. "Bold (Mod+B)" */
  title: string
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

export interface EddyProvision {
  /** The EditorAPI ref — may be null before mount */
  api: Ref<EditorAPI | null>
  /** Live list of all registered plugins (built-ins + consumer plugins) */
  readonly plugins: EddyPlugin[]
}

export const EDDY_INJECTION_KEY: InjectionKey<EddyProvision> = Symbol('eddy')
