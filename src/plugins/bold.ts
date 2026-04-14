import { createPlugin } from '../create-plugin'

export const bold = createPlugin({
  name: 'bold',
  keybinding: 'mod+b',
  toolbar: { label: 'B', title: 'Bold (Mod+B)' },
  command(api) { api.execute('bold') },
  isActive(api) { return api.isCommandActive('bold') },
})
