import { createPlugin } from '../create-plugin'
import { ListOrderedIcon } from '../icons'

export const orderedList = createPlugin({
  name: 'orderedList',
  toolbar: { label: 'OL', title: 'Numbered list', icon: ListOrderedIcon },
  command(api) { api.toggleList(true) },
  isActive(api) { return api.getListType() === 'ordered' },
})
