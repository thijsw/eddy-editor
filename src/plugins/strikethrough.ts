import { createPlugin } from '../create-plugin'

export const strikethrough = createPlugin({
  name: 'strikethrough',
  toolbar: { label: 'S', title: 'Strikethrough' },
  command(api) { api.execute('strikeThrough') },
  isActive(api) { return api.isCommandActive('strikeThrough') },
})
