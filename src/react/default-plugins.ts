import type { ComponentType } from 'react'
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Code as CodeIcon,
  Link as LinkIcon,
  List as ListIcon,
  ListOrdered as ListOrderedIcon,
} from 'lucide-react'
import type { EddyPlugin } from '../types'
import {
  safePaste,
  core,
  bold as boldBase,
  italic as italicBase,
  underline as underlineBase,
  strikethrough as strikethroughBase,
  code as codeBase,
  link as linkBase,
  heading,
  list as listBase,
} from '../plugins/index'

type IconComponent = ComponentType<{ size?: number }>

/**
 * Framework-decorated versions of the built-in plugins. Each plugin's
 * `ToolbarItem`s have their React-specific Lucide icons attached here so
 * that the toolbar stays framework-agnostic and unused plugin icons
 * tree-shake out of the consumer bundle.
 */
function withIcon(plugin: EddyPlugin, iconByCommand: Record<string, IconComponent>): EddyPlugin {
  if (!plugin.toolbar) return plugin
  return {
    ...plugin,
    toolbar: plugin.toolbar.map((t) =>
      iconByCommand[t.command] ? { ...t, icon: iconByCommand[t.command] } : t,
    ),
  }
}

// `/*@__PURE__*/` annotations let bundlers drop an unused decoration along
// with its icon import — without them, every decoration call is treated as
// side-effecting and all icons stay in the consumer bundle.
export const bold = /*@__PURE__*/ withIcon(boldBase, { 'bold.toggle': BoldIcon })
export const italic = /*@__PURE__*/ withIcon(italicBase, { 'italic.toggle': ItalicIcon })
export const underline = /*@__PURE__*/ withIcon(underlineBase, {
  'underline.toggle': UnderlineIcon,
})
export const strikethrough = /*@__PURE__*/ withIcon(strikethroughBase, {
  'strikethrough.toggle': StrikethroughIcon,
})
export const code = /*@__PURE__*/ withIcon(codeBase, { 'code.toggle': CodeIcon })
export const link = /*@__PURE__*/ withIcon(linkBase, { 'link.prompt': LinkIcon })
export const list = /*@__PURE__*/ withIcon(listBase, {
  'list.toggleUnordered': ListIcon,
  'list.toggleOrdered': ListOrderedIcon,
})

export const defaultPlugins: EddyPlugin[] = [
  safePaste,
  core,
  bold,
  italic,
  underline,
  strikethrough,
  code,
  link,
  heading,
  list,
]
