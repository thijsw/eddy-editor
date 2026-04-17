import type { MarkType } from '../ast/types'
import type { EddyPlugin } from '../types'

function mark(type: MarkType, label: string, title: string, keybinding?: string): EddyPlugin {
  return {
    name: type,
    ...(keybinding ? { keybinding } : {}),
    toolbar: { label, title },
    command(api) {
      api.toggleMark(type)
    },
    isActive(api) {
      return api.isMarkActive(type)
    },
  }
}

export const bold = mark('bold', 'B', 'Bold (Mod+B)', 'mod+b')
export const italic = mark('italic', 'I', 'Italic (Mod+I)', 'mod+i')
export const underline = mark('underline', 'U', 'Underline (Mod+U)', 'mod+u')
export const strikethrough = mark('strikethrough', 'S', 'Strikethrough')
