<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    class="-rotate-90"
  >
    <!-- Background track -->
    <circle
      :cx="center"
      :cy="center"
      :r="radius"
      fill="none"
      class="stroke-slate-800"
      :stroke-width="strokeWidth"
    />
    <!-- Progress arc -->
    <circle
      :cx="center"
      :cy="center"
      :r="radius"
      fill="none"
      class="stroke-brand-500 transition-all duration-500 ease-out"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="dashOffset"
    />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: Number,
    default: 0
  },
  size: {
    type: Number,
    default: 48
  },
  strokeWidth: {
    type: Number,
    default: 4
  }
})

const center = computed(() => props.size / 2)
const radius = computed(() => (props.size - props.strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

const dashOffset = computed(() => {
  const clampedValue = Math.min(100, Math.max(0, props.value))
  const progress = clampedValue / 100
  return circumference.value * (1 - progress)
})
</script>
