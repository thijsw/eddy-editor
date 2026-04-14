import { createPlugin } from '../create-plugin'
import { BoldIcon } from '../icons'

export const bold = createPlugin({
  name: 'bold',
  keybinding: 'mod+b',
  toolbar: { label: 'B', title: 'Bold (Mod+B)', icon: BoldIcon },
  command(api) { api.toggleMark('bold') },
  isActive(api) { return api.isMarkActive('bold') },
})
