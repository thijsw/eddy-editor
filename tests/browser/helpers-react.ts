import { createElement } from 'react'
import { render } from 'vitest-browser-react'
import { Harness } from './editor-harness'
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

  let currentDisabled = opts.disabled ?? false
  let currentInitial = initial
  const placeholder = opts.placeholder ?? ''

  const screen = await render(
    createElement(Harness, {
      initial: currentInitial,
      disabled: currentDisabled,
      placeholder,
      onEmit,
    }),
  )

  // Let the Editor's initial mount emission flow settle before the test reads.
  await tick()
  await tick()

  return {
    getEmitted: () => lastEmitted,
    setContent: async (html) => {
      currentInitial = html
      await screen.rerender(
        createElement(Harness, {
          initial: currentInitial,
          disabled: currentDisabled,
          placeholder,
          onEmit,
        }),
      )
      await tick()
      await tick()
    },
    setDisabled: async (disabled) => {
      currentDisabled = disabled
      await screen.rerender(
        createElement(Harness, {
          initial: currentInitial,
          disabled: currentDisabled,
          placeholder,
          onEmit,
        }),
      )
      await tick()
      await tick()
    },
    unmount: () => {
      void screen.unmount()
    },
  }
}
