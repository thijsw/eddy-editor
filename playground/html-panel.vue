<template>
  <section class="demo-section">
    <h2 class="section-title">HTML output <span class="hint">(v-model value)</span></h2>
    <pre class="html-output">{{ html }}</pre>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  html: string
}>()
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

.html-output {
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
</style>
