<template>
  <div class="bg-slate-800 rounded-xl p-3">
    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Today</div>

    <div class="flex flex-col gap-2">
      <!-- Workout -->
      <div class="flex items-start gap-2">
        <div
          class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
          :class="workoutStatus.class"
        >
          <Check v-if="workoutStatus.done" class="w-2.5 h-2.5" />
        </div>
        <div>
          <div class="text-xs font-semibold">{{ workoutStatus.title }}</div>
          <div class="text-[10px] text-slate-500">{{ workoutStatus.subtitle }}</div>
        </div>
      </div>

      <!-- Meals -->
      <div class="flex items-start gap-2">
        <div
          class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
          :class="mealStatus.class"
        >
          <Check v-if="mealStatus.done" class="w-2.5 h-2.5" />
        </div>
        <div>
          <div class="text-xs font-semibold">Meals</div>
          <div class="text-[10px] text-slate-500">{{ mealStatus.subtitle }}</div>
        </div>
      </div>

      <!-- Goals -->
      <div class="flex items-start gap-2">
        <div
          class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5"
          :class="goalStatus.class"
        ></div>
        <div>
          <div class="text-xs font-semibold">Goals</div>
          <div class="text-[10px] text-slate-500">{{ goalStatus.subtitle }}</div>
        </div>
      </div>

      <!-- Schedule (if connected) -->
      <div v-if="calendarStore.connected || calendarStore.todaysEvents.length > 0" class="flex items-start gap-2">
        <div class="w-[18px] h-[18px] rounded-full border-2 border-slate-500 shrink-0 mt-0.5"></div>
        <div>
          <div class="text-xs font-semibold">Schedule</div>
          <div class="text-[10px] text-slate-500">{{ scheduleSubtitle }}</div>
        </div>
      </div>
      <router-link
        v-else-if="!calendarStore.loading"
        to="/settings"
        class="text-[10px] text-blue-400 hover:text-blue-300 ml-7"
      >
        Connect calendar
      </router-link>

      <!-- Daily Check-in -->
      <div class="flex items-start gap-2">
        <div
          class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
          :class="userStore.dailyCheckinDone ? 'border-green-500 bg-green-500' : 'border-slate-500'"
        >
          <Check v-if="userStore.dailyCheckinDone" class="w-2.5 h-2.5 text-slate-900" />
        </div>
        <div>
          <div class="text-xs font-semibold">Daily Check-in</div>
          <div class="text-[10px] text-slate-500">
            {{ userStore.dailyCheckinDone
              ? `Energy: ${userStore.energy}, Sleep: ${userStore.sleepQuality}`
              : 'Energy & sleep not logged'
            }}
          </div>
        </div>
      </div>

      <!-- Hydration -->
      <div class="flex items-start gap-2">
        <div
          class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
          :class="hydrationStatus.class"
        >
          <Check v-if="hydrationStatus.done" class="w-2.5 h-2.5 text-slate-900" />
        </div>
        <div>
          <div class="text-xs font-semibold">Water</div>
          <div class="text-[10px] text-slate-500">{{ userStore.waterGlasses }}/8 glasses</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'
import { useUserStore } from '@/stores/user'
import { useCalendarStore } from '@/stores/calendar'

const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const goalsStore = useGoalsStore()
const userStore = useUserStore()
const calendarStore = useCalendarStore()

const workoutStatus = computed(() => {
  const workout = fitnessStore.todaysWorkout
  if (!fitnessStore.activeProgram) {
    return { title: 'No program', subtitle: 'Set up a program', class: 'border-slate-500', done: false }
  }
  if (workout?.is_rest_day) {
    return { title: 'Rest Day', subtitle: 'Recovery day', class: 'border-green-500 bg-green-500/20', done: false }
  }

  // Check if completed today
  const today = new Date().toISOString().split('T')[0]
  const completed = fitnessStore.recentLogs.find(
    l => l.finished_at && l.started_at?.split('T')[0] === today
  )

  if (completed) {
    return {
      title: `${workout?.name || 'Workout'}`,
      subtitle: `Done — ${completed.duration_min}min, +${completed.xp_earned} XP`,
      class: 'border-green-500 bg-green-500',
      done: true
    }
  }

  if (workout) {
    const count = workout.exercises?.length || 0
    return {
      title: workout.name,
      subtitle: `${workout.focus} · ${count} exercises`,
      class: 'border-green-500',
      done: false
    }
  }

  return { title: 'No workout today', subtitle: '', class: 'border-slate-500', done: false }
})

const mealStatus = computed(() => {
  const logged = mealsStore.todaysMeals?.length || 0
  // Count today's planned meals from plan_data
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayName = dayNames[new Date().getDay()]
  const todayPlan = mealsStore.weekPlan?.plan_data?.[todayName]
  const planned = todayPlan ? Object.keys(todayPlan).filter(k => todayPlan[k]).length : 4

  if (logged >= planned && planned > 0) {
    return { subtitle: `${logged}/${planned} logged today`, class: 'border-green-500 bg-green-500', done: true }
  }
  if (logged > 0) {
    return { subtitle: `${logged}/${planned} logged today`, class: 'border-amber-500', done: false }
  }
  return { subtitle: `0/${planned} logged today`, class: 'border-slate-500', done: false }
})

const goalStatus = computed(() => {
  const active = goalsStore.activeGoals
  if (active.length === 0) return { subtitle: 'No active goals', class: 'border-slate-500' }

  // Check for KRs with approaching deadlines (within 7 days)
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  let dueCount = 0
  active.forEach(g => {
    g.key_results?.forEach(kr => {
      if (kr.deadline && kr.deadline <= soon && kr.current_value < kr.target_value) {
        dueCount++
      }
    })
  })

  if (dueCount > 0) {
    return { subtitle: `${dueCount} key results due`, class: 'border-amber-500' }
  }
  return { subtitle: 'All on track', class: 'border-green-500' }
})

const hydrationStatus = computed(() => {
  const glasses = userStore.waterGlasses || 0
  if (glasses >= 8) return { class: 'border-green-500 bg-green-500', done: true }
  if (glasses > 0) return { class: 'border-amber-500', done: false }
  return { class: 'border-slate-500', done: false }
})

const scheduleSubtitle = computed(() => {
  const events = calendarStore.todaysEvents
  if (events.length === 0) return 'No events today'

  const next = calendarStore.nextEvent
  if (next) {
    const time = new Date(next.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `${events.length} event${events.length > 1 ? 's' : ''}, next at ${time}`
  }
  return `${events.length} event${events.length > 1 ? 's' : ''} today`
})
</script>
