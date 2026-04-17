<template>
  <section class="demo-section">
    <h2 class="section-title">AST <span class="hint">(document tree)</span></h2>
    <pre class="ast-output"><ast-node :node="doc" :depth="0" /></pre>
  </section>
</template>

<script setup lang="ts">
import { computed, h, type FunctionalComponent } from 'vue'
import { parseHTML } from 'eddy-editor'
import type { DocumentNode, BlockNode, InlineNode, ListItemNode, Mark } from 'eddy-editor'

const props = defineProps<{
  html: string
}>()

const doc = computed(() => parseHTML(props.html))

// Indentation helper
function indent(depth: number): string {
  return '  '.repeat(depth)
}

// Recursive functional component to render tree nodes
const AstNode: FunctionalComponent<{
  node: DocumentNode | BlockNode | InlineNode | ListItemNode
  depth: number
}> = (props) => {
  const { node, depth } = props
  const children: ReturnType<typeof h>[] = []

  if (node.type === 'document') {
    children.push(h('span', { class: 'ast-document' }, `${indent(depth)}document\n`))
    for (const child of node.blocks) {
      children.push(h(AstNode, { node: child, depth: depth + 1 }))
    }
  } else if (node.type === 'paragraph') {
    children.push(
      h('span', { class: 'ast-block' }, `${indent(depth)}paragraph `),
      h('span', { class: 'ast-id' }, `id=${node.id}`),
      '\n',
    )
    for (const child of node.children) {
      children.push(h(AstNode, { node: child, depth: depth + 1 }))
    }
  } else if (node.type === 'heading') {
    children.push(
      h('span', { class: 'ast-block' }, `${indent(depth)}heading `),
      h('span', { class: 'ast-prop' }, `level=${node.level}`),
      ' ',
      h('span', { class: 'ast-id' }, `id=${node.id}`),
      '\n',
    )
    for (const child of node.children) {
      children.push(h(AstNode, { node: child, depth: depth + 1 }))
    }
  } else if (node.type === 'listItem') {
    children.push(
      h('span', { class: 'ast-block' }, `${indent(depth)}listItem `),
      h('span', { class: 'ast-prop' }, `ordered=${node.ordered} indent=${node.indent}`),
      ' ',
      h('span', { class: 'ast-id' }, `id=${node.id}`),
      '\n',
    )
    for (const child of node.children) {
      children.push(h(AstNode, { node: child, depth: depth + 1 }))
    }
  } else if (node.type === 'text') {
    if (node.marks.length > 0) {
      const markStr = node.marks.map((m: Mark) => m.type).join(', ')
      children.push(
        h('span', { class: 'ast-inline' }, `${indent(depth)}text `),
        h('span', { class: 'ast-mark' }, `[${markStr}]`),
        ' ',
        h('span', { class: 'ast-text' }, `"${node.text}"`),
        '\n',
      )
    } else {
      children.push(
        h('span', { class: 'ast-inline' }, `${indent(depth)}text `),
        h('span', { class: 'ast-text' }, `"${node.text}"`),
        '\n',
      )
    }
  } else if (node.type === 'hardBreak') {
    children.push(h('span', { class: 'ast-inline' }, `${indent(depth)}hardBreak\n`))
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
