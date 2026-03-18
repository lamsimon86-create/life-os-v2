<template>
  <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm font-medium text-slate-400">Goals</span>
      <Target class="w-4 h-4 text-slate-500" />
    </div>

    <template v-if="goalsStore.topGoals.length">
      <ul class="space-y-3">
        <li v-for="goal in goalsStore.topGoals" :key="goal.id">
          <div class="flex items-center justify-between mb-1">
            <span class="text-slate-200 text-sm font-medium truncate pr-2">{{ goal.title }}</span>
            <span class="text-slate-400 text-xs shrink-0">{{ goalsStore.goalProgress(goal) }}%</span>
          </div>
          <ProgressBar
            :value="goalsStore.goalProgress(goal)"
            :max="100"
            color="bg-brand-500"
          />
        </li>
      </ul>
    </template>

    <template v-else>
      <p class="text-slate-400 text-sm">No active goals yet.</p>
    </template>

    <router-link
      to="/goals"
      class="mt-3 inline-flex items-center gap-1 text-brand-400 text-sm font-medium hover:text-brand-300 transition-colors"
    >
      See all <ChevronRight class="w-4 h-4" />
    </router-link>
  </div>
</template>

<script setup>
import { Target, ChevronRight } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals'
import ProgressBar from '@/components/shared/ProgressBar.vue'

const goalsStore = useGoalsStore()
</script>
