<template>
  <div class="min-h-screen bg-slate-950 pb-24 pt-4 px-4">
    <!-- Page header -->
    <div class="mb-5">
      <h1 class="text-2xl font-bold text-slate-100">Meals</h1>
      <p class="text-sm text-slate-500 mt-0.5">Track nutrition, manage recipes, plan your week</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 rounded-xl bg-slate-900 p-1">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
        :class="
          activeTab === tab.id
            ? 'bg-brand-600 text-white shadow'
            : 'text-slate-400 hover:text-slate-200'
        "
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="mealsStore.loading" class="flex justify-center py-16">
      <LoadingSpinner />
    </div>

    <template v-else>
      <!-- TODAY TAB -->
      <div v-if="activeTab === 'today'" class="space-y-3">
        <MealSlot
          v-for="mealType in MEAL_TYPES"
          :key="mealType"
          :meal-type="mealType"
          :planned="getPlannedForToday(mealType)"
          :logged="getLoggedMeal(mealType)"
        />
      </div>

      <!-- RECIPES TAB -->
      <div v-else-if="activeTab === 'recipes'" class="space-y-4">
        <!-- Search + AI button -->
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              v-model="recipeSearch"
              type="text"
              placeholder="Search recipes..."
              class="w-full rounded-xl bg-slate-900 pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none border border-slate-800 focus:border-brand-600 transition-colors"
            />
          </div>
          <button
            class="shrink-0 flex items-center gap-1.5 rounded-xl bg-brand-600/20 border border-brand-600/30 px-3 py-2 text-sm font-medium text-brand-400 hover:bg-brand-600/30 transition-colors"
            @click="openAiRecipes"
          >
            <Sparkles :size="14" />
            Ask AI
          </button>
        </div>

        <!-- Empty state -->
        <EmptyState
          v-if="!filteredRecipes.length"
          title="No recipes yet"
          :description="recipeSearch ? 'No matches for your search.' : 'Ask AI for recipe suggestions or add your own.'"
        />

        <!-- Recipe grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RecipeCard
            v-for="recipe in filteredRecipes"
            :key="recipe.id"
            :recipe="recipe"
            @open="openRecipe"
          />
        </div>
      </div>

      <!-- PLAN TAB -->
      <div v-else-if="activeTab === 'plan'" class="space-y-5">
        <!-- Generate plan button -->
        <button
          class="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          @click="mealsStore.generatePlan()"
        >
          <Sparkles :size="16" />
          Generate This Week's Plan
        </button>

        <!-- Week plan by day -->
        <div v-if="mealsStore.weekPlan" class="space-y-3">
          <div
            v-for="day in weekDays"
            :key="day.key"
            class="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2"
          >
            <p class="text-sm font-semibold text-slate-300">{{ day.label }}</p>
            <div class="space-y-1">
              <div
                v-for="mealKey in ['breakfast', 'lunch', 'dinner']"
                :key="mealKey"
                class="flex items-center gap-2 text-xs"
              >
                <span class="capitalize text-slate-500 w-16 shrink-0">{{ mealKey }}</span>
                <span v-if="getDayMeal(day.key, mealKey)" class="text-slate-300">
                  {{ getDayMeal(day.key, mealKey) }}
                </span>
                <span v-else class="text-slate-700 italic">—</span>
              </div>
            </div>
          </div>
        </div>

        <!-- No plan yet -->
        <EmptyState
          v-else
          title="No plan for this week"
          description="Generate a personalized meal plan with AI."
        />

        <!-- Grocery list -->
        <div v-if="mealsStore.groceryList" class="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <div class="flex items-center gap-2">
            <ShoppingCart :size="16" class="text-brand-400" />
            <h3 class="text-sm font-semibold text-slate-200">Grocery List</h3>
          </div>
          <GroceryList :items="mealsStore.groceryList" />
        </div>
      </div>
    </template>

    <!-- Recipe detail modal -->
    <RecipeDetail
      v-if="selectedRecipe"
      :recipe="selectedRecipe"
      @close="selectedRecipe = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Search, Sparkles, ShoppingCart } from 'lucide-vue-next'
import { useMealsStore } from '@/stores/meals'
import { MEAL_TYPES } from '@/lib/constants'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import MealSlot from '@/components/meals/MealSlot.vue'
import RecipeCard from '@/components/meals/RecipeCard.vue'
import RecipeDetail from '@/components/meals/RecipeDetail.vue'
import GroceryList from '@/components/meals/GroceryList.vue'

const mealsStore = useMealsStore()

const activeTab = ref('today')
const recipeSearch = ref('')
const selectedRecipe = ref(null)

const tabs = [
  { id: 'today', label: 'Today' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'plan', label: 'Plan' },
]

const weekDays = [
  { key: 'sunday', label: 'Sunday' },
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
]

const filteredRecipes = computed(() => {
  const q = recipeSearch.value.trim().toLowerCase()
  if (!q) return mealsStore.recipes
  return mealsStore.recipes.filter((r) => r.name.toLowerCase().includes(q))
})

function getLoggedMeal(mealType) {
  return mealsStore.todaysMeals.find((m) => m.meal_type === mealType) || null
}

function getPlannedForToday(mealType) {
  if (!mealsStore.weekPlan?.plan_data) return null
  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  return mealsStore.weekPlan.plan_data[dayName]?.[mealType] || null
}

function getDayMeal(dayKey, mealKey) {
  return mealsStore.weekPlan?.plan_data?.[dayKey]?.[mealKey]?.name || null
}

function openRecipe(recipe) {
  selectedRecipe.value = recipe
}

function openAiRecipes() {
  mealsStore.openAiPanel = true
}

onMounted(() => {
  mealsStore.hydrate()
})
</script>
