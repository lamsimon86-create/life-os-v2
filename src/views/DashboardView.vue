<template>
  <div class="min-h-screen bg-slate-950 pb-10">
    <div class="max-w-lg mx-auto px-4 pt-8 space-y-4">

      <!-- Header -->
      <div class="mb-2">
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-2xl font-bold text-slate-100">
              {{ greeting }}, {{ userStore.name || 'there' }}
            </h1>
            <p class="text-slate-400 text-sm mt-0.5">{{ todayDate }}</p>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <!-- Streak pill -->
            <div class="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-1">
              <Flame class="w-3.5 h-3.5 text-orange-400" />
              <span class="text-orange-300 text-xs font-semibold">{{ userStore.streak }}</span>
            </div>
            <!-- XP/level badge -->
            <div class="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-1">
              <Zap class="w-3.5 h-3.5 text-purple-400" />
              <span class="text-purple-300 text-xs font-semibold">Lv{{ userStore.level }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- XP Progress bar -->
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <div class="flex items-center justify-between mb-2 text-xs text-slate-400">
          <span class="font-medium text-slate-300">{{ userStore.levelInfo?.title || 'Beginner' }}</span>
          <span>
            {{ userStore.xp }} / {{ xpNext }} XP
          </span>
        </div>
        <ProgressBar
          :value="userStore.xpProgress?.progress || 0"
          :max="100"
          color="bg-purple-500"
        />
      </div>

      <!-- Workout card -->
      <WorkoutCard />

      <!-- Meals card -->
      <MealsCard />

      <!-- Goals card -->
      <GoalsCard />

      <!-- AI insight -->
      <AiInsight />

    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { Flame, Zap } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'
import { getGreeting, formatDate } from '@/lib/constants'
import ProgressBar from '@/components/shared/ProgressBar.vue'
import WorkoutCard from '@/components/dashboard/WorkoutCard.vue'
import MealsCard from '@/components/dashboard/MealsCard.vue'
import GoalsCard from '@/components/dashboard/GoalsCard.vue'
import AiInsight from '@/components/dashboard/AiInsight.vue'

const userStore = useUserStore()
const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const goalsStore = useGoalsStore()

const greeting = computed(() => getGreeting())
const todayDate = computed(() => formatDate())

const xpNext = computed(() => {
  const progress = userStore.xpProgress
  return progress?.next?.xp ?? userStore.xp
})

onMounted(async () => {
  await Promise.all([
    userStore.profile ? Promise.resolve() : userStore.hydrate(),
    fitnessStore.activeProgram === undefined || fitnessStore.recentLogs.length === 0
      ? fitnessStore.hydrate()
      : Promise.resolve(),
    mealsStore.weekPlan === undefined
      ? mealsStore.hydrate()
      : Promise.resolve(),
    goalsStore.goals.length === 0
      ? goalsStore.hydrate()
      : Promise.resolve(),
  ])
})
</script>
