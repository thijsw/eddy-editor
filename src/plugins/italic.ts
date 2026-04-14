import { createPlugin } from '../create-plugin'
import { ItalicIcon } from '../icons'

export const italic = createPlugin({
  name: 'italic',
  keybinding: 'mod+i',
  toolbar: { label: 'I', title: 'Italic (Mod+I)', icon: ItalicIcon },
  command(api) { api.toggleMark('italic') },
  isActive(api) { return api.isMarkActive('italic') },
})
