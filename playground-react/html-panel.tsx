export function HtmlPanel({ html }: { html: string }) {
  return (
    <section className="demo-section">
      <h2 className="section-title">
        HTML output <span className="hint">(value prop)</span>
      </h2>
      <pre className="html-output">{html}</pre>
    </section>
  )
}
