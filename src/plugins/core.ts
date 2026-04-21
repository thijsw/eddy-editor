import type { EddyPlugin, EditorAPI, PluginContext } from '../types'
import type { DocumentNode, InlineNode } from '../ast/types'
import { emptyText, generateId } from '../ast/types'
import { insertDocument, insertParagraph } from '../ast/commands'

/**
 * Built-in plugin that binds Enter / Shift+Enter / paste / undo / redo.
 * Consumers can omit this from their plugins array to fully customise these
 * behaviours — the Schema's default paragraph spec stays either way, so
 * parsing still works.
 */
export const core: EddyPlugin = {
  name: 'core',
  commands: {
    'core.insertParagraph': (api) => {
      api.tr.apply((doc, sel) => insertParagraph(doc, sel))
    },
    'core.undo': (api) => api.undo(),
    'core.redo': (api) => api.redo(),
  },
  keybindings: {
    'mod+z': 'core.undo',
    'mod+shift+z': 'core.redo',
  },
  setup(ctx: PluginContext): () => void {
    const editor = ctx.editor

    const offKeydown = editor.on('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        editor.tr.apply((doc, sel) => insertParagraph(doc, sel))
        return
      }
      if (event.key === 'Enter' && event.shiftKey) {
        editor.pushHistory()
      }
    })

    const offPaste = editor.on('paste', (event) => {
      if (event.defaultPrevented) return
      event.preventDefault()
      const data = event.clipboardData
      if (!data) return
      const html = data.getData('text/html')
      if (html) {
        editor.insertHTML(html)
      } else {
        pasteAsPlainText(editor, data.getData('text/plain'))
      }
    })

    return () => {
      offKeydown()
      offPaste()
    }
  },
}

/**
 * Paste-specific plain-text insertion: newlines become paragraph breaks.
 * Lives here rather than on the Editor because this semantic is specific to
 * the paste fallback, not a general editor primitive.
 */
function pasteAsPlainText(editor: EditorAPI, text: string): void {
  if (text === '') return
  const lines = text.split(/\r?\n/)
  const blocks = lines.map((line) => {
    const children: InlineNode[] =
      line.length > 0 ? [{ type: 'text', text: line, marks: [] }] : [emptyText()]
    return { id: generateId(), type: 'paragraph', attrs: {}, children }
  })
  const inserted: DocumentNode = { type: 'document', blocks }
  editor.tr.apply((doc, sel) => insertDocument(doc, sel, inserted))
}
