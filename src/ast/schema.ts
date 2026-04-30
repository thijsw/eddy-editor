import type { BlockNode, DocumentNode, InlineNode, Mark, TextNode } from './types'
import { emptyText, emptyParagraph, withChildren } from './types'

export interface AttrSpec {
  /**
   * Fallback value used when `parseHTML` / `validate` returns nullish. If the
   * attribute has no default and the parsed value is nullish, the attr is
   * simply omitted from the result — the surrounding mark/block is still
   * created. To reject an entire node based on attribute state, use a
   * `ParseRule.getAttrs` that returns `false` instead.
   */
  default?: unknown
  /** Extract the raw value from the DOM element. */
  parseHTML?(el: Element): unknown
  /**
   * Validate / sanitise an incoming value (from `parseHTML` or programmatic
   * callers). Return the validated value, or `null`/`undefined` to indicate
   * "no acceptable value" (fall back to `default`, or omit the attr).
   */
  validate?(value: unknown): unknown
}

/**
 * A DOM rendering shape. Supports nested wrappers:
 *
 * - `['strong']` → `<strong>{inner}</strong>`
 * - `['a', { href: '/x' }]` → `<a href="/x">{inner}</a>`
 * - `['pre', ['code', 0]]` → `<pre><code>{inner}</code></pre>`
 *
 * Elements after an optional attrs object are interpreted as children: `0`
 * is a content hole (where inner HTML is spliced), and a nested array is
 * another `DOMOutput`. When no explicit children are given the entire tag
 * wraps the inner content.
 */
export type DOMChild = 0 | DOMOutput
export interface DOMOutput extends ReadonlyArray<string | Record<string, string> | DOMChild> {
  readonly 0: string
}

/**
 * Parse rule matching a single DOM element by tag name.
 *
 * `getAttrs` runs when the parser considers this rule. Its return value
 * decides:
 *
 * - An object → use these as the node's attrs (bypasses `spec.attrs`).
 * - `null` / `undefined` → accept the rule; attrs come from `spec.attrs`.
 * - `false` → skip this rule; the parser tries the next matching rule.
 *
 * `false` is the canonical way to reject a node based on attribute state —
 * e.g. an `<a href="javascript:...">` whose href fails sanitisation.
 */
export interface ParseRule {
  tag: string
  getAttrs?(el: Element): Record<string, unknown> | null | false | void
}

export interface MarkSpec {
  type: string
  parseDOM: ReadonlyArray<ParseRule>
  toDOM(mark: Mark): DOMOutput
  attrs?: Record<string, AttrSpec>
  /**
   * Mark types that cannot coexist with this one on the same text. When this
   * mark is applied, any marks listed here are removed from the range.
   */
  excludes?: ReadonlyArray<string>
}

export interface BlockSpec {
  type: string
  parseDOM: ReadonlyArray<ParseRule>
  toDOM(block: BlockNode): DOMOutput
  attrs?: Record<string, AttrSpec>
  group?: BlockGroupSpec
  /**
   * Atom (leaf) block — rendered entirely by `toDOM`; the AST inline children
   * are ignored visually. The renderer preserves the live DOM element across
   * structural edits (so embedded media like iframes don't reload when the
   * user adds an unrelated paragraph) and replaces the outer element wholesale
   * when the block's own attrs change.
   *
   * The block still occupies a single cursor slot; selection lands at the
   * block boundary. Plugins typically pair an atom block with a `keydown`
   * handler that deletes it on Backspace from the following block.
   */
  atom?: boolean
}

export interface BlockGroupSpec {
  containerTags: string[]
  parseContainer(el: Element): Record<string, unknown>
  containerTag(block: BlockNode): string
  depth(block: BlockNode): number
}

/**
 * Baseline paragraph spec. Always present in every Schema — consumers who
 * want different paragraph semantics override it by contributing a BlockSpec
 * with `type: 'paragraph'`.
 */
const defaultParagraphSpec: BlockSpec = {
  type: 'paragraph',
  parseDOM: [{ tag: 'p' }, { tag: 'div' }],
  toDOM: () => ['p'],
}

/** A MarkSpec (or BlockSpec) paired with one of its parseDOM rules. */
interface MarkMatch {
  spec: MarkSpec
  rule: ParseRule
}
interface BlockMatch {
  spec: BlockSpec
  rule: ParseRule
}

export class Schema {
  readonly marks: ReadonlyMap<string, MarkSpec>
  readonly blocks: ReadonlyMap<string, BlockSpec>
  readonly markOrder: ReadonlyArray<string>
  private readonly _markRulesByTag: Map<string, MarkMatch[]>
  private readonly _blockRulesByTag: Map<string, BlockMatch[]>
  private readonly _blockByContainerTag: Map<string, BlockSpec>

  constructor(markSpecs: MarkSpec[], blockSpecs: BlockSpec[]) {
    // Last-wins dedup: if two specs share a type, the later one overrides the
    // earlier, but the canonical position (mark nesting order, block order) is
    // fixed by the first declaration. Consistent with the plugins/commands/
    // keybindings registration rule (later plugin wins).
    const dedupedMarks = dedupByType(markSpecs)
    const dedupedBlocks = dedupByType(
      blockSpecs.some((s) => s.type === 'paragraph')
        ? blockSpecs
        : [defaultParagraphSpec, ...blockSpecs],
    )

    const marks = new Map<string, MarkSpec>()
    const order: string[] = []
    this._markRulesByTag = new Map()
    for (const spec of dedupedMarks) {
      marks.set(spec.type, spec)
      order.push(spec.type)
      for (const rule of spec.parseDOM) {
        const tag = rule.tag.toLowerCase()
        const list = this._markRulesByTag.get(tag) ?? []
        list.push({ spec, rule })
        this._markRulesByTag.set(tag, list)
      }
    }
    this.marks = marks
    this.markOrder = order

    const blocks = new Map<string, BlockSpec>()
    this._blockRulesByTag = new Map()
    this._blockByContainerTag = new Map()
    for (const spec of dedupedBlocks) {
      blocks.set(spec.type, spec)
      for (const rule of spec.parseDOM) {
        const tag = rule.tag.toLowerCase()
        const list = this._blockRulesByTag.get(tag) ?? []
        list.push({ spec, rule })
        this._blockRulesByTag.set(tag, list)
      }
      if (spec.group) {
        for (const tag of spec.group.containerTags) {
          this._blockByContainerTag.set(tag.toLowerCase(), spec)
        }
      }
    }
    this.blocks = blocks
  }

  /** All mark rules registered for the given tag, in declaration order. */
  markRulesForTag(tag: string): ReadonlyArray<MarkMatch> {
    return this._markRulesByTag.get(tag.toLowerCase()) ?? []
  }

  /** All block rules registered for the given tag, in declaration order. */
  blockRulesForTag(tag: string): ReadonlyArray<BlockMatch> {
    return this._blockRulesByTag.get(tag.toLowerCase()) ?? []
  }

  /** True if any mark rule claims this tag (used by the inline-like detector). */
  hasMarkRuleForTag(tag: string): boolean {
    return this._markRulesByTag.has(tag.toLowerCase())
  }

  blockFromContainerTag(tag: string): BlockSpec | undefined {
    return this._blockByContainerTag.get(tag.toLowerCase())
  }

  /**
   * Parse an element into attrs for the given mark spec, merging any attrs
   * returned by the matched parseDOM rule's `getAttrs`. Missing values fall
   * back to `AttrSpec.default`; invalid values are omitted. Never rejects
   * the whole node — use `ParseRule.getAttrs` returning `false` for that.
   */
  parseMarkAttrs(
    spec: MarkSpec,
    el: Element,
    ruleAttrs?: Record<string, unknown>,
  ): Record<string, unknown> {
    return parseAttrs(spec.attrs, el, ruleAttrs)
  }

  parseBlockAttrs(
    spec: BlockSpec,
    el: Element,
    inherited?: Record<string, unknown>,
    ruleAttrs?: Record<string, unknown>,
  ): Record<string, unknown> {
    return parseAttrs(spec.attrs, el, ruleAttrs, inherited)
  }
}

function parseAttrs(
  attrSpecs: Record<string, AttrSpec> | undefined,
  el: Element,
  ruleAttrs?: Record<string, unknown>,
  inherited?: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = inherited ? { ...inherited } : {}
  if (ruleAttrs) Object.assign(result, ruleAttrs)
  if (!attrSpecs) return result
  for (const [key, attrSpec] of Object.entries(attrSpecs)) {
    if (key in result) continue
    const raw = attrSpec.parseHTML ? attrSpec.parseHTML(el) : attrSpec.default
    const value = attrSpec.validate ? attrSpec.validate(raw) : raw
    if (value !== null && value !== undefined) result[key] = value
    else if (attrSpec.default !== undefined) result[key] = attrSpec.default
  }
  return result
}

// ── Normalisation rules ───────────────────────────────────────────────────────

export type SchemaRule = (doc: DocumentNode) => DocumentNode

export function applySchema(doc: DocumentNode, rules: SchemaRule[]): DocumentNode {
  return rules.reduce((d, rule) => rule(d), doc)
}

export function normalizeSiblingText(doc: DocumentNode): DocumentNode {
  return mapBlocks(doc, (block) => {
    const merged = mergeAdjacentTextNodes(block.children)
    return merged === block.children ? block : withChildren(block, merged)
  })
}

export function ensureNonEmptyBlocks(doc: DocumentNode): DocumentNode {
  if (doc.blocks.length === 0) return { type: 'document', blocks: [emptyParagraph()] }
  return mapBlocks(doc, (block) =>
    block.children.length === 0 ? withChildren(block, [emptyText()]) : block,
  )
}

export const defaultRules: SchemaRule[] = [normalizeSiblingText, ensureNonEmptyBlocks]

function dedupByType<T extends { type: string }>(specs: ReadonlyArray<T>): T[] {
  const result: T[] = []
  const positions = new Map<string, number>()
  for (const spec of specs) {
    const existing = positions.get(spec.type)
    if (existing !== undefined) {
      result[existing] = spec
    } else {
      positions.set(spec.type, result.length)
      result.push(spec)
    }
  }
  return result
}

function mapBlocks(doc: DocumentNode, fn: (block: BlockNode) => BlockNode): DocumentNode {
  let changed = false
  const blocks = doc.blocks.map((b) => {
    const next = fn(b)
    if (next !== b) changed = true
    return next
  })
  return changed ? { type: 'document', blocks } : doc
}

function mergeAdjacentTextNodes(nodes: InlineNode[]): InlineNode[] {
  const result: InlineNode[] = []
  let merged = false
  for (const node of nodes) {
    const last = result[result.length - 1] as TextNode | undefined
    if (node.type === 'text' && last?.type === 'text' && marksEqual(node.marks, last.marks)) {
      result[result.length - 1] = { type: 'text', text: last.text + node.text, marks: node.marks }
      merged = true
    } else {
      result.push(node)
    }
  }
  return merged ? result : nodes
}

export function marksEqual(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false
  return a.every((m) => b.some((n) => n.type === m.type && attrsEqual(m.attrs, n.attrs)))
}

export function attrsEqual(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  const ak = a ? Object.keys(a) : []
  const bk = b ? Object.keys(b) : []
  if (ak.length !== bk.length) return false
  return ak.every((k) => a![k] === b?.[k])
}
