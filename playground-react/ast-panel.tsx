import { Fragment, useMemo, type ReactNode } from 'react'
import { parseHTML } from 'eddy-editor'
import type { DocumentNode, BlockNode, InlineNode, ListItemNode, Mark } from 'eddy-editor'

type TreeNode = DocumentNode | BlockNode | InlineNode | ListItemNode

function indent(depth: number): string {
  return '  '.repeat(depth)
}

function renderNode(node: TreeNode, depth: number, key: string): ReactNode {
  if (node.type === 'document') {
    return (
      <Fragment key={key}>
        <span className="ast-document">{indent(depth)}document{'\n'}</span>
        {node.blocks.map((b, i) => renderNode(b, depth + 1, `${key}/${i}`))}
      </Fragment>
    )
  }
  if (node.type === 'paragraph') {
    return (
      <Fragment key={key}>
        <span className="ast-block">{indent(depth)}paragraph </span>
        <span className="ast-id">id={node.id}</span>
        {'\n'}
        {node.children.map((c, i) => renderNode(c, depth + 1, `${key}/${i}`))}
      </Fragment>
    )
  }
  if (node.type === 'heading') {
    return (
      <Fragment key={key}>
        <span className="ast-block">{indent(depth)}heading </span>
        <span className="ast-prop">level={node.level}</span>{' '}
        <span className="ast-id">id={node.id}</span>
        {'\n'}
        {node.children.map((c, i) => renderNode(c, depth + 1, `${key}/${i}`))}
      </Fragment>
    )
  }
  if (node.type === 'listItem') {
    return (
      <Fragment key={key}>
        <span className="ast-block">{indent(depth)}listItem </span>
        <span className="ast-prop">
          ordered={String(node.ordered)} indent={node.indent}
        </span>{' '}
        <span className="ast-id">id={node.id}</span>
        {'\n'}
        {node.children.map((c, i) => renderNode(c, depth + 1, `${key}/${i}`))}
      </Fragment>
    )
  }
  if (node.type === 'text') {
    const markStr = node.marks.length > 0 ? node.marks.map((m: Mark) => m.type).join(', ') : null
    return (
      <Fragment key={key}>
        <span className="ast-inline">{indent(depth)}text </span>
        {markStr != null ? (
          <>
            <span className="ast-mark">[{markStr}]</span>{' '}
          </>
        ) : null}
        <span className="ast-text">"{node.text}"</span>
        {'\n'}
      </Fragment>
    )
  }
  if (node.type === 'hardBreak') {
    return (
      <Fragment key={key}>
        <span className="ast-inline">{indent(depth)}hardBreak{'\n'}</span>
      </Fragment>
    )
  }
  return null
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
