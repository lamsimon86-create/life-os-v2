<template>
  <div>
    <div class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Up Next</div>

    <!-- All done -->
    <div v-if="cards.length === 0" class="bg-slate-800 rounded-xl p-4 text-center">
      <p class="text-sm text-slate-400">You're all caught up</p>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="card in cards"
        :key="card.key"
        class="bg-slate-800 rounded-xl p-3.5"
        :class="`border-l-[3px] ${card.borderClass}`"
      >
        <div class="flex justify-between items-center">
          <div class="min-w-0 pr-3">
            <div class="text-sm font-semibold" :class="card.muted ? 'text-slate-500' : ''">{{ card.title }}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">{{ card.subtitle }}</div>
          </div>
          <button
            v-if="card.action"
            @click="card.action.handler"
            class="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold"
            :class="card.action.class"
          >
            {{ card.action.label }}
          </button>
          <Check v-else-if="card.muted" class="w-4 h-4 text-green-500 shrink-0" />
        </div>
        <!-- Supplement checklist -->
        <div v-if="card.supplements" class="w-full mt-2 flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
          <div
            v-for="supp in card.supplements"
            :key="supp.id"
            class="flex items-center justify-between"
          >
            <span class="text-xs" :class="supp.taken ? 'text-slate-500 line-through' : ''">{{ supp.name }}</span>
            <button
              @click.stop="supplementStore.toggleSupplement(supp.id)"
              class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0"
              :class="supp.taken ? 'border-teal-400 bg-teal-400' : 'border-slate-500 hover:border-teal-400'"
            >
              <Check v-if="supp.taken" class="w-3 h-3 text-slate-900" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Check } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useUserStore } from '@/stores/user'
import { useSupplementStore } from '@/stores/supplement'
import { getGreeting } from '@/lib/constants'

const emit = defineEmits(['openCheckin'])

const router = useRouter()
const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const userStore = useUserStore()
const supplementStore = useSupplementStore()

const cards = computed(() => {
  const result = []
  const incomplete = []
  const completed = []

  // Workout card
  const workout = fitnessStore.todaysWorkout
  const today = new Date().toISOString().split('T')[0]
  const completedLog = fitnessStore.recentLogs.find(
    l => l.finished_at && l.started_at?.split('T')[0] === today
  )

  if (!fitnessStore.activeProgram) {
    incomplete.push({
      key: 'workout-setup',
      title: 'Set up a program',
      subtitle: 'Create your training program to get started',
      borderClass: 'border-green-500',
      action: {
        label: 'Setup',
        class: 'bg-green-500 text-slate-900',
        handler: () => router.push('/fitness')
      }
    })
  } else if (workout?.is_rest_day) {
    completed.push({
      key: 'workout-rest',
      title: 'Rest Day — Recovery',
      subtitle: 'Let your body rebuild',
      borderClass: 'border-green-500/50',
      muted: false
    })
  } else if (completedLog) {
    completed.push({
      key: 'workout-done',
      title: `Completed: ${workout?.name || 'Workout'}`,
      subtitle: `${completedLog.duration_min}min, +${completedLog.xp_earned} XP`,
      borderClass: 'border-green-500/50',
      muted: true
    })
  } else if (workout) {
    const count = workout.exercises?.length || 0
    incomplete.push({
      key: 'workout',
      title: `${workout.name} — ${workout.focus}`,
      subtitle: `${count} exercises · ~${count * 8}min`,
      borderClass: 'border-green-500',
      action: {
        label: 'Start',
        class: 'bg-green-500 text-slate-900',
        handler: async () => {
          const logId = await fitnessStore.startWorkout(workout.id)
          if (logId) router.push(`/fitness/workout/${logId}`)
        }
      }
    })
  }

  // Meal card
  const nextMeal = mealsStore.nextMealToLog
  if (nextMeal) {
    const typeLabel = nextMeal.type.charAt(0).toUpperCase() + nextMeal.type.slice(1)
    incomplete.push({
      key: 'meal',
      title: `Log ${typeLabel}`,
      subtitle: nextMeal.planned ? `Planned: ${nextMeal.planned}` : 'No plan for this meal',
      borderClass: 'border-blue-500',
      action: {
        label: 'Log',
        class: 'bg-blue-500 text-white',
        handler: () => router.push('/meals')
      }
    })
  }

  // Hydration card (always visible)
  const glasses = userStore.waterGlasses || 0
  const waterGoal = userStore.waterGoal
  if (glasses < waterGoal) {
    incomplete.push({
      key: 'water',
      title: `Water — ${glasses}/${waterGoal} glasses`,
      subtitle: `${waterGoal - glasses} more to hit your goal`,
      borderClass: 'border-sky-400',
      action: {
        label: '+1',
        class: 'bg-sky-400 text-slate-900',
        handler: () => userStore.addWater()
      }
    })
  } else {
    completed.push({
      key: 'water-done',
      title: `Water — ${glasses}/${waterGoal} glasses`,
      subtitle: 'Goal reached!',
      borderClass: 'border-sky-400/50',
      muted: true
    })
  }

  // Supplement checklist card
  const suppStatus = supplementStore.supplementStatus
  if (suppStatus.due > 0) {
    if (suppStatus.taken < suppStatus.due) {
      incomplete.push({
        key: 'supplements',
        title: `Supplements — ${suppStatus.taken}/${suppStatus.due}`,
        subtitle: `${suppStatus.due - suppStatus.taken} remaining`,
        borderClass: 'border-teal-400',
        supplements: supplementStore.todaysSupplements.map(s => ({
          id: s.id,
          name: s.name,
          taken: supplementStore.isTaken(s.id)
        }))
      })
    } else {
      completed.push({
        key: 'supplements-done',
        title: `Supplements — ${suppStatus.taken}/${suppStatus.due}`,
        subtitle: 'All taken',
        borderClass: 'border-teal-400/50',
        muted: true
      })
    }
  }

  // Daily check-in card
  if (!userStore.dailyCheckinDone) {
    incomplete.push({
      key: 'checkin',
      title: 'Daily Check-in',
      subtitle: "How's your energy? How'd you sleep?",
      borderClass: 'border-slate-500',
      action: {
        label: 'Log',
        class: 'bg-slate-600 text-white',
        handler: () => {
          // Emit event for parent to handle (inline form or modal)
          emit('openCheckin')
        }
      }
    })
  }

  // Order by time of day
  const greeting = getGreeting()
  if (greeting === 'Morning') {
    // Breakfast first, then workout
    incomplete.sort((a, b) => {
      if (a.key === 'meal') return -1
      if (b.key === 'meal') return 1
      return 0
    })
  } else if (greeting === 'Afternoon') {
    // Workout first if not done
    incomplete.sort((a, b) => {
      if (a.key === 'workout') return -1
      if (b.key === 'workout') return 1
      return 0
    })
  } else if (greeting === 'Evening') {
    // Dinner first, then check-in
    incomplete.sort((a, b) => {
      if (a.key === 'meal') return -1
      if (b.key === 'meal') return 1
      if (a.key === 'checkin') return -1
      if (b.key === 'checkin') return 1
      return 0
    })
  }

  return [...incomplete, ...completed]
})
</script>
