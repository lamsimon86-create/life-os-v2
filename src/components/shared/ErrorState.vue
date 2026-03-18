<template>
  <div class="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
    <p class="text-red-400 text-sm font-medium">{{ message }}</p>
    <button
      class="text-sm text-brand-400 hover:text-brand-300 transition-colors underline underline-offset-2"
      @click="$emit('retry')"
    >
      Try again
    </button>
  </div>
</template>

<script setup>
defineProps({
  message: {
    type: String,
    required: true
  }
})

defineEmits(['retry'])
</script>
