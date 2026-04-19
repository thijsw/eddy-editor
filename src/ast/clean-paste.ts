/**
 * Pure HTML→HTML cleanup pass for pasted clipboard content. The existing
 * `parseHTML` already whitelists tags and silently drops unknown attributes,
 * but pasted HTML from Office/Google Docs arrives with large volumes of
 * invisible markup (empty paragraphs, `<o:p>`, classed wrappers) — cleaning
 * it here keeps the AST lean and the emitted HTML predictable.
 *
 * Everything in this module is pure: it parses into a detached DOMParser
 * document and returns a string, never touching the live editor.
 *
 * Policy is allowlist-first:
 * - Tags in ALLOWED_TAGS are kept; their attributes are stripped except
 *   `href` on `<a>`.
 * - Tags in DROP_TAGS are removed along with their subtree (scripts and
 *   similar metadata — unwrapping them would leak code-as-text).
 * - Any other tag is *unwrapped* — children float up one level and the
 *   wrapper vanishes. This handles `<o:p>`, `<font>`, `<section>`, and any
 *   future Office/GDocs oddity without maintaining a growing denylist.
 * - Comments are always removed (HTML comments including MS conditional
 *   comments — whose nested markup is comment text to any modern parser).
 */

const ALLOWED_TAGS = new Set([
  // Block tags recognised by parseHTML
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  // Inline mark tags recognised by parseHTML
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'code',
  // Inline passthroughs
  'a',
  'span',
  'br',
])

const DROP_TAGS = new Set([
  'script',
  'style',
  'meta',
  'link',
  'title',
  'head',
  'iframe',
  'object',
  'embed',
  'noscript',
  'xml',
])

export function cleanPastedHTML(html: string): string {
  if (typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const body = doc.body
  if (!body) return ''

  walk(body)
  return body.innerHTML
}

function walk(node: Node): void {
  // Snapshot children before walking since mutations invalidate a live list.
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.parentNode?.removeChild(child)
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const el = child as Element
    const tag = el.tagName.toLowerCase()

    if (DROP_TAGS.has(tag)) {
      el.remove()
      continue
    }

    if (!ALLOWED_TAGS.has(tag)) {
      walk(el)
      unwrap(el)
      continue
    }

    stripAttributes(el)
    walk(el)

    if (isDiscardableEmpty(el)) el.remove()
  }
}

function stripAttributes(el: Element): void {
  const tag = el.tagName.toLowerCase()
  for (const attr of [...el.attributes]) {
    const keep = tag === 'a' && attr.name === 'href'
    if (!keep) el.removeAttribute(attr.name)
  }
}

function isDiscardableEmpty(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  if (tag !== 'p' && tag !== 'div') return false
  // Strip NBSP/whitespace; a `<p>&nbsp;</p>` Word spacer has no
  // author-meaningful content and otherwise becomes a stray empty paragraph.
  const text = (el.textContent ?? '').replace(/[\s\u00A0]+/g, '')
  return text === '' && el.querySelector('br, img') === null
}

function unwrap(el: Element): void {
  const parent = el.parentNode
  if (!parent) return
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}
