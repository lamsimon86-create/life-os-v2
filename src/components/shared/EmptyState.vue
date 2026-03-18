<template>
  <div class="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
    <p class="text-slate-300 font-semibold text-base">{{ title }}</p>
    <p v-if="description" class="text-slate-500 text-sm">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  }
})
</script>
