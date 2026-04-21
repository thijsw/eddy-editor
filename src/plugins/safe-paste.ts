import type { EddyPlugin } from '../types'
import { cleanPastedHTML } from '../ast/clean-paste'

/**
 * Opt-in paste sanitiser for content from Word, Google Docs, and other
 * HTML sources with Office-specific noise. Rewrites pasted HTML in place
 * (empty `<p>&nbsp;</p>` spacers, MS conditional comments, `<o:p>`
 * namespaced tags, Office classes) before the core paste handler processes
 * it.
 *
 * Include before `core` in the plugins array (it must register its `paste`
 * listener first so it can mutate the event before core inserts). Omitting
 * this plugin lets ~3 kB of cleanup tables + the walker tree-shake out; the
 * schema parser still sanitises attributes, so unsafe input is not a risk,
 * but you'll see extra empty paragraphs and stray wrappers from Office
 * pastes.
 */
export const safePaste: EddyPlugin = {
  name: 'safePaste',
  setup(ctx) {
    return ctx.editor.on('paste', (event) => {
      if (event.defaultPrevented) return
      const data = event.clipboardData
      if (!data) return
      const html = data.getData('text/html')
      if (!html) return

      const cleaned = cleanPastedHTML(html)
      event.preventDefault()
      if (cleaned.trim() !== '') ctx.editor.insertHTML(cleaned)
    })
  },
}
