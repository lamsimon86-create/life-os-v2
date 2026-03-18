<template>
  <div class="w-full">
    <h2 class="text-2xl font-bold text-slate-100 mb-1">{{ title }}</h2>
    <p v-if="subtitle" class="text-slate-400 mb-6">{{ subtitle }}</p>
    <div :class="subtitle ? '' : 'mt-6'">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  step: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  }
})
</script>
