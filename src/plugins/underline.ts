import { createPlugin } from '../create-plugin'

export const underline = createPlugin({
  name: 'underline',
  keybinding: 'mod+u',
  toolbar: { label: 'U', title: 'Underline (Mod+U)' },
  command(api) { api.execute('underline') },
  isActive(api) { return api.isCommandActive('underline') },
})
