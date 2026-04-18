import { test, expect } from 'vitest'
import {
  mountEditor,
  selectAll,
  selectInEditor,
  placeCursorIn,
  clearAndType,
  mockPrompt,
  press,
  type,
  page,
  BTN,
} from './helpers'

const INITIAL_PLAYGROUND =
  '<p>Welcome to the <strong>Eddy</strong> editor playground. Try formatting this text!</p>'

// ── Toolbar formatting ────────────────────────────────────────────────────────

test('toolbar: bold button wraps selected text in bold tag', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await page.getByTitle(BTN.bold).click()
  expect(getEmitted()).toMatch(/<(b|strong)>/)
})

test('toolbar: bold button toggles off (aria-pressed reflects state)', async () => {
  await mountEditor(INITIAL_PLAYGROUND)
  const boldBtn = page.getByTitle(BTN.bold)

  await selectAll()
  await boldBtn.click()
  await expect.element(boldBtn).toHaveAttribute('aria-pressed', 'true')

  await selectAll()
  await boldBtn.click()
  await expect.element(boldBtn).toHaveAttribute('aria-pressed', 'false')
})

test('toolbar: italic button wraps selected text', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await page.getByTitle(BTN.italic).click()
  expect(getEmitted()).toMatch(/<(i|em)>/)
})

test('toolbar: underline button wraps selected text', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await page.getByTitle(BTN.underline).click()
  expect(getEmitted()).toMatch(/<u>/)
})

test('toolbar: strikethrough button wraps selected text', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await page.getByTitle(BTN.strikethrough).click()
  expect(getEmitted()).toMatch(/<(s|strike|del)>/)
})

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

test('keybinding: Mod+B applies bold', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await press('ControlOrMeta+b')
  expect(getEmitted()).toMatch(/<(b|strong)>/)
})

test('keybinding: Mod+I applies italic', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await press('ControlOrMeta+i')
  expect(getEmitted()).toMatch(/<(i|em)>/)
})

test('keybinding: Mod+U applies underline', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await press('ControlOrMeta+u')
  expect(getEmitted()).toMatch(/<u>/)
})

// ── Heading toggle ────────────────────────────────────────────────────────────

async function selectBlockType(value: string) {
  const select = document.querySelector('.eddy-toolbar-select') as HTMLSelectElement
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

test('heading: select converts block to h1', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('My heading')
  await selectBlockType('h1')
  expect(getEmitted()).toMatch(/<h1[^>]*>/)
})

test('heading: select toggles off (h1 → p)', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('My heading')
  await selectBlockType('h1')
  expect(getEmitted()).toMatch(/<h1[^>]*>/)
  await selectBlockType('paragraph')
  expect(getEmitted()).not.toContain('<h1>')
  expect(getEmitted()).toContain('<p>')
})

test('heading: select reflects active state when cursor is in h1', async () => {
  await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('My heading')
  await selectBlockType('h1')
  const select = document.querySelector('.eddy-toolbar-select') as HTMLSelectElement
  expect(select.value).toBe('h1')
})

test('heading: H2-H6 via select work', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  for (const level of [2, 3, 4, 5, 6]) {
    await clearAndType(`Heading ${level}`)
    await selectBlockType(`h${level}`)
    expect(getEmitted()).toContain(`<h${level}>`)
  }
})

// ── Lists ─────────────────────────────────────────────────────────────────────

test('list: unordered list button creates ul > li', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('List item')
  await page.getByTitle(BTN.ul).click()
  const output = getEmitted()
  expect(output).toContain('<ul>')
  expect(output).toMatch(/<li[^>]*>/)
  expect(output).not.toMatch(/<p[^>]*>\s*<ul/)
})

test('list: ordered list button creates ol > li', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('List item')
  await page.getByTitle(BTN.ol).click()
  const output = getEmitted()
  expect(output).toContain('<ol>')
  expect(output).toMatch(/<li[^>]*>/)
  expect(output).not.toMatch(/<p[^>]*>\s*<ol/)
})

test('list: unordered list toggles off', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('List item')
  await page.getByTitle(BTN.ul).click()
  await page.getByTitle(BTN.ul).click()
  expect(getEmitted()).not.toContain('<ul>')
})

// ── Style hygiene ─────────────────────────────────────────────────────────────

test('style hygiene: toggling unordered list off leaves no inline styles or bare spans', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Some text')
  await page.getByTitle(BTN.ul).click()
  await page.getByTitle(BTN.ul).click()
  expect(getEmitted()).not.toContain('style=')
  expect(getEmitted()).not.toMatch(/<span>/)
})

test('style hygiene: toggling ordered list off leaves no inline styles or bare spans', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Some text')
  await page.getByTitle(BTN.ol).click()
  await page.getByTitle(BTN.ol).click()
  expect(getEmitted()).not.toContain('style=')
  expect(getEmitted()).not.toMatch(/<span>/)
})

test('style hygiene: toggling list off with mixed content (bold inline) leaves no inline styles or bare spans', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await page.getByTitle(BTN.ul).click()
  await page.getByTitle(BTN.ul).click()
  expect(getEmitted()).not.toContain('style=')
  expect(getEmitted()).not.toMatch(/<span>/)
})

// ── v-model sync ──────────────────────────────────────────────────────────────

test('v-model: typing updates the HTML output', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await press('Delete')
  await type('Hello world')
  expect(getEmitted()).toContain('Hello world')
})

test('v-model: output is canonical HTML (no internal data-block-id attributes)', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await press('Delete')
  await type('Test content')
  const output = getEmitted()
  expect(output).not.toContain('data-block-id')
  expect(output.trim()).toBe('<p>Test content</p>')
})

// ── Empty editor ──────────────────────────────────────────────────────────────

test('empty editor: can type after clearing all content', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await press('Delete')
  const editor = document.querySelector('.eddy-editor') as HTMLElement
  editor.focus()
  await type('Fresh start')
  expect(getEmitted()).toContain('Fresh start')
})

test('empty editor: formatting can be applied to newly typed text', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectAll()
  await press('Delete')
  const editor = document.querySelector('.eddy-editor') as HTMLElement
  editor.focus()
  await type('Bold me')
  await selectAll()
  await page.getByTitle(BTN.bold).click()
  expect(getEmitted()).toMatch(/<(b|strong)>/)
})

// ── Shift+Enter ───────────────────────────────────────────────────────────────

test('Shift+Enter inserts a line break instead of a new block', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Line one')
  await press('Shift+Enter')
  await type('Line two')
  const output = getEmitted()
  expect(output).toContain('<br>')
  expect(output).toContain('Line one')
  expect(output).toContain('Line two')
})

test('Shift+Enter places cursor on the new line, not at start of editor', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('aa')
  await press('Shift+Enter')
  await type('bb')
  const output = getEmitted()
  expect(output).toMatch(/aa<br>bb/)
  expect(output).not.toMatch(/<p>.*<\/p>\s*<p>/)
})

test('multiple Shift+Enter inserts multiple line breaks', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('first')
  await press('Shift+Enter')
  await press('Shift+Enter')
  await type('second')
  expect(getEmitted()).toMatch(/first<br><br>second/)
})

// ── Realistic user scenarios ──────────────────────────────────────────────────

test('realistic: bold one word within a sentence, leaving the rest plain', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Hello world foo')
  await selectInEditor('world')
  await page.getByTitle(BTN.bold).click()
  const output = getEmitted()
  expect(output).toMatch(/<(b|strong)>world<\/(b|strong)>/)
  expect(output).toContain('Hello ')
  expect(output).toContain(' foo')
})

test('realistic: toolbar bold state tracks cursor moving between formatted and plain text', async () => {
  await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Hello world')
  await selectInEditor('Hello')
  await page.getByTitle(BTN.bold).click()
  const boldBtn = page.getByTitle(BTN.bold)

  await placeCursorIn('world')
  await expect.element(boldBtn).toHaveAttribute('aria-pressed', 'false')

  await placeCursorIn('Hello')
  await expect.element(boldBtn).toHaveAttribute('aria-pressed', 'true')
})

test('realistic: build a document — heading then multiple paragraphs via Enter', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Introduction')
  await selectBlockType('h1')
  await press('End')
  await press('Enter')
  await type('First paragraph.')
  await press('Enter')
  await type('Second paragraph.')

  const output = getEmitted()
  expect(output).toMatch(/<h1[^>]*>/)
  expect(output).toContain('Introduction')
  expect(output).toMatch(/<p>First paragraph\.<\/p>/)
  expect(output).toMatch(/<p>Second paragraph\.<\/p>/)
})

test('realistic: pressing Enter twice creates two empty paragraphs and cursor moves down', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Top')
  await press('Enter')
  await press('Enter')
  await type('Bottom')
  const output = getEmitted()
  expect(output).toMatch(/<p[^>]*>Top<\/p>/)
  expect(output).toContain('<p>Bottom</p>')
  expect(output).not.toContain('TopBottom')
})

test('realistic: build a bullet list by pressing Enter between items', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('First')
  await page.getByTitle(BTN.ul).click()
  await press('End')
  await press('Enter')
  await type('Second')
  await press('Enter')
  await type('Third')

  const output = getEmitted()
  expect(output).toContain('<ul>')
  const liMatches = output.match(/<li>/g)
  expect(liMatches?.length).toBe(3)
  expect(output).toContain('First')
  expect(output).toContain('Second')
  expect(output).toContain('Third')
})

test('realistic: clicking bold with no selection is a no-op', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Start ')
  await page.getByTitle(BTN.bold).click()
  await type('plain part')
  const output = getEmitted()
  expect(output).not.toMatch(/<(b|strong)>/)
  expect(output).toContain('Start plain part')
})

test('realistic: switch heading level directly from H1 to H2', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Section title')
  await selectBlockType('h1')
  await selectBlockType('h2')
  const output = getEmitted()
  expect(output).toContain('<h2>')
  expect(output).not.toContain('<h1>')
})

test('realistic: apply bold then italic to the same selection', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('emphasis')
  await selectInEditor('emphasis')
  await page.getByTitle(BTN.bold).click()
  await selectInEditor('emphasis')
  await page.getByTitle(BTN.italic).click()
  const output = getEmitted()
  expect(output).toMatch(/<(b|strong)>/)
  expect(output).toMatch(/<(i|em)>/)
  expect(output).toContain('emphasis')
})

test('realistic: selection stays on the toggled word after bold round-trip (schema merge)', async () => {
  await mountEditor(INITIAL_PLAYGROUND)
  await selectInEditor('Eddy')
  await page.getByTitle(BTN.bold).click()

  const selectedText = window.getSelection()?.toString() ?? ''
  expect(selectedText).toBe('Eddy')
})

test('realistic: selection stays on the toggled word after bold→unbold round-trip on plain text', async () => {
  await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Welcome to the world')
  await selectInEditor('to')
  await page.getByTitle(BTN.bold).click()
  await page.getByTitle(BTN.bold).click()

  const selectedText = window.getSelection()?.toString() ?? ''
  expect(selectedText).toBe('to')
})

test('realistic: undo removes applied bold formatting', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('undo me')
  await selectInEditor('undo me')
  await page.getByTitle(BTN.bold).click()
  expect(getEmitted()).toMatch(/<(b|strong)>/)

  await press('ControlOrMeta+z')
  expect(getEmitted()).toContain('undo me')
  expect(getEmitted()).not.toMatch(/<(b|strong)>/)
})

test('realistic: Enter in the middle of a heading splits it correctly', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Hello World')
  await selectBlockType('h2')

  const h = document.querySelector('.eddy-editor h2')
  const textNode = h?.firstChild as Text
  const range = document.createRange()
  range.setStart(textNode, 5)
  range.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  ;(document.querySelector('.eddy-editor') as HTMLElement).focus()
  await press('Enter')
  await type('New line')

  const output = getEmitted()
  expect(output).toContain('<h2>Hello</h2>')
  expect(output).toContain('New line')
  expect(output).toContain('World')
})

test('realistic: Enter at the beginning of a heading creates an empty paragraph before it', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Hello World')
  await selectBlockType('h2')
  await press('Home')
  await press('Enter')
  await type('Before')

  expect(getEmitted()).toContain('<h2>BeforeHello World</h2>')
})

test('realistic: Enter in the middle of a heading splits content correctly', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('Hello World')
  await selectBlockType('h2')

  const h = document.querySelector('.eddy-editor h2')
  const textNode = h?.firstChild as Text
  const range = document.createRange()
  range.setStart(textNode, 5)
  range.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  ;(document.querySelector('.eddy-editor') as HTMLElement).focus()
  await press('Enter')

  const output = getEmitted()
  expect(output).toContain('<h2>')
  expect(output).toContain('Hello')
  expect(output).toContain('<p>')
  expect(output).toContain('World')
  expect(output).not.toMatch(/<h2>[^<]*World/)
})

// ── Disabled state ───────────────────────────────────────────────────────────

test('disabled: editor is not editable when disabled', async () => {
  const { getEmitted, setDisabled } = await mountEditor(INITIAL_PLAYGROUND)
  const before = getEmitted()

  await setDisabled(true)
  const editor = document.querySelector('.eddy-editor') as HTMLElement
  expect(editor.getAttribute('contenteditable')).toBe('false')
  expect(editor.className).toContain('is-disabled')

  editor.focus()
  await type('should not appear')
  expect(getEmitted()).toBe(before)
})

test('disabled: toolbar buttons are disabled when editor is disabled', async () => {
  const { setDisabled } = await mountEditor(INITIAL_PLAYGROUND)
  await setDisabled(true)
  const boldBtn = page.getByTitle(BTN.bold)
  await expect.element(boldBtn).toBeDisabled()
})

test('disabled: re-enabling restores editing', async () => {
  const { getEmitted, setDisabled } = await mountEditor(INITIAL_PLAYGROUND)
  await setDisabled(true)
  const editor = document.querySelector('.eddy-editor') as HTMLElement
  expect(editor.getAttribute('contenteditable')).toBe('false')

  await setDisabled(false)
  expect(editor.getAttribute('contenteditable')).toBe('true')

  await clearAndType('works again')
  expect(getEmitted()).toContain('works again')
})

// ── Links ────────────────────────────────────────────────────────────────────

test('link: toolbar button wraps selected text in anchor with href', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('click here')
  await selectInEditor('here')
  mockPrompt('https://example.com')
  await page.getByTitle(BTN.link).click()
  const output = getEmitted()
  expect(output).toMatch(/<a href="https:\/\/example\.com">here<\/a>/)
  expect(output).toContain('click ')
})

test('link: Mod+K applies link to selected text', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('see docs')
  await selectInEditor('docs')
  mockPrompt('https://docs.example')
  await press('ControlOrMeta+k')
  expect(getEmitted()).toMatch(/<a href="https:\/\/docs\.example">docs<\/a>/)
})

test('link: cursor inside existing link edits the href', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('go home')
  await selectInEditor('home')
  mockPrompt('https://old.example')
  await page.getByTitle(BTN.link).click()
  await placeCursorIn('home')
  const spy = mockPrompt('https://new.example')
  await page.getByTitle(BTN.link).click()
  expect(spy).toHaveBeenCalledWith(expect.any(String), 'https://old.example')
  const output = getEmitted()
  expect(output).toContain('<a href="https://new.example">home</a>')
  expect(output).not.toContain('old.example')
})

test('link: empty prompt removes the link (cursor inside link)', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('drop me')
  await selectInEditor('me')
  mockPrompt('https://x.example')
  await page.getByTitle(BTN.link).click()
  await placeCursorIn('me')
  mockPrompt('')
  await page.getByTitle(BTN.link).click()
  const output = getEmitted()
  expect(output).not.toContain('<a ')
  expect(output).toContain('drop me')
})

test('link: cancelling the prompt leaves the document unchanged', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('leave alone')
  await selectInEditor('alone')
  mockPrompt(null)
  await page.getByTitle(BTN.link).click()
  const output = getEmitted()
  expect(output).not.toContain('<a ')
  expect(output).toContain('leave alone')
})

test('link: toolbar is active when cursor is inside a link', async () => {
  await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('active test')
  await selectInEditor('test')
  mockPrompt('https://e.example')
  await page.getByTitle(BTN.link).click()
  const linkBtn = page.getByTitle(BTN.link)
  await placeCursorIn('test')
  await expect.element(linkBtn).toHaveAttribute('aria-pressed', 'true')
  await placeCursorIn('active')
  await expect.element(linkBtn).toHaveAttribute('aria-pressed', 'false')
})

test('link: v-model round-trips anchor HTML through the editor', async () => {
  const { getEmitted } = await mountEditor(
    '<p>hello <a href="https://round.example">world</a></p>',
  )
  expect(getEmitted()).toBe('<p>hello <a href="https://round.example">world</a></p>')
})

test('link: javascript: hrefs are sanitized away on parse', async () => {
  const { getEmitted } = await mountEditor(
    '<p>click <a href="javascript:alert(1)">here</a></p>',
  )
  const output = getEmitted()
  expect(output).not.toContain('<a ')
  expect(output).not.toContain('javascript:')
  expect(output).toContain('click here')
})

test('link: adjacent links with different hrefs are preserved separately', async () => {
  const { getEmitted } = await mountEditor(
    '<p><a href="https://a.example">AA</a><a href="https://b.example">BB</a></p>',
  )
  const output = getEmitted()
  expect(output).toContain('<a href="https://a.example">AA</a>')
  expect(output).toContain('<a href="https://b.example">BB</a>')
  expect(output).not.toMatch(/<a href="https:\/\/a\.example">AA BB<\/a>/)
})

test('link: href with double quotes is escaped in output', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('safe text')
  await selectInEditor('safe')
  mockPrompt('https://x.example/?q="evil')
  await page.getByTitle(BTN.link).click()
  const output = getEmitted()
  expect(output).toContain('&quot;evil')
  expect(output).not.toMatch(/href="[^"]*"evil/)
})

test('link: clicking link with collapsed cursor outside any link is a no-op', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('plain')
  mockPrompt('https://nope.example')
  await page.getByTitle(BTN.link).click()
  const output = getEmitted()
  expect(output).not.toContain('<a ')
  expect(output).toContain('plain')
})

test('link: undo removes an applied link', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await clearAndType('undo link')
  await selectInEditor('link')
  mockPrompt('https://undo.example')
  await page.getByTitle(BTN.link).click()
  expect(getEmitted()).toContain('<a href="https://undo.example">link</a>')

  await press('ControlOrMeta+z')
  const output = getEmitted()
  expect(output).not.toContain('<a ')
  expect(output).toContain('undo link')
})

// ── Initial content (replaces playground-dependent test) ─────────────────────

test('realistic: formatting a word in the initial content (without clearing)', async () => {
  const { getEmitted } = await mountEditor(INITIAL_PLAYGROUND)
  await selectInEditor('formatting')
  await page.getByTitle(BTN.italic).click()
  const output = getEmitted()
  expect(output).toMatch(/<(i|em)>formatting<\/(i|em)>/)
  expect(output).toContain('Welcome to the')
  expect(output).toContain('Try ')
  expect(output).toContain(' this text!')
})
