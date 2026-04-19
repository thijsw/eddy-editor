<template>
  <div class="playground">
    <header class="playground-header">
      <a href="./" class="back-link">&larr; Back to playground</a>
      <h1>Custom Toolbar Example</h1>
      <p class="playground-description">
        This example demonstrates how to build a custom toolbar using the
        <code>EditorAPI</code> slot props. All formatting options are rendered as individual
        buttons.
      </p>
    </header>

    <main class="playground-main">
      <section class="demo-section">
        <h2 class="section-title">Editor</h2>
        <eddy-editor v-model="content">
          <template #toolbar="{ editor, plugins, disabled }">
            <custom-toolbar :editor="editor" :plugins="plugins" :disabled="disabled" />
          </template>
        </eddy-editor>
      </section>

      <html-panel :html="content" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EddyEditor } from 'eddy-editor/vue'
import HtmlPanel from './html-panel.vue'
import CustomToolbar from './custom-toolbar.vue'

const content = ref(
  '<p>This editor uses a <strong>custom toolbar</strong> where every option is a button.</p>',
)
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

.back-link {
  font-size: 0.875rem;
  color: #6b7280;
  text-decoration: none;
}

.back-link:hover {
  color: #374151;
}

.playground-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0.5rem 0 0;
}

.playground-description {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
}

.playground-description code {
  background: #e5e7eb;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
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
