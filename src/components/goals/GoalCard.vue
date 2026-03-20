<template>
  <div
    class="rounded-xl bg-slate-900 p-4 space-y-3 border transition-colors"
    :class="expanded ? 'border-brand-500/60' : 'border-slate-800'"
  >
    <!-- Header -->
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <Target :size="16" class="text-brand-400 shrink-0" />
        <h3 class="text-sm font-semibold text-slate-100 truncate">{{ goal.title }}</h3>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          @click.stop="emit('toggleFocus', goal.id)"
          class="p-1 rounded transition-colors"
          :class="goal.is_focused ? 'text-yellow-400' : 'text-slate-500 hover:text-slate-300'"
          :title="goal.is_focused ? 'Unpin from dashboard' : 'Pin to dashboard'"
        >
          <Star class="w-4 h-4" :fill="goal.is_focused ? 'currentColor' : 'none'" />
        </button>
        <button
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
          :class="
            goal.status === 'active'
              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              : 'bg-brand-900/50 text-brand-400 hover:bg-brand-900 hover:text-brand-300'
          "
          @click="toggleStatus"
        >
          {{ goal.status === 'active' ? 'Pause' : 'Resume' }}
        </button>
        <button
          class="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
          aria-label="Delete goal"
          @click="confirmDelete"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Description -->
    <p v-if="goal.description" class="text-xs text-slate-400 leading-relaxed">
      {{ goal.description }}
    </p>

    <!-- Progress bar + percentage -->
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-xs text-slate-500">Progress</span>
        <span class="text-xs font-semibold text-brand-400">{{ progress }}%</span>
      </div>
      <ProgressBar :value="progress" :max="100" color="bg-brand-500" />
    </div>

    <!-- Key results -->
    <div v-if="goal.key_results && goal.key_results.length > 0" class="space-y-3 pt-1">
      <KeyResultRow
        v-for="kr in goal.key_results"
        :key="kr.id"
        :kr="kr"
      />
    </div>

    <!-- Add key result button -->
    <button
      class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-400 transition-colors pt-1"
      @click="emit('addKr', goal.id)"
    >
      <Plus :size="14" />
      Add key result
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Target, Trash2, Plus, Star } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals'
import ProgressBar from '@/components/shared/ProgressBar.vue'
import KeyResultRow from './KeyResultRow.vue'

const props = defineProps({
  goal: {
    type: Object,
    required: true,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['addKr', 'toggleFocus'])

const goalsStore = useGoalsStore()

const progress = computed(() => goalsStore.goalProgress(props.goal))

async function toggleStatus() {
  const next = props.goal.status === 'active' ? 'paused' : 'active'
  try {
    await goalsStore.updateGoalStatus(props.goal.id, next)
  } catch (err) {
    console.error('Failed to update goal status:', err)
  }
}

async function confirmDelete() {
  if (!confirm(`Delete "${props.goal.title}"? This cannot be undone.`)) return
  try {
    await goalsStore.deleteGoal(props.goal.id)
  } catch (err) {
    console.error('Failed to delete goal:', err)
  }
}
</script>
