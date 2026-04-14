import type { EditorAPI } from './types'

export class EditorAPIImpl implements EditorAPI {
  private _el: HTMLElement | null = null

  get el(): HTMLElement | null {
    return this._el
  }

  attach(el: HTMLElement): void {
    this._el = el
  }

  execute(command: string, value?: string): void {
    if (!this._el) return
    this._el.focus()
    // execCommand is deprecated but remains the only practical cross-browser
    // API for rich text editing without a full editor framework.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(command, false, value)
  }

  isCommandActive(command: string): boolean {
    if (typeof document === 'undefined') return false
    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      return document.queryCommandState(command)
    } catch {
      return false
    }
  }

  getCommandValue(command: string): string {
    if (typeof document === 'undefined') return ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      return document.queryCommandValue(command) ?? ''
    } catch {
      return ''
    }
  }
}
