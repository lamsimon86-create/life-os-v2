<template>
  <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
    <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-sm text-center">
      <div class="text-4xl mb-3">&#127942;</div>
      <h2 class="text-xl font-bold mb-1">Goal Complete!</h2>
      <p class="text-sm text-slate-400 mb-4">{{ goal.title }}</p>

      <div class="bg-slate-700 rounded-xl p-4 mb-4">
        <div class="text-2xl font-bold text-purple-400">+{{ xpEarned }} XP</div>
        <div class="text-xs text-slate-500 mt-1">{{ isEarly ? 'Finished early!' : 'Right on time' }}</div>
      </div>

      <button
        @click="$emit('setNext', goal.category)"
        class="w-full py-3 rounded-lg bg-blue-500 text-sm font-semibold text-white mb-2"
      >
        Set Next {{ categoryLabel }} Goal
      </button>
      <button @click="$emit('close')" class="w-full py-2 text-sm text-slate-500 hover:text-slate-300">
        Maybe later
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  goal: { type: Object, required: true },
  xpEarned: { type: Number, default: 500 }
})

const emit = defineEmits(['close', 'setNext'])

const isEarly = computed(() => {
  if (!props.goal.target_date) return false
  return new Date(props.goal.target_date) > new Date()
})

const categoryLabel = computed(() => {
  const labels = { body: 'Body', nutrition: 'Nutrition', performance: 'Performance' }
  return labels[props.goal.category] || ''
})
</script>
