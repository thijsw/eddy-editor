import { createPlugin } from '../create-plugin'

export const unorderedList = createPlugin({
  name: 'unorderedList',
  toolbar: { label: 'UL', title: 'Bullet list' },
  command(api) { api.toggleList(false) },
  isActive(api) { return api.getListType() === 'unordered' },
})
