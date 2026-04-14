import { createPlugin } from '../create-plugin'

export const orderedList = createPlugin({
  name: 'orderedList',
  toolbar: { label: 'OL', title: 'Numbered list' },
  command(api) { api.execute('insertOrderedList') },
  isActive(api) { return api.isCommandActive('insertOrderedList') },
})
