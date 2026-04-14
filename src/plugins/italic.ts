import { createPlugin } from '../create-plugin'

export const italic = createPlugin({
  name: 'italic',
  keybinding: 'mod+i',
  toolbar: { label: 'I', title: 'Italic (Mod+I)' },
  command(api) { api.toggleMark('italic') },
  isActive(api) { return api.isMarkActive('italic') },
})
