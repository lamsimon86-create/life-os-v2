<template>
  <div class="bg-slate-800 rounded-xl p-3.5">
    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">This Week</div>

    <!-- Rings Row -->
    <div class="grid grid-cols-3 gap-2">
      <!-- Workouts -->
      <div class="flex flex-col items-center text-center">
        <div class="relative w-12 h-12 mb-1.5">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#334155" stroke-width="3" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke="#22c55e" stroke-width="3"
              :stroke-dasharray="`${workoutDash} ${ringCircumference}`"
              stroke-linecap="round"
              transform="rotate(-90 24 24)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-green-400">
            {{ wc.completed }}/{{ wc.planned }}
          </div>
        </div>
        <div class="text-[11px] font-semibold">Workouts</div>
        <div class="text-[10px] text-slate-500">{{ wc.planned - wc.completed }} left</div>
      </div>

      <!-- Meals -->
      <div class="flex flex-col items-center text-center">
        <div class="relative w-12 h-12 mb-1.5">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#334155" stroke-width="3" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke="#3b82f6" stroke-width="3"
              :stroke-dasharray="`${mealDash} ${ringCircumference}`"
              stroke-linecap="round"
              transform="rotate(-90 24 24)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-blue-400">
            {{ mp.percentage }}%
          </div>
        </div>
        <div class="text-[11px] font-semibold">Meals</div>
        <div class="text-[10px] text-slate-500">{{ mp.logged }}/{{ mp.planned }} logged</div>
      </div>

      <!-- Goals -->
      <div class="flex flex-col items-center text-center">
        <div class="relative w-12 h-12 mb-1.5">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#334155" stroke-width="3" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke="#a78bfa" stroke-width="3"
              :stroke-dasharray="`${goalDash} ${ringCircumference}`"
              stroke-linecap="round"
              transform="rotate(-90 24 24)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-purple-400">
            {{ goalProgress }}%
          </div>
        </div>
        <div class="text-[11px] font-semibold">Goals</div>
        <div class="text-[10px] text-slate-500">{{ activeGoalCount }} active</div>
      </div>
    </div>

    <!-- Footer: Water + Last Workout -->
    <div class="mt-3 pt-2.5 border-t border-slate-700 flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <Droplets class="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span class="text-[11px] text-slate-400">{{ userStore.weeklyWater }}/{{ weeklyWaterGoal }} glasses</span>
      </div>
      <div v-if="lastWorkout" class="text-[10px] text-slate-500 text-right">
        Last: {{ lastWorkout.name }}, {{ lastWorkout.duration }}min, +{{ lastWorkout.xp }} XP
      </div>
    </div>

    <!-- Volume Trend -->
    <div v-if="trend.direction !== 'flat'" class="mt-1">
      <div class="text-[10px]" :class="trend.direction === 'up' ? 'text-green-400' : 'text-red-400'">
        {{ trend.direction === 'up' ? '↑' : '↓' }} {{ trend.percentage }}% volume vs last week
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Droplets } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'
import { useUserStore } from '@/stores/user'

const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const goalsStore = useGoalsStore()
const userStore = useUserStore()

const ringCircumference = 2 * Math.PI * 20 // ~125.7

const wc = computed(() => fitnessStore.weeklyWorkoutCount)
const mp = computed(() => mealsStore.weeklyMealProgress)
const lastWorkout = computed(() => fitnessStore.lastCompletedWorkout)
const trend = computed(() => fitnessStore.volumeTrend)
const activeGoalCount = computed(() => goalsStore.activeGoals.length)

const goalProgress = computed(() => {
  const goals = goalsStore.activeGoals
  if (goals.length === 0) return 0
  const total = goals.reduce((sum, g) => sum + goalsStore.goalProgress(g), 0)
  return Math.round(total / goals.length)
})

const workoutDash = computed(() => {
  if (wc.value.planned === 0) return 0
  return (wc.value.completed / wc.value.planned) * ringCircumference
})

const mealDash = computed(() => (mp.value.percentage / 100) * ringCircumference)

const goalDash = computed(() => (goalProgress.value / 100) * ringCircumference)

const weeklyWaterGoal = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const daysElapsed = day === 0 ? 7 : day // Sunday = 7 days elapsed
  return userStore.waterGoal * daysElapsed
})
</script>
