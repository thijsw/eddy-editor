import { test, expect, type Page } from '@playwright/test'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get the current v-model HTML from the output panel */
async function getOutput(page: Page): Promise<string> {
  return (await page.locator('pre.html-output').first().textContent()) ?? ''
}

/** Click into the editor and select all existing content */
async function selectAll(page: Page) {
  const editor = page.locator('.eddy-editor').first()
  await editor.click()
  await page.keyboard.press('Meta+A')
}

/** Clear the editor and type fresh content */
async function clearAndType(page: Page, text: string) {
  await selectAll(page)
  await page.keyboard.press('Delete')
  await page.keyboard.type(text)
}

/**
 * Select a specific string within the editor using the Selection API.
 * More reliable than double-click for targeting words in known text.
 */
async function selectInEditor(page: Page, text: string) {
  await page
    .locator('.eddy-editor')
    .first()
    .evaluate((el, searchText) => {
      function findText(node: Node, str: string): { node: Text; offset: number } | null {
        if (node.nodeType === Node.TEXT_NODE) {
          const idx = (node.textContent ?? '').indexOf(str)
          if (idx !== -1) return { node: node as Text, offset: idx }
        }
        for (const child of Array.from(node.childNodes)) {
          const r = findText(child, str)
          if (r) return r
        }
        return null
      }
      const found = findText(el, searchText)
      if (!found) return
      const range = document.createRange()
      range.setStart(found.node, found.offset)
      range.setEnd(found.node, found.offset + searchText.length)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      el.focus()
    }, text)
}

/**
 * Place the cursor inside a specific text node (collapsed selection),
 * which triggers selectionchange so the toolbar updates.
 */
async function placeCursorIn(page: Page, text: string) {
  await page
    .locator('.eddy-editor')
    .first()
    .evaluate((el, searchText) => {
      function findText(node: Node, str: string): { node: Text; offset: number } | null {
        if (node.nodeType === Node.TEXT_NODE) {
          const idx = (node.textContent ?? '').indexOf(str)
          if (idx !== -1) return { node: node as Text, offset: idx }
        }
        for (const child of Array.from(node.childNodes)) {
          const r = findText(child, str)
          if (r) return r
        }
        return null
      }
      const found = findText(el, searchText)
      if (!found) return
      const range = document.createRange()
      // Place cursor in the middle of the found text
      range.setStart(found.node, found.offset + Math.floor(searchText.length / 2))
      range.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      el.focus()
    }, text)
}

// Toolbar button selectors — titles include the keybinding hint
const BTN = {
  bold: 'button[title="Bold (Mod+B)"]',
  italic: 'button[title="Italic (Mod+I)"]',
  underline: 'button[title="Underline (Mod+U)"]',
  strikethrough: 'button[title="Strikethrough"]',
  ul: 'button[title="Bullet list"]',
  ol: 'button[title="Numbered list"]',
}

/** Select a heading level (or "paragraph") from the block type dropdown */
async function selectBlockType(page: Page, value: string) {
  await page.locator('.eddy-toolbar-select').selectOption(value)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// ── Toolbar formatting ────────────────────────────────────────────────────────

test('toolbar: bold button wraps selected text in bold tag', async ({ page }) => {
  await selectAll(page)
  await page.click(BTN.bold)
  const output = await getOutput(page)
  expect(output).toMatch(/<(b|strong)>/)
})

test('toolbar: bold button toggles off (aria-pressed reflects state)', async ({ page }) => {
  const boldBtn = page.locator(BTN.bold)

  // Select all and bold
  await selectAll(page)
  await boldBtn.click()
  await expect(boldBtn).toHaveAttribute('aria-pressed', 'true')

  // Click again to toggle off
  await selectAll(page)
  await boldBtn.click()
  await expect(boldBtn).toHaveAttribute('aria-pressed', 'false')
})

test('toolbar: italic button wraps selected text', async ({ page }) => {
  await selectAll(page)
  await page.click(BTN.italic)
  const output = await getOutput(page)
  expect(output).toMatch(/<(i|em)>/)
})

test('toolbar: underline button wraps selected text', async ({ page }) => {
  await selectAll(page)
  await page.click(BTN.underline)
  const output = await getOutput(page)
  expect(output).toMatch(/<u>/)
})

test('toolbar: strikethrough button wraps selected text', async ({ page }) => {
  await selectAll(page)
  await page.click(BTN.strikethrough)
  const output = await getOutput(page)
  expect(output).toMatch(/<(s|strike|del)>/)
})

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

test('keybinding: Mod+B applies bold', async ({ page }) => {
  await selectAll(page)
  await page.keyboard.press('Meta+B')
  const output = await getOutput(page)
  expect(output).toMatch(/<(b|strong)>/)
})

test('keybinding: Mod+I applies italic', async ({ page }) => {
  await selectAll(page)
  await page.keyboard.press('Meta+I')
  const output = await getOutput(page)
  expect(output).toMatch(/<(i|em)>/)
})

test('keybinding: Mod+U applies underline', async ({ page }) => {
  await selectAll(page)
  await page.keyboard.press('Meta+U')
  const output = await getOutput(page)
  expect(output).toMatch(/<u>/)
})

// ── Heading toggle ────────────────────────────────────────────────────────────

test('heading: select converts block to h1', async ({ page }) => {
  await clearAndType(page, 'My heading')
  await selectBlockType(page, 'h1')
  const output = await getOutput(page)
  expect(output).toMatch(/<h1[^>]*>/)
})

test('heading: select toggles off (h1 → p)', async ({ page }) => {
  await clearAndType(page, 'My heading')

  // Apply h1
  await selectBlockType(page, 'h1')
  let output = await getOutput(page)
  expect(output).toMatch(/<h1[^>]*>/)

  // Toggle off
  await selectBlockType(page, 'paragraph')
  output = await getOutput(page)
  expect(output).not.toContain('<h1>')
  expect(output).toContain('<p>')
})

test('heading: select reflects active state when cursor is in h1', async ({ page }) => {
  await clearAndType(page, 'My heading')
  await selectBlockType(page, 'h1')
  // The select should show "h1" as the current value
  const select = page.locator('.eddy-toolbar-select')
  await expect(select).toHaveValue('h1')
})

test('heading: H2-H6 via select work', async ({ page }) => {
  for (const level of [2, 3, 4, 5, 6]) {
    await clearAndType(page, `Heading ${level}`)
    await selectBlockType(page, `h${level}`)
    const output = await getOutput(page)
    expect(output).toContain(`<h${level}>`)
  }
})

// ── Lists ─────────────────────────────────────────────────────────────────────

test('list: unordered list button creates ul > li', async ({ page }) => {
  await clearAndType(page, 'List item')
  await page.click(BTN.ul)
  const output = await getOutput(page)
  expect(output).toContain('<ul>')
  expect(output).toMatch(/<li[^>]*>/)
  // <ul> must not be nested inside a <p> — invalid HTML
  expect(output).not.toMatch(/<p[^>]*>\s*<ul/)
})

test('list: ordered list button creates ol > li', async ({ page }) => {
  await clearAndType(page, 'List item')
  await page.click(BTN.ol)
  const output = await getOutput(page)
  expect(output).toContain('<ol>')
  expect(output).toMatch(/<li[^>]*>/)
  // <ol> must not be nested inside a <p> — invalid HTML
  expect(output).not.toMatch(/<p[^>]*>\s*<ol/)
})

test('list: unordered list toggles off', async ({ page }) => {
  await clearAndType(page, 'List item')
  await page.click(BTN.ul)
  await page.click(BTN.ul)
  const output = await getOutput(page)
  expect(output).not.toContain('<ul>')
})

// ── Style hygiene ─────────────────────────────────────────────────────────────

test('style hygiene: toggling unordered list off leaves no inline styles or bare spans', async ({
  page,
}) => {
  await clearAndType(page, 'Some text')
  await page.click(BTN.ul)
  await page.click(BTN.ul)
  const output = await getOutput(page)
  expect(output).not.toContain('style=')
  expect(output).not.toMatch(/<span>/)
})

test('style hygiene: toggling ordered list off leaves no inline styles or bare spans', async ({
  page,
}) => {
  await clearAndType(page, 'Some text')
  await page.click(BTN.ol)
  await page.click(BTN.ol)
  const output = await getOutput(page)
  expect(output).not.toContain('style=')
  expect(output).not.toMatch(/<span>/)
})

test('style hygiene: toggling list off with mixed content (bold inline) leaves no inline styles or bare spans', async ({
  page,
}) => {
  // Mirrors the reported bug: the playground's initial content contains <strong>Eddy</strong>
  // which caused Chromium to inject <span style="font-size: 16px"> when toggling the list off.
  await selectAll(page)
  await page.click(BTN.ul)
  await page.click(BTN.ul)
  const output = await getOutput(page)
  expect(output).not.toContain('style=')
  expect(output).not.toMatch(/<span>/)
})

// ── v-model sync ──────────────────────────────────────────────────────────────

test('v-model: typing updates the HTML output panel', async ({ page }) => {
  const editor = page.locator('.eddy-editor')
  await editor.click()
  await page.keyboard.press('Meta+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type('Hello world')
  const output = await getOutput(page)
  expect(output).toContain('Hello world')
})

test('v-model: output is canonical HTML (no internal data-block-id attributes)', async ({
  page,
}) => {
  const editor = page.locator('.eddy-editor')
  await editor.click()
  await page.keyboard.press('Meta+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type('Test content')

  const output = await getOutput(page)
  expect(output).not.toContain('data-block-id')
  expect(output.trim()).toBe('<p>Test content</p>')
})

// ── Empty editor ──────────────────────────────────────────────────────────────

test('empty editor: can type after clearing all content', async ({ page }) => {
  await selectAll(page)
  await page.keyboard.press('Delete')
  const editor = page.locator('.eddy-editor')
  await editor.click()
  await page.keyboard.type('Fresh start')
  const output = await getOutput(page)
  expect(output).toContain('Fresh start')
})

test('empty editor: formatting can be applied to newly typed text', async ({ page }) => {
  await selectAll(page)
  await page.keyboard.press('Delete')
  const editor = page.locator('.eddy-editor')
  await editor.click()
  await page.keyboard.type('Bold me')
  await selectAll(page)
  await page.click(BTN.bold)
  const output = await getOutput(page)
  expect(output).toMatch(/<(b|strong)>/)
})

// ── Shift+Enter ───────────────────────────────────────────────────────────────

test('Shift+Enter inserts a line break instead of a new block', async ({ page }) => {
  await clearAndType(page, 'Line one')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('Line two')
  const output = await getOutput(page)
  expect(output).toContain('<br>')
  // Both lines should be within a single block (no two separate <p> tags for this content)
  expect(output).toContain('Line one')
  expect(output).toContain('Line two')
})

test('Shift+Enter places cursor on the new line, not at start of editor', async ({ page }) => {
  await clearAndType(page, 'aa')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('bb')
  const output = await getOutput(page)
  // "bb" must appear after the <br>, not before "aa"
  expect(output).toMatch(/aa<br>bb/)
  // Everything in a single <p>
  expect(output).not.toMatch(/<p>.*<\/p>\s*<p>/)
})

test('multiple Shift+Enter inserts multiple line breaks', async ({ page }) => {
  await clearAndType(page, 'first')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('second')
  const output = await getOutput(page)
  expect(output).toMatch(/first<br><br>second/)
})

// ── Realistic user scenarios ──────────────────────────────────────────────────

test('realistic: bold one word within a sentence, leaving the rest plain', async ({ page }) => {
  await clearAndType(page, 'Hello world foo')
  await selectInEditor(page, 'world')
  await page.click(BTN.bold)
  const output = await getOutput(page)
  // "world" is wrapped in bold
  expect(output).toMatch(/<(b|strong)>world<\/(b|strong)>/)
  // Text outside the bold tag contains the other words
  expect(output).toContain('Hello ')
  expect(output).toContain(' foo')
})

test('realistic: toolbar bold state tracks cursor moving between formatted and plain text', async ({
  page,
}) => {
  const boldBtn = page.locator(BTN.bold)
  await clearAndType(page, 'Hello world')
  await selectInEditor(page, 'Hello')
  await page.click(BTN.bold)

  // Cursor inside "world" (non-bold) — bold button should be inactive
  await placeCursorIn(page, 'world')
  await expect(boldBtn).toHaveAttribute('aria-pressed', 'false')

  // Cursor inside "Hello" (bold) — bold button should be active
  await placeCursorIn(page, 'Hello')
  await expect(boldBtn).toHaveAttribute('aria-pressed', 'true')
})

test('realistic: build a document — heading then multiple paragraphs via Enter', async ({
  page,
}) => {
  await clearAndType(page, 'Introduction')
  await selectBlockType(page, 'h1')
  // Enter exits heading → new paragraph
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('First paragraph.')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Second paragraph.')

  const output = await getOutput(page)
  expect(output).toMatch(/<h1[^>]*>/)
  expect(output).toContain('Introduction')
  // Both paragraphs should be in separate <p> blocks, not inside the heading
  expect(output).toMatch(/<p>First paragraph\.<\/p>/)
  expect(output).toMatch(/<p>Second paragraph\.<\/p>/)
})

test('realistic: pressing Enter twice creates two empty paragraphs and cursor moves down', async ({
  page,
}) => {
  await clearAndType(page, 'Top')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Bottom')
  const output = await getOutput(page)
  // Should have: <p>Top</p> then an empty paragraph then <p>Bottom</p>
  expect(output).toMatch(/<p[^>]*>Top<\/p>/)
  expect(output).toContain('<p>Bottom</p>')
  // "Bottom" must not be in the same paragraph as "Top"
  expect(output).not.toContain('TopBottom')
})

test('realistic: build a bullet list by pressing Enter between items', async ({ page }) => {
  await clearAndType(page, 'First')
  await page.click(BTN.ul)
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Second')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Third')

  const output = await getOutput(page)
  expect(output).toContain('<ul>')
  // All three items should be present as list items
  const liMatches = output.match(/<li>/g)
  expect(liMatches?.length).toBe(3)
  expect(output).toContain('First')
  expect(output).toContain('Second')
  expect(output).toContain('Third')
})

test('realistic: clicking bold with no selection is a no-op', async ({ page }) => {
  await clearAndType(page, 'Start ')
  // Cursor is at end of "Start " — click bold with no selection
  await page.click(BTN.bold)
  await page.keyboard.type('plain part')
  const output = await getOutput(page)
  // Text should NOT be bold — toggleMark is a no-op on collapsed cursor
  expect(output).not.toMatch(/<(b|strong)>/)
  expect(output).toContain('Start plain part')
})

test('realistic: switch heading level directly from H1 to H2', async ({ page }) => {
  await clearAndType(page, 'Section title')
  await selectBlockType(page, 'h1')
  // Cursor is inside H1 — select H2 directly
  await selectBlockType(page, 'h2')
  const output = await getOutput(page)
  expect(output).toContain('<h2>')
  expect(output).not.toContain('<h1>')
})

test('realistic: apply bold then italic to the same selection', async ({ page }) => {
  await clearAndType(page, 'emphasis')
  await selectInEditor(page, 'emphasis')
  await page.click(BTN.bold)
  // Re-select (formatting may collapse the selection)
  await selectInEditor(page, 'emphasis')
  await page.click(BTN.italic)
  const output = await getOutput(page)
  // Both tags should be present, nested in some order
  expect(output).toMatch(/<(b|strong)>/)
  expect(output).toMatch(/<(i|em)>/)
  expect(output).toContain('emphasis')
})

test('realistic: selection stays on the toggled word after bold round-trip (schema merge)', async ({
  page,
}) => {
  // Repro: in the playground initial content, selecting bold "Eddy" and
  // clicking Bold removes the mark, the schema merges adjacent text nodes,
  // and the selection used to drift to the end of the line.
  await selectInEditor(page, 'Eddy')
  await page.click(BTN.bold)

  const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? '')
  expect(selectedText).toBe('Eddy')
})

test('realistic: selection stays on the toggled word after bold→unbold round-trip on plain text', async ({
  page,
}) => {
  await clearAndType(page, 'Welcome to the world')
  // Pick a middle word so a clamp-to-end bug would visibly extend the selection.
  await selectInEditor(page, 'to')
  await page.click(BTN.bold)
  // After the second toggle, the three text nodes merge back into one
  // — the selection must still cover only "to".
  await page.click(BTN.bold)

  const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? '')
  expect(selectedText).toBe('to')
})

test('realistic: undo removes applied bold formatting', async ({ page }) => {
  await clearAndType(page, 'undo me')
  await selectInEditor(page, 'undo me')
  await page.click(BTN.bold)
  // Verify bold was applied
  let output = await getOutput(page)
  expect(output).toMatch(/<(b|strong)>/)

  // Undo
  await page.keyboard.press('Meta+Z')
  output = await getOutput(page)
  // Bold tags should be gone, text should remain
  expect(output).toContain('undo me')
  expect(output).not.toMatch(/<(b|strong)>/)
})

test('realistic: Enter in the middle of a heading splits it correctly', async ({ page }) => {
  await clearAndType(page, 'Hello World')
  await selectBlockType(page, 'h2')
  // Place collapsed cursor between "Hello" and " World"
  await page.locator('.eddy-editor').evaluate((el) => {
    const h = el.querySelector('h2')
    if (!h) return
    const textNode = h.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 5)
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    el.focus()
  })
  await page.keyboard.press('Enter')
  await page.keyboard.type('New line')

  const output = await getOutput(page)
  // "Hello" stays in the heading
  expect(output).toContain('<h2>Hello</h2>')
  // Enter splits the heading — text after cursor becomes a paragraph.
  // Typing "New line" inserts at cursor (start of that paragraph).
  expect(output).toContain('New line')
  expect(output).toContain('World')
})

test('realistic: Enter at the beginning of a heading creates an empty paragraph before it', async ({
  page,
}) => {
  await clearAndType(page, 'Hello World')
  await selectBlockType(page, 'h2')
  // Home key moves cursor to position 0 of the heading
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Before')

  const output = await getOutput(page)
  // Empty paragraph was inserted above; cursor stayed in the heading
  // so "Before" is prepended to heading text
  expect(output).toContain('<h2>BeforeHello World</h2>')
})

test('realistic: Enter in the middle of a heading splits content correctly', async ({ page }) => {
  await clearAndType(page, 'Hello World')
  await selectBlockType(page, 'h2')
  // Place cursor between "Hello" and " World" using Selection API
  await page.locator('.eddy-editor').evaluate((el) => {
    const h = el.querySelector('h2')
    if (!h) return
    const textNode = h.firstChild as Text
    const range = document.createRange()
    // Cursor after "Hello" (index 5)
    range.setStart(textNode, 5)
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    el.focus()
  })
  await page.keyboard.press('Enter')

  const output = await getOutput(page)
  // "Hello" should remain in the h2, " World" should be in a paragraph
  expect(output).toContain('<h2>')
  expect(output).toContain('Hello')
  expect(output).toContain('<p>')
  expect(output).toContain('World')
  // " World" must NOT be inside an h2
  expect(output).not.toMatch(/<h2>[^<]*World/)
})

// ── Disabled state ───────────────────────────────────────────────────────────

test('disabled: editor is not editable when disabled', async ({ page }) => {
  const editor = page.locator('.eddy-editor')
  const toggle = page.locator('[data-testid="toggle-disabled"]')

  // Enable disabled state
  await toggle.check()
  await expect(editor).toHaveAttribute('contenteditable', 'false')
  await expect(editor).toHaveClass(/is-disabled/)

  // Typing should have no effect
  const beforeOutput = await getOutput(page)
  await editor.click()
  await page.keyboard.type('should not appear')
  const afterOutput = await getOutput(page)
  expect(afterOutput).toBe(beforeOutput)
})

test('disabled: toolbar buttons are disabled when editor is disabled', async ({ page }) => {
  const toggle = page.locator('[data-testid="toggle-disabled"]')
  await toggle.check()

  const boldBtn = page.locator(BTN.bold)
  await expect(boldBtn).toBeDisabled()
})

test('disabled: re-enabling restores editing', async ({ page }) => {
  const editor = page.locator('.eddy-editor')
  const toggle = page.locator('[data-testid="toggle-disabled"]')

  await toggle.check()
  await expect(editor).toHaveAttribute('contenteditable', 'false')

  await toggle.uncheck()
  await expect(editor).toHaveAttribute('contenteditable', 'true')

  // Should be able to type again
  await clearAndType(page, 'works again')
  const output = await getOutput(page)
  expect(output).toContain('works again')
})

// ── Realistic user scenarios (continued) ─────────────────────────────────────

test('realistic: formatting a word in the initial content (without clearing)', async ({ page }) => {
  // The playground loads with content — do NOT clear it
  // Select "formatting" from "Try formatting this text!"
  await selectInEditor(page, 'formatting')
  await page.click(BTN.italic)
  const output = await getOutput(page)
  // "formatting" should be italic
  expect(output).toMatch(/<(i|em)>formatting<\/(i|em)>/)
  // Rest of the sentence structure should be intact
  expect(output).toContain('Welcome to the')
  expect(output).toContain('Try ')
  expect(output).toContain(' this text!')
})
