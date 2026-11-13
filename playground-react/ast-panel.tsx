import { Fragment, useMemo } from 'react'
import { createSchema, defaultPlugins, parse, type Block, type TextNode } from 'eddy-editor'

const schema = createSchema(defaultPlugins)

const attrs = (b: Block) =>
  Object.entries(b.attrs)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ')
const marks = (t: TextNode) =>
  Object.entries(t.marks)
    .map(([k, v]) => (Object.keys(v).length ? `${k} ${JSON.stringify(v)}` : k))
    .join(', ')

export function AstPanel({ html }: { html: string }) {
  const doc = useMemo(() => parse(html, schema), [html])
  return (
    <section className="demo-section">
      <h2 className="section-title">
        Document <span className="hint">(blocks and text runs)</span>
      </h2>
      <pre className="ast-output">
        {doc.map((b) => (
          <Fragment key={b.id}>
            <span className="ast-block">{b.type}</span>{' '}
            {attrs(b) && <span className="ast-prop">{attrs(b)} </span>}
            <span className="ast-id">id={b.id}</span>
            {'\n'}
            {b.children.map((t, i) => (
              <Fragment key={i}>
                {'  '}
                {marks(t) && <span className="ast-mark">[{marks(t)}] </span>}
                <span className="ast-text">{JSON.stringify(t.text)}</span>
                {'\n'}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </pre>
    </section>
  )
}
