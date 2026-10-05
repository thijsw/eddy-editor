import type { NuxtOptions } from '@nuxt/schema'
import { describe, expect, it } from 'vitest'
import { addTranspilePackages, TRANSPILE_PACKAGES } from '../../src/nuxt'

describe('eddy-editor/nuxt', () => {
  it('adds the editor and its icon package to build.transpile', () => {
    expect(addTranspilePackages([])).toEqual([...TRANSPILE_PACKAGES])
  })

  it('keeps existing entries and does not add duplicates', () => {
    const transpile: NuxtOptions['build']['transpile'] = ['@lucide/vue', /^@vueuse\//]

    addTranspilePackages(transpile)
    addTranspilePackages(transpile)

    expect(transpile).toEqual(['@lucide/vue', /^@vueuse\//, 'eddy-editor'])
  })
})
