import type { EddyPlugin } from '../types'
import type { MarkSpec } from '../ast/schema'
import { blockRangeIdx, mapBlocksInRange, applyMarkToBlock } from '../ast/commands'
import type { ASTPosition, ASTSelection } from '../ast/selection'
import { blockIndexOf, isCollapsed } from '../ast/selection'
import type { DocumentNode, InlineNode, TextNode } from '../ast/types'

const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

/**
 * Returns a safe href string, or null if the URL is empty or uses a
 * disallowed scheme. Accepts absolute URLs with http/https/mailto/tel,
 * protocol-relative URLs, relative paths, and fragment links.
 *
 * Rejects javascript:, data:, vbscript:, and any string containing control
 * characters — these are the vectors for XSS via anchor hrefs.
 */
export function sanitizeHref(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase() + ':'
    return ALLOWED_SCHEMES.includes(scheme) ? trimmed : null
  }
  return trimmed
}

const linkSpec: MarkSpec = {
  type: 'link',
  parseDOM: [
    {
      tag: 'a',
      // Reject the entire anchor when the href fails sanitisation — the
      // parser unwraps it and keeps the text without any link mark.
      getAttrs: (el) => {
        const href = sanitizeHref(el.getAttribute('href'))
        return href === null ? false : { href }
      },
    },
  ],
  attrs: {
    href: {
      validate: (value) => (typeof value === 'string' ? sanitizeHref(value) : null),
    },
  },
  toDOM: (mark) => ['a', { href: String(mark.attrs?.href ?? '') }],
}

/** Expand a collapsed cursor inside a link to cover the entire link range. */
function linkRangeAt(doc: DocumentNode, pos: ASTPosition): ASTSelection | null {
  const block = doc.blocks[blockIndexOf(doc).get(pos.blockId) ?? -1]
  if (!block) return null
  const node = block.children[pos.inlineIndex]
  if (node?.type !== 'text') return null
  const href = node.marks.find((m) => m.type === 'link')?.attrs?.href
  if (href === undefined) return null

  const sameLink = (n: InlineNode): boolean =>
    n.type === 'text' && n.marks.some((m) => m.type === 'link' && m.attrs?.href === href)

  let startI = pos.inlineIndex
  while (startI > 0 && sameLink(block.children[startI - 1])) startI--
  let endI = pos.inlineIndex
  while (endI < block.children.length - 1 && sameLink(block.children[endI + 1])) endI++

  const endNode = block.children[endI] as TextNode
  return {
    anchor: { blockId: pos.blockId, inlineIndex: startI, offset: 0 },
    head: { blockId: pos.blockId, inlineIndex: endI, offset: endNode.text.length },
  }
}

function setLink(doc: DocumentNode, sel: ASTSelection, href: string) {
  const safe = sanitizeHref(href)
  if (safe === null) return { doc, selection: sel }
  const effective = isCollapsed(sel) ? (linkRangeAt(doc, sel.anchor) ?? sel) : sel
  if (isCollapsed(effective)) return { doc, selection: sel }

  const [start, end, startIdx, endIdx] = blockRangeIdx(doc, effective)
  const newDoc = mapBlocksInRange(doc, startIdx, endIdx, (block) =>
    applyMarkToBlock(block, start, end, 'link', false, { href: safe }),
  )
  return { doc: newDoc, selection: sel }
}

function removeLink(doc: DocumentNode, sel: ASTSelection) {
  const effective = isCollapsed(sel) ? (linkRangeAt(doc, sel.anchor) ?? sel) : sel
  if (isCollapsed(effective)) return { doc, selection: sel }

  const [start, end, startIdx, endIdx] = blockRangeIdx(doc, effective)
  const newDoc = mapBlocksInRange(doc, startIdx, endIdx, (block) =>
    applyMarkToBlock(block, start, end, 'link', true),
  )
  return { doc: newDoc, selection: sel }
}

export const link: EddyPlugin = {
  name: 'link',
  marks: [linkSpec],
  commands: {
    'link.set': (api, href) => {
      if (typeof href !== 'string') return
      api.tr.apply((doc, sel) => setLink(doc, sel, href))
    },
    'link.remove': (api) => {
      api.tr.apply((doc, sel) => removeLink(doc, sel))
    },
    'link.prompt': (api) => {
      if (typeof window === 'undefined') return
      const current = api.getMarkAt('link')
      const currentHref = typeof current?.attrs?.href === 'string' ? current.attrs.href : null
      const input = window.prompt(currentHref ? 'Edit link URL' : 'Link URL', currentHref ?? '')
      if (input === null) return
      const trimmed = input.trim()
      if (trimmed === '') {
        if (currentHref !== null) api.run('link.remove')
        return
      }
      api.run('link.set', trimmed)
    },
  },
  keybindings: { 'mod+k': 'link.prompt' },
  toolbar: [
    {
      command: 'link.prompt',
      label: '🔗',
      title: 'Link (Mod+K)',
      isActive: (api) => api.isMarkActive('link'),
    },
  ],
}
