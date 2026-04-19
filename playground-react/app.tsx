import { useState } from 'react'
import { EddyEditor } from 'eddy-editor/react'
import { HtmlPanel } from './html-panel'
import { AstPanel } from './ast-panel'

export function App() {
  const [content, setContent] = useState(
    '<p>Welcome to the <strong>Eddy</strong> editor playground (React). Try formatting this text!</p>',
  )
  const [isDisabled, setIsDisabled] = useState(false)

  return (
    <div className="playground">
      <header className="playground-header">
        <h1>Eddy Editor — React Playground</h1>
      </header>

      <main className="playground-main">
        <section className="demo-section">
          <h2 className="section-title">Editor</h2>
          <EddyEditor value={content} onChange={setContent} disabled={isDisabled} />
          <label className="disabled-toggle">
            <input
              type="checkbox"
              checked={isDisabled}
              onChange={(e) => setIsDisabled(e.target.checked)}
            />
            Disabled
          </label>
        </section>

        <HtmlPanel html={content} />
        <AstPanel html={content} />
      </main>

      <style>{`
        .playground {
          max-width: 860px;
          margin: 0 auto;
          padding: 2rem 1.5rem 4rem;
        }
        .playground-header { margin-bottom: 2rem; }
        .playground-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
        .playground-main { display: flex; flex-direction: column; gap: 2rem; }
        .demo-section { display: flex; flex-direction: column; gap: 0.75rem; }
        .section-title {
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          margin: 0;
        }
        .hint { font-weight: 400; text-transform: none; letter-spacing: 0; }
        .html-output,
        .ast-output {
          background: #1e1e2e;
          color: #cdd6f4;
          padding: 1rem;
          border-radius: 0.375rem;
          font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
          min-height: 3rem;
        }
        .ast-document { color: #6c7086; }
        .ast-block { color: #89b4fa; }
        .ast-inline { color: #a6e3a1; }
        .ast-mark { color: #fab387; }
        .ast-text { color: #cdd6f4; }
        .ast-prop { color: #cba6f7; }
        .ast-id { color: #94e2d5; font-size: 0.75rem; }
      `}</style>
    </div>
  )
}
