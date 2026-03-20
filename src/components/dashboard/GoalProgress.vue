<template>
  <div>
    <div class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Goal Progress</div>

    <!-- Empty state -->
    <div v-if="goals.length === 0" class="bg-slate-800 rounded-xl p-4 text-center">
      <p class="text-sm text-slate-400">No active goals yet</p>
      <router-link to="/goals" class="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">
        Set your first goal
      </router-link>
    </div>

    <!-- Goal cards -->
    <div v-else class="flex flex-col gap-2">
      <router-link
        v-for="goal in goals"
        :key="goal.id"
        :to="{ path: '/goals', query: { expand: goal.id } }"
        class="bg-slate-800 rounded-xl p-3.5 block hover:bg-slate-750 transition-colors"
      >
        <!-- Title + progress % -->
        <div class="flex justify-between items-center mb-2">
          <div class="text-sm font-semibold truncate pr-2">{{ goal.title }}</div>
          <div class="text-xs font-bold text-purple-400 shrink-0">{{ progress(goal) }}%</div>
        </div>

        <!-- Progress bar -->
        <div class="bg-slate-700 rounded h-1.5 mb-2">
          <div
            class="bg-purple-500 rounded h-full transition-all duration-500"
            :style="{ width: `${progress(goal)}%` }"
          ></div>
        </div>

        <!-- Top 2 KRs -->
        <div class="flex flex-wrap gap-x-3 gap-y-0.5">
          <div
            v-for="kr in goal.key_results?.slice(0, 2)"
            :key="kr.id"
            class="text-[10px] text-slate-500"
          >
            {{ kr.title }}: <span class="text-slate-300">{{ kr.current_value }} / {{ kr.target_value }}</span>
          </div>
        </div>
      </router-link>

      <!-- View all link -->
      <router-link
        v-if="goalsStore.activeGoals.length > 3"
        to="/goals"
        class="text-xs text-blue-400 hover:text-blue-300 text-center mt-1"
      >
        View all {{ goalsStore.activeGoals.length }} goals
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGoalsStore } from '@/stores/goals'

const goalsStore = useGoalsStore()

const goals = computed(() => goalsStore.dashboardGoals)

function progress(goal) {
  return goalsStore.goalProgress(goal)
}
</script>
