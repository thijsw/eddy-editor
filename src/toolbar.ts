import type { Editor, ToolbarItem } from './types'

const svg = (inner: string) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`

/**
 * Render a toolbar into `host` and keep it in sync with the editor. Items
 * default to everything the editor's plugins contribute. Returns a cleanup.
 */
export function mountToolbar(
  host: HTMLElement,
  ed: Editor,
  items: readonly ToolbarItem[] = ed.plugins.flatMap((p) => p.toolbar || []),
): () => void {
  const updates: (() => void)[] = []
  host.className = 'eddy-toolbar'
  host.setAttribute('role', 'toolbar')
  host.replaceChildren(
    ...items.map((item) => {
      if ('options' in item) {
        const s = document.createElement('select')
        s.className = 'eddy-toolbar-select'
        s.title = item.title
        for (const [v, l] of item.options) s.add(new Option(l, v))
        s.onchange = () => {
          item.run(ed, s.value)
          ed.el.focus()
        }
        updates.push(() => {
          s.value = item.value(ed)
          s.disabled = !ed.editable
        })
        return s
      }
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'eddy-toolbar-btn'
      b.title = item.title
      b.setAttribute('aria-label', item.title)
      if (item.icon) b.innerHTML = svg(item.icon)
      else b.textContent = item.label || item.title
      b.onmousedown = (e) => e.preventDefault() // keep the editor's selection
      b.onclick = () => item.run(ed)
      updates.push(() => {
        b.disabled = !ed.editable
        if (!item.active) return
        const on = item.active(ed)
        b.classList.toggle('is-active', on)
        b.setAttribute('aria-pressed', String(on))
      })
      return b
    }),
  )
  const update = () => updates.forEach((f) => f())
  update()
  const off = ed.subscribe(update)
  return () => {
    off()
    host.replaceChildren()
  }
}
