import { page, userEvent } from 'vitest/browser'
import { afterEach, vi } from 'vitest'

export { page, userEvent }

export const BTN = {
  bold: 'Bold (Mod+B)',
  italic: 'Italic (Mod+I)',
  underline: 'Underline (Mod+U)',
  strikethrough: 'Strikethrough',
  code: 'Code (Mod+E)',
  link: 'Link (Mod+K)',
  ul: 'Bullet list',
  ol: 'Numbered list',
}

export interface MountOptions {
  disabled?: boolean
  placeholder?: string
}

export interface MountResult {
  getEmitted(): string
  setContent(html: string): Promise<void>
  setDisabled(disabled: boolean): Promise<void>
  unmount(): void
}

export type MountFn = (initial: string, opts?: MountOptions) => Promise<MountResult>

/**
 * Selects a text substring inside the editor using the Selection API.
 */
export async function selectInEditor(searchText: string): Promise<void> {
  const editor = editorEl()
  const found = findText(editor, searchText)
  if (!found) throw new Error(`Could not find text "${searchText}" in editor`)
  const range = document.createRange()
  range.setStart(found.node, found.offset)
  range.setEnd(found.node, found.offset + searchText.length)
  applyRange(range, editor)
  await tick()
}

/** Place a collapsed cursor in the middle of `searchText`. */
export async function placeCursorIn(searchText: string): Promise<void> {
  const editor = editorEl()
  const found = findText(editor, searchText)
  if (!found) throw new Error(`Could not find text "${searchText}" in editor`)
  const range = document.createRange()
  range.setStart(found.node, found.offset + Math.floor(searchText.length / 2))
  range.collapse(true)
  applyRange(range, editor)
  await tick()
}

/** Select the entire editor contents. */
export async function selectAll(): Promise<void> {
  const editor = editorEl()
  editor.focus()
  const range = document.createRange()
  range.selectNodeContents(editor)
  applyRange(range, editor)
  await tick()
}

/** Clear the editor and type fresh content via synthesized keyboard events. */
export async function clearAndType(text: string): Promise<void> {
  await selectAll()
  await press('Delete')
  editorEl().focus()
  await type(text)
}

/**
 * Playwright-compatible key-press syntax: 'Enter', 'Meta+B', 'Shift+Enter',
 * 'Home', 'End', 'Delete'. Translates to @vitest/browser's userEvent.keyboard
 * syntax under the hood.
 */
export function press(key: string): Promise<void> {
  const parts = key.split('+')
  const modifiers = parts.slice(0, -1)
  const base = parts[parts.length - 1]
  const baseToken = base.length === 1 ? base.toLowerCase() : `{${base}}`
  let seq = baseToken
  for (const mod of [...modifiers].reverse()) {
    seq = `{${mod}>}${seq}{/${mod}}`
  }
  return userEvent.keyboard(seq)
}

/** Type plain text into the currently focused element. */
export function type(text: string): Promise<void> {
  const escaped = text.replace(/[{[]/g, '$&$&')
  return userEvent.keyboard(escaped)
}

/** Queue a single window.prompt response; returns the spy for inspection. */
export function mockPrompt(response: string | null): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(window, 'prompt').mockReturnValueOnce(response)
}

function editorEl(): HTMLElement {
  const el = document.querySelector('.eddy-editor') as HTMLElement | null
  if (!el) throw new Error('No .eddy-editor element mounted')
  return el
}

function applyRange(range: Range, editor: HTMLElement): void {
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  editor.focus()
  document.dispatchEvent(new Event('selectionchange'))
}

function findText(node: Node, str: string): { node: Text; offset: number } | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const idx = (node.textContent ?? '').indexOf(str)
    if (idx !== -1) return { node: node as Text, offset: idx }
  }
  for (const child of Array.from(node.childNodes)) {
    const r = findText(child, str)
    if (r) return r
  }
  return null
}

export function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

// Per-test reset so window.prompt stubs and other spies don't leak.
afterEach(() => {
  vi.restoreAllMocks()
})
