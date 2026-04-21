export { EddyEditor, type EddyEditorProps, type ToolbarSlotProps } from './eddy-editor'
export { EddyToolbar, type EddyToolbarProps } from './eddy-toolbar'
export { useEditorState } from './use-editor-state'
export * from '../index'
// Shadow the core's `defaultPlugins` (and individual plugin exports) with
// versions whose toolbar items carry React-specific Lucide icons. Unused
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
