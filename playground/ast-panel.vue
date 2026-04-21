<template>
  <section class="demo-section">
    <h2 class="section-title">AST <span class="hint">(document tree)</span></h2>
    <pre class="ast-output"><ast-node :node="doc" :depth="0" /></pre>
  </section>
</template>

<script setup lang="ts">
import { computed, h, type FunctionalComponent } from 'vue'
import { parseHTML } from 'eddy-editor'
import type { DocumentNode, BlockNode, InlineNode, Mark } from 'eddy-editor'

const props = defineProps<{
  html: string
}>()

const doc = computed(() => parseHTML(props.html))

function indent(depth: number): string {
  return '  '.repeat(depth)
}

function formatAttrs(attrs: Record<string, unknown>): string {
  const entries = Object.entries(attrs)
  if (entries.length === 0) return ''
  return entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
}

const AstNode: FunctionalComponent<{
  node: DocumentNode | BlockNode | InlineNode
  depth: number
}> = (props) => {
  const { node, depth } = props
  const children: (ReturnType<typeof h> | string)[] = []

  if ('blocks' in node) {
    const docNode = node as DocumentNode
    children.push(h('span', { class: 'ast-document' }, `${indent(depth)}document\n`))
    for (const child of docNode.blocks) {
      children.push(h(AstNode, { node: child, depth: depth + 1 }))
    }
  } else if (node.type === 'text') {
    const textNode = node as Extract<InlineNode, { type: 'text' }>
    if (textNode.marks.length > 0) {
      const markStr = textNode.marks.map((m: Mark) => m.type).join(', ')
      children.push(
        h('span', { class: 'ast-inline' }, `${indent(depth)}text `),
        h('span', { class: 'ast-mark' }, `[${markStr}]`),
        ' ',
        h('span', { class: 'ast-text' }, `"${textNode.text}"`),
        '\n',
      )
    } else {
      children.push(
        h('span', { class: 'ast-inline' }, `${indent(depth)}text `),
        h('span', { class: 'ast-text' }, `"${textNode.text}"`),
        '\n',
      )
    }
  } else if (node.type === 'hardBreak') {
    children.push(h('span', { class: 'ast-inline' }, `${indent(depth)}hardBreak\n`))
  } else {
    const blockNode = node as BlockNode
    const attrStr = formatAttrs(blockNode.attrs)
    children.push(
      h('span', { class: 'ast-block' }, `${indent(depth)}${blockNode.type} `),
      ...(attrStr ? [h('span', { class: 'ast-prop' }, attrStr), ' '] : []),
      h('span', { class: 'ast-id' }, `id=${blockNode.id}`),
      '\n',
    )
    for (const child of blockNode.children) {
      children.push(h(AstNode, { node: child, depth: depth + 1 }))
    }
  }

  return children
}

AstNode.props = ['node', 'depth']
</script>

<style scoped>
.demo-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  margin: 0;
}

.hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

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

.ast-output :deep(.ast-document) {
  color: #6c7086;
}

.ast-output :deep(.ast-block) {
  color: #89b4fa;
}

.ast-output :deep(.ast-inline) {
  color: #a6e3a1;
}

.ast-output :deep(.ast-mark) {
  color: #fab387;
}

.ast-output :deep(.ast-text) {
  color: #cdd6f4;
}

.ast-output :deep(.ast-prop) {
  color: #cba6f7;
}

.ast-output :deep(.ast-id) {
  color: #94e2d5;
  font-size: 0.75rem;
}
</style>
