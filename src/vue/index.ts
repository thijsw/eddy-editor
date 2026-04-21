export { default as EddyEditor } from './eddy-editor.vue'
export { default as EddyToolbar } from './eddy-toolbar.vue'
export { useEditorState } from './use-editor-state'
export * from '../index'
// Shadow the core's `defaultPlugins` (and individual plugin exports) with
// versions whose toolbar items carry Vue-specific Lucide icons. Unused
// plugins tree-shake along with their icons.
export {
  defaultPlugins,
  bold,
  italic,
  underline,
  strikethrough,
  code,
  link,
  list,
} from './default-plugins'
