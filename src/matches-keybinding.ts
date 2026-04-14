/**
 * Returns true if a KeyboardEvent matches a keybinding string.
 *
 * Binding format: modifier(s) joined by "+" followed by the key name.
 * Modifiers: "mod" (Cmd on Mac, Ctrl elsewhere), "shift", "alt", "ctrl"
 *
 * Examples: "mod+b", "mod+shift+z", "alt+f"
 *
 * Note: `navigator.platform` is accessed here. This function is only ever
 * called inside keydown event handlers — never at module load time — so it
 * is safe to use in SSR environments.
 */
export function matchesKeybinding(event: KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split('+')
  const key = parts[parts.length - 1]

  const needsMod = parts.includes('mod')
  const needsShift = parts.includes('shift')
  const needsAlt = parts.includes('alt')

  const isMac =
    typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

  const modSatisfied = needsMod
    ? isMac
      ? event.metaKey
      : event.ctrlKey
    : !(isMac ? event.metaKey : event.ctrlKey)

  return (
    event.key.toLowerCase() === key &&
    modSatisfied &&
    event.shiftKey === needsShift &&
    event.altKey === needsAlt
  )
}
