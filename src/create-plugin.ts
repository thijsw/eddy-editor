import type { EddyPlugin } from './types'

/**
 * Type-safe plugin factory. This is an identity function — it returns the
 * config object unchanged, but provides full TypeScript inference for
 * consumers writing custom plugins.
 *
 * @example
 * const highlightPlugin = createPlugin({
 *   name: 'highlight',
 *   keybinding: 'mod+h',
 *   toolbar: { label: 'H', title: 'Highlight' },
 *   command(api) { api.execute('hiliteColor', 'yellow') },
 *   isActive(api) { return api.getCommandValue('hiliteColor') === 'yellow' },
 * })
 */
export function createPlugin(config: EddyPlugin): EddyPlugin {
  return config
}
