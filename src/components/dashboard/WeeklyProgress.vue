<template>
  <div class="bg-slate-800 rounded-xl p-3">
    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">This Week</div>

    <div class="flex flex-col gap-3">
      <!-- Workouts Ring -->
      <div class="flex items-center gap-2">
        <div class="relative w-9 h-9 shrink-0">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#334155" stroke-width="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke="#22c55e" stroke-width="3"
              :stroke-dasharray="`${workoutDash} ${circumference}`"
              stroke-linecap="round"
              transform="rotate(-90 18 18)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-green-400">
            {{ wc.completed }}/{{ wc.planned }}
          </div>
        </div>
        <div>
          <div class="text-xs font-semibold">Workouts</div>
          <div class="text-[10px] text-slate-500">{{ wc.planned - wc.completed }} remaining</div>
        </div>
      </div>

      <!-- Meals Ring -->
      <div class="flex items-center gap-2">
        <div class="relative w-9 h-9 shrink-0">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#334155" stroke-width="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke="#3b82f6" stroke-width="3"
              :stroke-dasharray="`${mealDash} ${circumference}`"
              stroke-linecap="round"
              transform="rotate(-90 18 18)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-blue-400">
            {{ mp.percentage }}%
          </div>
        </div>
        <div>
          <div class="text-xs font-semibold">Meals</div>
          <div class="text-[10px] text-slate-500">{{ mp.logged }}/{{ mp.planned }} logged</div>
        </div>
      </div>

      <!-- Goals Ring -->
      <div class="flex items-center gap-2">
        <div class="relative w-9 h-9 shrink-0">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#334155" stroke-width="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke="#a78bfa" stroke-width="3"
              :stroke-dasharray="`${goalDash} ${circumference}`"
              stroke-linecap="round"
              transform="rotate(-90 18 18)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-purple-400">
            {{ goalProgress }}%
          </div>
        </div>
        <div>
          <div class="text-xs font-semibold">Goals</div>
          <div class="text-[10px] text-slate-500">{{ activeGoalCount }} active</div>
        </div>
      </div>
    </div>

    <!-- Last Workout -->
    <div v-if="lastWorkout" class="mt-3 pt-2 border-t border-slate-700">
      <div class="text-[10px] text-slate-500">
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
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'

const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const goalsStore = useGoalsStore()

const circumference = 2 * Math.PI * 15 // ~94.2

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
  return (wc.value.completed / wc.value.planned) * circumference
})

const mealDash = computed(() => (mp.value.percentage / 100) * circumference)

const goalDash = computed(() => (goalProgress.value / 100) * circumference)
</script>
