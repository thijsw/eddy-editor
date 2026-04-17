import type { EddyPlugin } from '../types'

export const link: EddyPlugin = {
  name: 'link',
  keybinding: 'mod+k',
  toolbar: { label: '🔗', title: 'Link (Mod+K)' },
  command(api) {
    if (typeof window === 'undefined') return
    const current = api.getLinkHref()
    const input = window.prompt(current ? 'Edit link URL' : 'Link URL', current ?? '')
    if (input === null) return // User cancelled
    const trimmed = input.trim()
    if (trimmed === '') {
      if (current !== null) api.removeLink()
      return
    }
    api.setLink(trimmed)
  },
  isActive(api) {
    return api.isMarkActive('link')
  },
}
