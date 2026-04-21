<template>
  <eddy-editor
    :model-value="content"
    @update:model-value="onUpdate"
    :plugins="defaultPlugins"
    :disabled="disabled ?? false"
    :placeholder="placeholder ?? ''"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { EddyEditor } from '../../src/vue/index'
import { defaultPlugins } from '../../src/plugins/index'

const props = defineProps<{
  initial: string
  disabled?: boolean
  placeholder?: string
}>()
const emit = defineEmits<{ (e: 'emit', html: string): void }>()
const content = ref(props.initial)

function onUpdate(v: string) {
  content.value = v
  emit('emit', v)
}

watch(
  () => props.initial,
  (v) => {
    content.value = v
  },
)
</script>
