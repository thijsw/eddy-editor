import { createPlugin } from '../create-plugin'

export const unorderedList = createPlugin({
  name: 'unorderedList',
  toolbar: { label: 'UL', title: 'Bullet list' },
  command(api) { api.execute('insertUnorderedList') },
  isActive(api) { return api.isCommandActive('insertUnorderedList') },
})
