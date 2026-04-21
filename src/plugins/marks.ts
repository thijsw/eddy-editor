import type { EddyPlugin } from '../types'
import type { MarkSpec } from '../ast/schema'

function markPlugin(
  name: string,
  spec: MarkSpec,
  label: string,
  title: string,
  keybinding?: string,
): EddyPlugin {
  return {
    name,
    marks: [spec],
    commands: {
      [`${name}.toggle`]: (api) => api.toggleMark(name),
    },
    ...(keybinding ? { keybindings: { [keybinding]: `${name}.toggle` } } : {}),
    toolbar: [
      {
        command: `${name}.toggle`,
        label,
        title,
        isActive: (api) => api.isMarkActive(name),
      },
    ],
  }
}

export const bold = markPlugin(
  'bold',
  { type: 'bold', parseDOM: [{ tag: 'strong' }, { tag: 'b' }], toDOM: () => ['strong'] },
  'B',
  'Bold (Mod+B)',
  'mod+b',
)

export const italic = markPlugin(
  'italic',
  { type: 'italic', parseDOM: [{ tag: 'em' }, { tag: 'i' }], toDOM: () => ['em'] },
  'I',
  'Italic (Mod+I)',
  'mod+i',
)

export const underline = markPlugin(
  'underline',
  { type: 'underline', parseDOM: [{ tag: 'u' }], toDOM: () => ['u'] },
  'U',
  'Underline (Mod+U)',
  'mod+u',
)

export const strikethrough = markPlugin(
  'strikethrough',
  {
    type: 'strikethrough',
    parseDOM: [{ tag: 's' }, { tag: 'strike' }, { tag: 'del' }],
    toDOM: () => ['s'],
  },
  'S',
  'Strikethrough',
)

export const code = markPlugin(
  'code',
  { type: 'code', parseDOM: [{ tag: 'code' }], toDOM: () => ['code'] },
  '<>',
  'Code (Mod+E)',
  'mod+e',
)
