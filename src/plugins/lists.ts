import type { EddyPlugin } from '../types'

function list(ordered: boolean, name: string, label: string, title: string): EddyPlugin {
  const variant = ordered ? 'ordered' : 'unordered'
  return {
    name,
    toolbar: { label, title },
    command(api) {
      api.toggleList(ordered)
    },
    isActive(api) {
      return api.getListType() === variant
    },
  }
}

export const unorderedList = list(false, 'unorderedList', 'UL', 'Bullet list')
export const orderedList = list(true, 'orderedList', 'OL', 'Numbered list')
