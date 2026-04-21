import { Fragment, useMemo, type ReactNode } from 'react'
import { parseHTML } from 'eddy-editor'
import type { DocumentNode, BlockNode, InlineNode, Mark } from 'eddy-editor'

type TreeNode = DocumentNode | BlockNode | InlineNode

function indent(depth: number): string {
  return '  '.repeat(depth)
}

function formatAttrs(attrs: Record<string, unknown>): string {
  const entries = Object.entries(attrs)
  if (entries.length === 0) return ''
  return entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
}

function renderNode(node: TreeNode, depth: number, key: string): ReactNode {
  if ('blocks' in node) {
    const docNode = node as DocumentNode
    return (
      <Fragment key={key}>
        <span className="ast-document">
          {indent(depth)}document{'\n'}
        </span>
        {docNode.blocks.map((b, i) => renderNode(b, depth + 1, `${key}/${i}`))}
      </Fragment>
    )
  }
  if (node.type === 'text') {
    const textNode = node as Extract<InlineNode, { type: 'text' }>
    const markStr =
      textNode.marks.length > 0 ? textNode.marks.map((m: Mark) => m.type).join(', ') : null
    return (
      <Fragment key={key}>
        <span className="ast-inline">{indent(depth)}text </span>
        {markStr != null ? (
          <>
            <span className="ast-mark">[{markStr}]</span>{' '}
          </>
        ) : null}
        <span className="ast-text">"{textNode.text}"</span>
        {'\n'}
      </Fragment>
    )
  }
  if (node.type === 'hardBreak') {
    return (
      <Fragment key={key}>
        <span className="ast-inline">
          {indent(depth)}hardBreak{'\n'}
        </span>
      </Fragment>
    )
  }
  const block = node as BlockNode
  const attrStr = formatAttrs(block.attrs)
  return (
    <Fragment key={key}>
      <span className="ast-block">
        {indent(depth)}
        {block.type}{' '}
      </span>
      {attrStr ? (
        <>
          <span className="ast-prop">{attrStr}</span>{' '}
        </>
      ) : null}
      <span className="ast-id">id={block.id}</span>
      {'\n'}
      {block.children.map((c, i) => renderNode(c, depth + 1, `${key}/${i}`))}
    </Fragment>
  )
}

export function AstPanel({ html }: { html: string }) {
  const doc = useMemo(() => parseHTML(html), [html])
  return (
    <section className="demo-section">
      <h2 className="section-title">
        AST <span className="hint">(document tree)</span>
      </h2>
      <pre className="ast-output">{renderNode(doc, 0, 'root')}</pre>
    </section>
  )
}
