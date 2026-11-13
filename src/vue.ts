import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  watchEffect,
  type PropType,
  type Ref,
  type SlotsType,
} from 'vue'
import { createEditor } from './editor'
import { mountToolbar } from './toolbar'
import type { Editor, Plugin } from './types'

export const EddyToolbar = defineComponent({
  name: 'EddyToolbar',
  props: { editor: Object as PropType<Editor | null> },
  setup(props) {
    const host = shallowRef<HTMLElement>()
    watchEffect((cleanup) => {
      if (props.editor && host.value) cleanup(mountToolbar(host.value, props.editor))
    })
    return () => h('div', { ref: host, class: 'eddy-toolbar', role: 'toolbar' })
  },
})

export const EddyEditor = defineComponent({
  name: 'EddyEditor',
  props: {
    modelValue: { type: String, default: '' },
    /** The complete plugin list, e.g. `defaultPlugins`. Read once on mount. */
    plugins: { type: Array as PropType<readonly Plugin[]>, default: () => [] },
    disabled: Boolean,
    placeholder: String,
  },
  emits: { 'update:modelValue': (_: string) => true },
  slots: Object as SlotsType<{ toolbar: { editor: Editor | null } }>,
  setup(props, { emit, slots, expose }) {
    const el = shallowRef<HTMLElement>()
    const editor = shallowRef<Editor | null>(null)
    const initial = props.modelValue // SSR markup; the editor takes over on mount

    onMounted(() => {
      const ed = createEditor(el.value!, {
        plugins: props.plugins,
        content: props.modelValue,
        onChange: (v) => emit('update:modelValue', v),
      })
      ed.editable = !props.disabled
      editor.value = ed
    })
    onBeforeUnmount(() => editor.value?.destroy())
    watch(
      () => props.modelValue,
      (v) => {
        if (editor.value && v != editor.value.getHTML()) editor.value.setHTML(v)
      },
    )
    watch(
      () => props.disabled,
      (d) => {
        if (editor.value) editor.value.editable = !d
      },
    )
    expose({ editor })

    return () =>
      h('div', { class: 'eddy-wrapper' }, [
        slots.toolbar
          ? slots.toolbar({ editor: editor.value })
          : h(EddyToolbar, { editor: editor.value }),
        h('div', {
          ref: el,
          class: 'eddy-editor',
          'data-placeholder': props.placeholder || null,
          innerHTML: initial,
        }),
      ])
  },
})

/**
 * Reactive editor state for custom toolbars:
 * `const bold = useEditorState(editor, (ed) => 'bold' in ed.getMarks())`
 */
export function useEditorState<T>(
  editor: Readonly<Ref<Editor | null | undefined>>,
  select: (ed: Editor) => T,
): Readonly<Ref<T | undefined>> {
  const value = shallowRef<T>()
  watchEffect((cleanup) => {
    const ed = editor.value
    if (!ed) return
    const update = () => (value.value = select(ed))
    update()
    cleanup(ed.subscribe(update))
  })
  return value
}
