<template>
  <div class="bg-brand-600/10 border border-brand-600/20 rounded-xl p-4 flex items-start gap-3">
    <Sparkles class="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
    <p class="text-brand-400 text-sm leading-relaxed">{{ insight }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'
import { useUserStore } from '@/stores/user'
import { getGreeting } from '@/lib/constants'

const fitnessStore = useFitnessStore()
const userStore = useUserStore()

const insight = computed(() => {
  const streak = userStore.streak
  const workoutStreak = fitnessStore.workoutStreak
  const level = userStore.level
  const greeting = getGreeting()

  if (streak >= 7) {
    return `${streak}-day streak — you're building something real. Keep showing up.`
  }
  if (workoutStreak >= 3) {
    return `${workoutStreak} workouts in a row. Consistency beats intensity every time.`
  }
  if (level >= 5) {
    return `Level ${level} — most people quit before they get here. You didn't.`
  }
  if (greeting === 'Morning') {
    return 'Start strong. The rest of your day follows the energy you put in right now.'
  }
  if (greeting === 'Afternoon') {
    return 'Midday check-in — stay on track and finish the day the way you started it.'
  }
  return 'Evening mode. Lock in your log, rest well, and come back stronger tomorrow.'
})
</script>
