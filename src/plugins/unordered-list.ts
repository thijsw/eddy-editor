import { createPlugin } from '../create-plugin'
import { ListIcon } from '../icons'

export const unorderedList = createPlugin({
  name: 'unorderedList',
  toolbar: { label: 'UL', title: 'Bullet list', icon: ListIcon },
  command(api) { api.toggleList(false) },
  isActive(api) { return api.getListType() === 'unordered' },
})
