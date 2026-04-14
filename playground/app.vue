<template>
  <div class="playground">
    <header class="playground-header">
      <h1>Eddy Editor — Playground</h1>
    </header>

    <main class="playground-main">
      <section class="demo-section">
        <h2 class="section-title">Editor</h2>
        <eddy-editor v-model="content" :plugins="[markPlugin]">
          <template #toolbar>
            <eddy-toolbar />
          </template>
        </eddy-editor>
      </section>

      <section class="demo-section">
        <h2 class="section-title">HTML output <span class="hint">(v-model value)</span></h2>
        <pre class="html-output">{{ content }}</pre>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EddyEditor, EddyToolbar, createPlugin } from 'eddy-editor'

const content = ref('<p>Welcome to the <strong>Eddy</strong> editor playground. Try formatting this text!</p>')

// Example custom plugin — demonstrates the plugin API
const markPlugin = createPlugin({
  name: 'mark',
  toolbar: { label: 'Mark', title: 'Highlight text' },
  command(api) { api.execute('hiliteColor', 'mark') },
  isActive(api) { return api.getCommandValue('hiliteColor') === 'mark' },
})
</script>

<style scoped>
.playground {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

.playground-header {
  margin-bottom: 2rem;
}

.playground-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.playground-main {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

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
