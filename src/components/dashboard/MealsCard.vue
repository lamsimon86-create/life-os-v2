<template>
  <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm font-medium text-slate-400">Today's Meals</span>
      <UtensilsCrossed class="w-4 h-4 text-slate-500" />
    </div>

    <!-- Planned meals from week plan -->
    <template v-if="plannedMeals.length">
      <ul class="space-y-1 mb-3">
        <li
          v-for="meal in plannedMeals"
          :key="meal.type"
          class="flex items-center justify-between text-sm"
        >
          <div class="flex items-center gap-2">
            <span class="text-slate-500 uppercase tracking-wide text-xs w-8">{{ meal.shortType }}</span>
            <span class="text-slate-200">{{ meal.name }}</span>
          </div>
          <span v-if="meal.logged" class="text-emerald-400">
            <CheckCircle class="w-3.5 h-3.5" />
          </span>
        </li>
      </ul>
    </template>

    <!-- No plan -->
    <template v-else>
      <p class="text-slate-400 text-sm mb-3">No meal plan for this week yet.</p>
    </template>

    <!-- Logged count -->
    <p class="text-slate-400 text-xs">
      {{ loggedCount }}/{{ totalPlanned }} meal{{ totalPlanned !== 1 ? 's' : '' }} logged today
    </p>

    <router-link
      to="/meals"
      class="mt-3 inline-flex items-center gap-1 text-brand-400 text-sm font-medium hover:text-brand-300 transition-colors"
    >
      View Recipes <ChevronRight class="w-4 h-4" />
    </router-link>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UtensilsCrossed, ChevronRight, CheckCircle } from 'lucide-vue-next'
import { useMealsStore } from '@/stores/meals'

const mealsStore = useMealsStore()

const TYPE_LABELS = { breakfast: 'B', lunch: 'L', dinner: 'D', snack: 'S' }
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']

const plannedMeals = computed(() => {
  const plan = mealsStore.weekPlan
  if (!plan?.plan_data) return []

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayData = plan.plan_data[today] || plan.plan_data[Object.keys(plan.plan_data)[new Date().getDay()]] || null
  if (!dayData) return []

  const loggedTypes = new Set(mealsStore.todaysMeals.map((m) => m.meal_type))

  return MEAL_ORDER
    .filter((type) => dayData[type])
    .map((type) => ({
      type,
      shortType: TYPE_LABELS[type] || type[0].toUpperCase(),
      name: dayData[type],
      logged: loggedTypes.has(type),
    }))
})

const loggedCount = computed(() => mealsStore.todaysMeals.length)

const totalPlanned = computed(() => {
  if (plannedMeals.value.length) return plannedMeals.value.length
  // Fall back to logged count if no plan
  return mealsStore.todaysMeals.length
})
</script>
