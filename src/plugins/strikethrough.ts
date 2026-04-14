import { createPlugin } from '../create-plugin'

export const strikethrough = createPlugin({
  name: 'strikethrough',
  toolbar: { label: 'S', title: 'Strikethrough' },
  command(api) { api.toggleMark('strikethrough') },
  isActive(api) { return api.isMarkActive('strikethrough') },
})
