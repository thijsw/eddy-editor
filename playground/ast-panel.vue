<template>
  <section class="demo-section">
    <h2 class="section-title">Document <span class="hint">(blocks and text runs)</span></h2>
    <pre
      class="ast-output"
    ><template v-for="b in doc" :key="b.id"><span class="ast-block">{{ b.type }}</span> <span v-if="attrs(b)" class="ast-prop">{{ attrs(b) }} </span><span class="ast-id">id={{ b.id }}</span>
<template v-for="(t, i) in b.children" :key="i">  <span v-if="marks(t)" class="ast-mark">[{{ marks(t) }}] </span><span class="ast-text">{{ JSON.stringify(t.text) }}</span>
</template></template></pre>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { createSchema, defaultPlugins, parse, type Block, type TextNode } from 'eddy-editor'

const props = defineProps<{ html: string }>()
const schema = createSchema(defaultPlugins)
const doc = computed(() => parse(props.html, schema))

const attrs = (b: Block) =>
  Object.entries(b.attrs)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ')
const marks = (t: TextNode) =>
  Object.entries(t.marks)
    .map(([k, v]) => (Object.keys(v).length ? `${k} ${JSON.stringify(v)}` : k))
    .join(', ')
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

.ast-block {
  color: #89b4fa;
}
.ast-mark {
  color: #fab387;
}
.ast-text {
  color: #cdd6f4;
}
.ast-prop {
  color: #cba6f7;
}
.ast-id {
  color: #94e2d5;
  font-size: 0.75rem;
}
</style>
