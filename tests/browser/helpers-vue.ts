import { render } from 'vitest-browser-vue'
import { nextTick } from 'vue'
import Harness from './editor-harness.vue'
import type { MountFn, MountOptions, MountResult } from './helpers-shared'
import { tick } from './helpers-shared'

export const mountEditor: MountFn = async (
  initial: string,
  opts: MountOptions = {},
): Promise<MountResult> => {
  let lastEmitted = initial
  const onEmit = (v: string) => {
    lastEmitted = v
  }

  const placeholder = opts.placeholder ?? ''
  const screen = render(Harness, {
    props: { initial, disabled: opts.disabled ?? false, placeholder, onEmit },
  })

  await nextTick()
  await tick()

  return {
    getEmitted: () => lastEmitted,
    setContent: async (html) => {
      screen.rerender({
        initial: html,
        disabled: opts.disabled ?? false,
        placeholder,
        onEmit,
      })
      await nextTick()
      await tick()
    },
    setDisabled: async (disabled) => {
      opts.disabled = disabled
      screen.rerender({ initial, disabled, placeholder, onEmit })
      await nextTick()
      await tick()
    },
    unmount: () => screen.unmount(),
  }
}
