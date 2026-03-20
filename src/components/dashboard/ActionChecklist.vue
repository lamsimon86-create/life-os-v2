<template>
  <div class="bg-slate-800 rounded-xl overflow-hidden">
    <!-- Header with progress -->
    <div class="px-3.5 pt-3 pb-2">
      <div class="flex justify-between items-center mb-2">
        <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Today</div>
        <div class="text-xs text-slate-400 font-semibold">{{ doneCount }}/{{ totalItems }}</div>
      </div>
      <div class="bg-slate-700 rounded h-1.5">
        <div
          class="bg-green-500 rounded h-full transition-all duration-500"
          :style="{ width: totalItems > 0 ? `${(doneCount / totalItems) * 100}%` : '0%' }"
        ></div>
      </div>
    </div>

    <!-- Context rows (rest day, no program) -->
    <div v-for="row in contextRows" :key="row.key" class="px-3.5 py-3 border-t border-slate-700/50">
      <div class="flex justify-between items-center" :class="`border-l-[3px] ${row.borderClass} pl-3`">
        <div class="min-w-0 pr-3">
          <div class="text-sm font-semibold text-slate-400">{{ row.title }}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">{{ row.subtitle }}</div>
        </div>
        <button
          v-if="row.action"
          @click="row.action.handler"
          class="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold"
          :class="row.action.class"
        >
          {{ row.action.label }}
        </button>
      </div>
    </div>

    <!-- Incomplete items -->
    <div v-if="!allDone">
      <div
        v-for="item in incompleteItems"
        :key="item.key"
        class="px-3.5 py-3 border-t border-slate-700/50"
      >
        <div class="flex justify-between items-center" :class="`border-l-[3px] ${item.borderClass} pl-3`">
          <div class="min-w-0 pr-3">
            <div class="text-sm font-semibold">{{ item.title }}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">{{ item.subtitle }}</div>
          </div>
          <!-- Expand toggle for supplements -->
          <button
            v-if="item.expandable"
            @click="showSupplements = !showSupplements"
            class="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
          >
            <ChevronUp v-if="showSupplements" class="w-4 h-4" />
            <ChevronDown v-else class="w-4 h-4" />
          </button>
          <!-- Action button -->
          <button
            v-else-if="item.action"
            @click="item.action.handler"
            class="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold"
            :class="item.action.class"
          >
            {{ item.action.label }}
          </button>
        </div>

        <!-- Supplement checklist (expanded) -->
        <div v-if="item.key === 'supplements' && showSupplements" class="pl-3 mt-2 flex flex-col gap-1.5">
          <div
            v-for="supp in supplementStore.todaysSupplements"
            :key="supp.id"
            class="flex items-center justify-between"
          >
            <span class="text-xs" :class="supplementStore.isTaken(supp.id) ? 'text-slate-500 line-through' : ''">
              {{ supp.name }}
            </span>
            <button
              @click.stop="supplementStore.toggleSupplement(supp.id)"
              class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0"
              :class="supplementStore.isTaken(supp.id) ? 'border-teal-400 bg-teal-400' : 'border-slate-500 hover:border-teal-400'"
            >
              <Check v-if="supplementStore.isTaken(supp.id)" class="w-3 h-3 text-slate-900" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- All done state -->
    <div v-if="allDone" class="px-3.5 py-4 border-t border-slate-700/50 text-center">
      <div class="flex items-center justify-center gap-2">
        <span class="text-sm text-slate-300">All done for today</span>
        <Check class="w-4 h-4 text-green-500" />
      </div>
    </div>

    <!-- Collapsed completed counter -->
    <button
      v-if="completedItems.length > 0"
      @click="showCompleted = !showCompleted"
      class="w-full px-3.5 py-2.5 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-500 hover:text-slate-400 transition-colors"
    >
      <span>{{ completedItems.length }} completed</span>
      <ChevronUp v-if="showCompleted" class="w-3.5 h-3.5" />
      <ChevronDown v-else class="w-3.5 h-3.5" />
    </button>

    <!-- Expanded completed items -->
    <div v-if="showCompleted">
      <div
        v-for="item in completedItems"
        :key="item.key"
        class="px-3.5 py-2.5 border-t border-slate-700/50"
      >
        <div class="flex justify-between items-center" :class="`border-l-[3px] ${item.borderClass} pl-3`">
          <div class="min-w-0">
            <div class="text-sm text-slate-500">{{ item.title }}</div>
            <div class="text-[10px] text-slate-600 mt-0.5">{{ item.subtitle }}</div>
          </div>
          <Check class="w-4 h-4 text-green-500 shrink-0" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Check, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { getGreeting } from '@/lib/constants'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useUserStore } from '@/stores/user'
import { useSupplementStore } from '@/stores/supplement'

const emit = defineEmits(['openCheckin'])
const router = useRouter()
const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const userStore = useUserStore()
const supplementStore = useSupplementStore()

const showCompleted = ref(false)
const showSupplements = ref(false)

const today = computed(() => new Date().toISOString().split('T')[0])

const completedWorkoutLog = computed(() =>
  fitnessStore.recentLogs.find(
    l => l.finished_at && l.started_at?.split('T')[0] === today.value
  )
)

const workout = computed(() => fitnessStore.todaysWorkout)

const plannedMealCount = computed(() => {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayName = dayNames[new Date().getDay()]
  const todayPlan = mealsStore.weekPlan?.plan_data?.[todayName]
  if (!todayPlan) return 4
  return Object.keys(todayPlan).filter(k => todayPlan[k]).length
})

const mealsLogged = computed(() => mealsStore.todaysMeals?.length || 0)

const isWorkoutDone = computed(() => !!completedWorkoutLog.value)
const isMealsDone = computed(() => !mealsStore.nextMealToLog)
const isWaterDone = computed(() => (userStore.waterGlasses || 0) >= userStore.waterGoal)
const isSuppsDone = computed(() => {
  const s = supplementStore.supplementStatus
  return s.due > 0 && s.taken >= s.due
})
const isCheckinDone = computed(() => userStore.dailyCheckinDone)

const incompleteItems = computed(() => {
  const items = []

  // Workout
  if (fitnessStore.activeProgram && !workout.value?.is_rest_day && !isWorkoutDone.value && workout.value) {
    const count = workout.value.exercises?.length || 0
    items.push({
      key: 'workout',
      title: `${workout.value.name} — ${workout.value.focus}`,
      subtitle: `${count} exercises · ~${count * 8}min`,
      borderClass: 'border-green-500',
      action: {
        label: 'Start',
        class: 'bg-green-500 text-slate-900',
        handler: async () => {
          const logId = await fitnessStore.startWorkout(workout.value.id)
          if (logId) router.push(`/fitness/workout/${logId}`)
        }
      }
    })
  }

  // Meal
  const nextMeal = mealsStore.nextMealToLog
  if (nextMeal) {
    const typeLabel = nextMeal.type.charAt(0).toUpperCase() + nextMeal.type.slice(1)
    items.push({
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

  // Water
  if (!isWaterDone.value) {
    const glasses = userStore.waterGlasses || 0
    items.push({
      key: 'water',
      title: `Water — ${glasses}/${userStore.waterGoal} glasses`,
      subtitle: `${userStore.waterGoal - glasses} more to hit your goal`,
      borderClass: 'border-sky-400',
      action: {
        label: '+1',
        class: 'bg-sky-400 text-slate-900',
        handler: () => userStore.addWater()
      }
    })
  }

  // Supplements
  const suppStatus = supplementStore.supplementStatus
  if (suppStatus.due > 0 && !isSuppsDone.value) {
    items.push({
      key: 'supplements',
      title: `Supplements — ${suppStatus.taken}/${suppStatus.due}`,
      subtitle: `${suppStatus.due - suppStatus.taken} remaining`,
      borderClass: 'border-teal-400',
      expandable: true
    })
  }

  // Check-in
  if (!isCheckinDone.value) {
    items.push({
      key: 'checkin',
      title: 'Daily Check-in',
      subtitle: "How's your energy? How'd you sleep?",
      borderClass: 'border-slate-500',
      action: {
        label: 'Log',
        class: 'bg-slate-600 text-white',
        handler: () => emit('openCheckin')
      }
    })
  }

  // Smart ordering by time of day
  const greeting = getGreeting()
  if (greeting === 'Morning') {
    items.sort((a, b) => {
      if (a.key === 'meal') return -1
      if (b.key === 'meal') return 1
      return 0
    })
  } else if (greeting === 'Afternoon') {
    items.sort((a, b) => {
      if (a.key === 'workout') return -1
      if (b.key === 'workout') return 1
      return 0
    })
  } else if (greeting === 'Evening') {
    items.sort((a, b) => {
      if (a.key === 'meal') return -1
      if (b.key === 'meal') return 1
      if (a.key === 'checkin') return -1
      if (b.key === 'checkin') return 1
      return 0
    })
  }

  return items
})

const completedItems = computed(() => {
  const items = []

  if (isWorkoutDone.value && workout.value) {
    items.push({
      key: 'workout-done',
      title: workout.value.name || 'Workout',
      subtitle: `${completedWorkoutLog.value.duration_min}min, +${completedWorkoutLog.value.xp_earned} XP`,
      borderClass: 'border-green-500/50'
    })
  }

  if (isMealsDone.value) {
    items.push({
      key: 'meals-done',
      title: 'Meals',
      subtitle: `${mealsLogged.value}/${plannedMealCount.value} logged today`,
      borderClass: 'border-blue-500/50'
    })
  }

  if (isWaterDone.value) {
    const glasses = userStore.waterGlasses || 0
    items.push({
      key: 'water-done',
      title: `Water — ${glasses}/${userStore.waterGoal} glasses`,
      subtitle: 'Goal reached!',
      borderClass: 'border-sky-400/50'
    })
  }

  if (isSuppsDone.value) {
    const s = supplementStore.supplementStatus
    items.push({
      key: 'supps-done',
      title: `Supplements — ${s.taken}/${s.due}`,
      subtitle: 'All taken',
      borderClass: 'border-teal-400/50'
    })
  }

  if (isCheckinDone.value) {
    items.push({
      key: 'checkin-done',
      title: 'Daily Check-in',
      subtitle: `Energy: ${userStore.energy}, Sleep: ${userStore.sleepQuality}`,
      borderClass: 'border-slate-500/50'
    })
  }

  return items
})

const contextRows = computed(() => {
  const rows = []
  if (!fitnessStore.activeProgram) {
    rows.push({
      key: 'no-program',
      title: 'Set up a program',
      subtitle: 'Create your training program to get started',
      borderClass: 'border-green-500',
      action: {
        label: 'Setup',
        class: 'bg-green-500 text-slate-900',
        handler: () => router.push('/fitness')
      }
    })
  } else if (workout.value?.is_rest_day) {
    rows.push({
      key: 'rest-day',
      title: 'Rest Day — Recovery',
      subtitle: 'Let your body rebuild',
      borderClass: 'border-green-500/50'
    })
  }
  return rows
})

const totalItems = computed(() => incompleteItems.value.length + completedItems.value.length)
const doneCount = computed(() => completedItems.value.length)
const allDone = computed(() => totalItems.value > 0 && doneCount.value === totalItems.value)
</script>
