import { createPlugin } from '../create-plugin'
import { StrikethroughIcon } from '../icons'

export const strikethrough = createPlugin({
  name: 'strikethrough',
  toolbar: { label: 'S', title: 'Strikethrough', icon: StrikethroughIcon },
  command(api) { api.toggleMark('strikethrough') },
  isActive(api) { return api.isMarkActive('strikethrough') },
})
