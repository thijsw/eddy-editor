import { useEffect, useState } from 'react'
import { EddyEditor } from '../../src/react/index'
import { defaultPlugins } from '../../src/plugins/index'

export interface HarnessProps {
  initial: string
  disabled?: boolean
  placeholder?: string
  onEmit: (html: string) => void
}

export function Harness({ initial, disabled, placeholder, onEmit }: HarnessProps) {
  const [content, setContent] = useState(initial)

  useEffect(() => {
    setContent(initial)
  }, [initial])

  function onUpdate(v: string) {
    setContent(v)
    onEmit(v)
  }

  return (
    <EddyEditor
      value={content}
      onChange={onUpdate}
      plugins={defaultPlugins}
      disabled={disabled ?? false}
      placeholder={placeholder ?? ''}
    />
  )
}
