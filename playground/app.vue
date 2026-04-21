<template>
  <div class="playground">
    <header class="playground-header">
      <h1>Eddy Editor — Playground</h1>
    </header>

    <main class="playground-main">
      <section class="demo-section">
        <h2 class="section-title">Editor</h2>
        <eddy-editor
          v-model="content"
          :plugins="defaultPlugins"
          :disabled="isDisabled"
          placeholder="Start typing to see the placeholder disappear…"
        />
        <label class="disabled-toggle">
          <input type="checkbox" v-model="isDisabled" />
          Disabled
        </label>
      </section>

      <html-panel :html="content" />
      <ast-panel :html="content" />

      <section class="demo-section">
        <h2 class="section-title">Examples</h2>
        <a href="custom-toolbar.html">Custom toolbar with all buttons</a>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EddyEditor, defaultPlugins } from 'eddy-editor/vue'
import HtmlPanel from './html-panel.vue'
import AstPanel from './ast-panel.vue'

const content = ref(
  '<p>Welcome to the <strong>Eddy</strong> editor playground. Try formatting this text!</p>',
)
const isDisabled = ref(false)
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
</style>
