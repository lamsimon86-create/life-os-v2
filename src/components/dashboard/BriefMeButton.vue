<template>
  <button
    @click="briefMe"
    class="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-700 bg-gradient-to-r from-slate-800 to-slate-800/80 hover:from-slate-700 hover:to-slate-700/80 transition-colors text-left"
  >
    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-content-center shrink-0 flex justify-center">
      <Sparkles class="w-4 h-4 text-white" />
    </div>
    <div class="min-w-0">
      <div class="text-sm font-semibold text-slate-200">Brief me on my day</div>
      <div class="text-xs text-slate-500">AI summary of your schedule, progress & priorities</div>
    </div>
    <ChevronRight class="w-4 h-4 text-slate-500 shrink-0 ml-auto" />
  </button>
</template>

<script setup>
import { Sparkles, ChevronRight } from 'lucide-vue-next'
import { useAiStore } from '@/stores/ai'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'
import { useCalendarStore } from '@/stores/calendar'
import { useUserStore } from '@/stores/user'

const aiStore = useAiStore()
const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const goalsStore = useGoalsStore()
const calendarStore = useCalendarStore()
const userStore = useUserStore()

function briefMe() {
  // Build a contextual briefing prompt
  const parts = []

  // Calendar
  const events = calendarStore.todaysEvents
  if (events.length > 0) {
    const eventList = events.map(e => {
      const time = new Date(e.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      return `${time}: ${e.title}`
    }).join(', ')
    parts.push(`Today's schedule: ${eventList}`)
  } else {
    parts.push('No calendar events today.')
  }

  // Workout
  const workout = fitnessStore.todaysWorkout
  if (workout?.is_rest_day) {
    parts.push('Today is a rest day.')
  } else if (workout) {
    const exerciseCount = workout.exercises?.length || 0
    parts.push(`Workout: ${workout.name} (${workout.focus}) — ${exerciseCount} exercises.`)
  }

  // Meals
  const mealProgress = mealsStore.weeklyMealProgress
  parts.push(`Meals this week: ${mealProgress.logged}/${mealProgress.planned} logged (${mealProgress.percentage}%).`)

  // Goals
  const goals = goalsStore.dashboardGoals
  if (goals.length > 0) {
    const goalList = goals.map(g => `${g.title} (${goalsStore.goalProgress(g)}%)`).join(', ')
    parts.push(`Focus goals: ${goalList}.`)
  }

  // Weekly fitness
  const wc = fitnessStore.weeklyWorkoutCount
  parts.push(`Workouts this week: ${wc.completed}/${wc.planned}.`)

  // Energy/sleep
  if (userStore.dailyCheckinDone) {
    parts.push(`Energy: ${userStore.energy}, Sleep: ${userStore.sleepQuality}.`)
  }

  const prompt = `Give me a concise morning briefing. Here's my data:\n\n${parts.join('\n')}\n\nKeep it to 3-4 sentences. Be direct, not motivational. Tell me what I need to know.`

  aiStore.openWithMessage(prompt)
}
</script>
