<template>
  <div class="w-full rounded-full overflow-hidden bg-slate-800 h-2">
    <div
      class="h-full rounded-full transition-all duration-500 ease-out"
      :class="color"
      :style="{ width: `${clampedPercent}%` }"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 100
  },
  color: {
    type: String,
    default: 'bg-brand-500'
  }
})

const clampedPercent = computed(() => {
  if (props.max <= 0) return 0
  const pct = (props.value / props.max) * 100
  return Math.min(100, Math.max(0, pct))
})
</script>
