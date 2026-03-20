<template>
  <div class="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" @click.self="$emit('close')">
    <div class="bg-slate-800 rounded-t-2xl p-5 w-full max-w-md max-h-[70vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex justify-between items-start mb-4">
        <div>
          <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">{{ categoryLabel }}</div>
          <h3 class="text-lg font-bold">{{ goal.title }}</h3>
          <p v-if="goal.description" class="text-sm text-slate-400 mt-1">{{ goal.description }}</p>
        </div>
        <button @click="$emit('close')" class="text-slate-500 hover:text-slate-300">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Progress -->
      <div class="mb-4">
        <div class="flex justify-between text-sm mb-1.5">
          <span class="text-purple-400 font-bold">{{ progress }}%</span>
          <span v-if="countdown" class="text-slate-500">{{ countdown.label }} left</span>
        </div>
        <div class="bg-slate-700 rounded h-2">
          <div class="bg-purple-500 rounded h-full transition-all" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>

      <!-- Key Results -->
      <div v-if="goal.key_results?.length" class="mb-4">
        <div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Key Results</div>
        <div class="flex flex-col gap-2">
          <div v-for="kr in goal.key_results" :key="kr.id" class="bg-slate-750 rounded-lg p-3">
            <div class="flex justify-between text-sm mb-1">
              <span>{{ kr.title }}</span>
              <span class="text-slate-400">{{ kr.current_value }} / {{ kr.target_value }} {{ kr.unit }}</span>
            </div>
            <div class="bg-slate-600 rounded h-1">
              <div class="bg-purple-400 rounded h-full" :style="{ width: `${krProgress(kr)}%` }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Prescribed Trackers -->
      <div v-if="goalTrackers.length" class="mb-4">
        <div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Daily Targets</div>
        <div class="flex flex-col gap-1.5">
          <div v-for="t in goalTrackers" :key="t.id" class="flex justify-between text-sm bg-slate-750 rounded-lg px-3 py-2">
            <span>{{ trackerLabel(t) }}</span>
            <span class="text-slate-400">{{ t.daily_target }} {{ t.unit }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <router-link to="/goals" @click="$emit('close')" class="flex-1 text-center text-xs bg-slate-700 text-slate-300 py-2.5 rounded-lg">
          Edit Goal
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals'

const props = defineProps({
  goal: { type: Object, required: true }
})

const emit = defineEmits(['close'])
const goalsStore = useGoalsStore()

const progress = computed(() => goalsStore.goalProgress(props.goal))
const countdown = computed(() => goalsStore.goalCountdown(props.goal))

const categoryLabel = computed(() => {
  const labels = { body: 'Body', nutrition: 'Nutrition', performance: 'Performance' }
  return labels[props.goal.category] || 'Goal'
})

const goalTrackers = computed(() =>
  goalsStore.activeTrackers.filter(t => t.goal_id === props.goal.id)
)

function krProgress(kr) {
  if (!kr.target_value) return 0
  return Math.min(100, Math.round((kr.current_value / kr.target_value) * 100))
}

function trackerLabel(t) {
  if (t.tracker_type === 'supplement') return t.supplement_name
  const labels = { protein: 'Protein', calories: 'Calories', water: 'Water', workout_frequency: 'Workouts/week', body_weight: 'Monthly weigh-in' }
  return labels[t.tracker_type] || t.tracker_type
}
</script>
