<template>
  <div class="rounded-xl border border-slate-700 bg-gradient-to-r from-slate-800 to-slate-800/80 overflow-hidden">
    <!-- Button / Header -->
    <button
      v-if="!briefing && !loading"
      @click="briefMe"
      class="w-full flex items-center gap-3 p-3.5 hover:from-slate-700 hover:to-slate-700/80 transition-colors text-left"
    >
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 shrink-0 flex items-center justify-center">
        <Sparkles class="w-4 h-4 text-white" />
      </div>
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-200">Brief me on my day</div>
        <div class="text-xs text-slate-500">AI summary of your schedule, progress & priorities</div>
      </div>
      <ChevronRight class="w-4 h-4 text-slate-500 shrink-0 ml-auto" />
    </button>

    <!-- Loading state -->
    <div v-if="loading" class="p-3.5 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 shrink-0 flex items-center justify-center">
        <Sparkles class="w-4 h-4 text-white animate-pulse" />
      </div>
      <div class="text-sm text-slate-400">Thinking...</div>
    </div>

    <!-- Briefing result -->
    <div v-if="briefing && !loading" class="p-3.5">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-purple-500 shrink-0 flex items-center justify-center">
          <Sparkles class="w-3 h-3 text-white" />
        </div>
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Daily Briefing</div>
        <button
          @click="dismiss"
          class="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
      <p class="text-sm text-slate-300 leading-relaxed">{{ briefing }}</p>
    </div>

    <!-- Error state -->
    <div v-if="error && !loading" class="p-3.5">
      <div class="flex items-center gap-2">
        <p class="text-sm text-red-400">{{ error }}</p>
        <button @click="briefMe" class="text-xs text-blue-400 hover:text-blue-300 shrink-0">Retry</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Sparkles, ChevronRight, X } from 'lucide-vue-next'
import { supabase } from '@/lib/supabase'
import { useAiStore } from '@/stores/ai'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'
import { useCalendarStore } from '@/stores/calendar'
import { useUserStore } from '@/stores/user'

const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const goalsStore = useGoalsStore()
const calendarStore = useCalendarStore()
const userStore = useUserStore()
const aiStore = useAiStore()

const briefing = ref(null)
const loading = ref(false)
const error = ref(null)

function dismiss() {
  briefing.value = null
  error.value = null
}

async function briefMe() {
  loading.value = true
  error.value = null
  briefing.value = null

  // Build contextual prompt
  const parts = []

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

  const workout = fitnessStore.todaysWorkout
  if (workout?.is_rest_day) {
    parts.push('Today is a rest day.')
  } else if (workout) {
    const exerciseCount = workout.exercises?.length || 0
    parts.push(`Workout: ${workout.name} (${workout.focus}) — ${exerciseCount} exercises.`)
  }

  const mealProgress = mealsStore.weeklyMealProgress
  parts.push(`Meals this week: ${mealProgress.logged}/${mealProgress.planned} logged (${mealProgress.percentage}%).`)

  // Goals with countdown
  const destGoals = goalsStore.destinationGoals
  if (destGoals.length > 0) {
    const goalSummaries = destGoals.map(g => {
      const cd = goalsStore.goalCountdown(g)
      return `${g.title} (${goalsStore.goalProgress(g)}% done, ${cd?.label || 'no deadline'})`
    }).join(', ')
    parts.push(`Long-term goals: ${goalSummaries}.`)
  }

  const wc = fitnessStore.weeklyWorkoutCount
  parts.push(`Workouts this week: ${wc.completed}/${wc.planned}.`)

  if (userStore.dailyCheckinDone) {
    parts.push(`Energy: ${userStore.energy}, Sleep: ${userStore.sleepQuality}.`)
  }

  const prompt = `Give me a concise morning briefing. Here's my data:\n\n${parts.join('\n')}\n\nKeep it to 3-4 sentences. Be direct, not motivational. Tell me what I need to know.`

  try {
    const context = aiStore.buildContext()

    const { data, error: fnError } = await supabase.functions.invoke('ai-assistant', {
      body: {
        message: prompt,
        context,
        conversationHistory: [],
        difficulty: context.difficulty || 'medium',
      },
    })

    if (fnError) throw fnError

    briefing.value = data.message
  } catch (err) {
    error.value = 'Couldn\'t load briefing. Tap to retry.'
  } finally {
    loading.value = false
  }
}
</script>
