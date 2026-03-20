<template>
  <div>
    <!-- Goals exist -->
    <div v-if="goals.length > 0" class="flex gap-2.5">
      <button
        v-for="goal in goals"
        :key="goal.id"
        @click="selectedGoal = goal"
        class="flex-1 bg-slate-800 rounded-xl p-3 text-left hover:bg-slate-750 transition-colors"
      >
        <div class="flex items-center gap-1.5 mb-1.5">
          <component :is="categoryIcon(goal.category)" class="w-3.5 h-3.5 text-slate-400" />
          <div class="text-xs font-semibold truncate">{{ goal.title }}</div>
        </div>
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-[10px] text-purple-400 font-bold">{{ goalsStore.goalProgress(goal) }}%</span>
          <span v-if="countdown(goal)" class="text-[10px] text-slate-500">{{ countdown(goal).label }}</span>
        </div>
        <div class="bg-slate-700 rounded h-1">
          <div
            class="bg-purple-500 rounded h-full transition-all duration-500"
            :style="{ width: `${goalsStore.goalProgress(goal)}%` }"
          ></div>
        </div>
      </button>
    </div>

    <!-- No goals -->
    <button
      v-else
      @click="$emit('createGoal')"
      class="w-full bg-slate-800 rounded-xl p-4 text-center hover:bg-slate-750 transition-colors"
    >
      <Target class="w-5 h-5 text-slate-500 mx-auto mb-1.5" />
      <div class="text-sm font-semibold text-slate-300">Set your first goal</div>
      <div class="text-xs text-slate-500 mt-0.5">AI will help you build a plan</div>
    </button>

    <!-- Goal detail sheet -->
    <GoalDetailSheet
      v-if="selectedGoal"
      :goal="selectedGoal"
      @close="selectedGoal = null"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Target, Dumbbell, UtensilsCrossed, Zap } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals'
import GoalDetailSheet from '@/components/goals/GoalDetailSheet.vue'

const emit = defineEmits(['createGoal'])
const goalsStore = useGoalsStore()

const goals = computed(() => goalsStore.destinationGoals)
const selectedGoal = ref(null)

function countdown(goal) {
  return goalsStore.goalCountdown(goal)
}

function categoryIcon(category) {
  if (category === 'body') return Dumbbell
  if (category === 'nutrition') return UtensilsCrossed
  if (category === 'performance') return Zap
  return Target
}
</script>
