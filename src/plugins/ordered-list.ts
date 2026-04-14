import { createPlugin } from '../create-plugin'

export const orderedList = createPlugin({
  name: 'orderedList',
  toolbar: { label: 'OL', title: 'Numbered list' },
  command(api) { api.toggleList(true) },
  isActive(api) { return api.getListType() === 'ordered' },
})
