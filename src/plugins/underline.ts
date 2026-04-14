import { createPlugin } from '../create-plugin'
import { UnderlineIcon } from '../icons'

export const underline = createPlugin({
  name: 'underline',
  keybinding: 'mod+u',
  toolbar: { label: 'U', title: 'Underline (Mod+U)', icon: UnderlineIcon },
  command(api) { api.toggleMark('underline') },
  isActive(api) { return api.isMarkActive('underline') },
})
