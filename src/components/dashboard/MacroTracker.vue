<template>
  <div class="flex flex-col gap-2">
    <!-- Protein -->
    <div class="bg-slate-800 rounded-xl p-3">
      <div class="flex justify-between items-center mb-1.5">
        <div class="text-xs font-semibold">Protein</div>
        <div class="text-xs text-slate-400">
          <span :class="proteinOnTrack ? 'text-green-400' : 'text-amber-400'">~{{ dailyProtein }}g</span>
          / {{ proteinTarget }}g
        </div>
      </div>
      <div class="bg-slate-700 rounded h-2">
        <div
          class="rounded h-full transition-all duration-500"
          :class="proteinOnTrack ? 'bg-green-500' : 'bg-amber-500'"
          :style="{ width: `${Math.min(proteinProgress, 100)}%` }"
        ></div>
      </div>
    </div>

    <!-- Calories -->
    <div class="bg-slate-800 rounded-xl p-3">
      <div class="flex justify-between items-center mb-1.5">
        <div class="text-xs font-semibold">Calories</div>
        <div class="text-xs text-slate-400">
          <span :class="calorieOnTrack ? 'text-green-400' : 'text-amber-400'">~{{ dailyCalories }}</span>
          / {{ calorieTarget }} kcal
        </div>
      </div>
      <div class="bg-slate-700 rounded h-2">
        <div
          class="rounded h-full transition-all duration-500"
          :class="calorieOnTrack ? 'bg-green-500' : 'bg-amber-500'"
          :style="{ width: `${Math.min(calorieProgress, 100)}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMealsStore } from '@/stores/meals'

const mealsStore = useMealsStore()

const dailyProtein = computed(() => mealsStore.dailyProtein)
const dailyCalories = computed(() => mealsStore.dailyCalories)
const proteinTarget = computed(() => mealsStore.proteinTarget)
const calorieTarget = computed(() => mealsStore.calorieTarget)

const proteinProgress = computed(() => proteinTarget.value > 0 ? (dailyProtein.value / proteinTarget.value) * 100 : 0)
const calorieProgress = computed(() => calorieTarget.value > 0 ? (dailyCalories.value / calorieTarget.value) * 100 : 0)

// "On track" = within reasonable range based on time of day
const proteinOnTrack = computed(() => proteinProgress.value >= 40 || new Date().getHours() < 12)
const calorieOnTrack = computed(() => calorieProgress.value >= 40 || new Date().getHours() < 12)
</script>
