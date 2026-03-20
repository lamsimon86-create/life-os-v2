<template>
  <div class="min-h-screen bg-slate-950 px-4 py-6">
    <div class="mx-auto max-w-md space-y-6">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-100">Goals</h1>
        <button
          class="rounded-lg p-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          aria-label="Add goal"
          @click="showCreationFlow = true"
        >
          <Plus :size="20" />
        </button>
      </div>

      <!-- Goal creation flow modal -->
      <GoalCreationFlow
        v-if="showCreationFlow"
        @close="showCreationFlow = false"
        @created="showCreationFlow = false"
      />

      <!-- Loading -->
      <LoadingSpinner v-if="goalsStore.loading" />

      <!-- Empty state -->
      <EmptyState
        v-else-if="!goalsStore.loading && goalsStore.goals.length === 0"
        title="No goals yet"
        description="Create your first goal to start tracking your progress."
      />

      <!-- Goal cards grouped by category -->
      <div v-else class="space-y-6">
        <!-- Categorized active goals -->
        <div v-for="cat in goalCategories" :key="cat.key">
          <div v-if="categorizedGoals[cat.key].length > 0">
            <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{{ cat.label }}</h2>
            <div class="space-y-4">
              <GoalCard
                v-for="goal in categorizedGoals[cat.key]"
                :key="goal.id"
                :goal="goal"
                :expanded="expandedGoalId === goal.id"
                @add-kr="openKrForm"
                @toggle-focus="toggleGoalFocus"
              />
            </div>
          </div>
        </div>

        <!-- Uncategorized / legacy goals -->
        <div v-if="uncategorizedGoals.length > 0">
          <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Other</h2>
          <div class="space-y-4">
            <GoalCard
              v-for="goal in uncategorizedGoals"
              :key="goal.id"
              :goal="goal"
              :expanded="expandedGoalId === goal.id"
              @add-kr="openKrForm"
              @toggle-focus="toggleGoalFocus"
            />
          </div>
        </div>
      </div>

      <!-- Key result add form (inline, anchored to active goal) -->
      <div
        v-if="activeKrGoalId"
        class="rounded-xl bg-slate-900 border border-brand-800/50 p-4 space-y-3"
      >
        <h2 class="text-sm font-semibold text-slate-200">Add Key Result</h2>
        <input
          v-model="newKr.title"
          type="text"
          placeholder="Key result title"
          class="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600"
        />
        <div class="grid grid-cols-2 gap-3">
          <input
            v-model.number="newKr.targetValue"
            type="number"
            min="1"
            placeholder="Target value"
            class="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600"
          />
          <input
            v-model="newKr.unit"
            type="text"
            placeholder="Unit (e.g. kg, km)"
            class="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600"
          />
        </div>
        <input
          v-model="newKr.deadline"
          type="date"
          class="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-400 outline-none focus:ring-2 focus:ring-brand-600"
        />
        <div class="flex gap-2 pt-1">
          <button
            :disabled="addingKr || !newKr.title.trim() || !newKr.targetValue"
            class="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            @click="addKeyResult"
          >
            {{ addingKr ? 'Adding...' : 'Add Key Result' }}
          </button>
          <button
            class="rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-700 transition-colors"
            @click="closeKrForm"
          >
            Cancel
          </button>
        </div>
        <p v-if="krError" class="text-xs text-red-400">{{ krError }}</p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { useGoalsStore } from '@/stores/goals'
import GoalCard from '@/components/goals/GoalCard.vue'
import GoalCreationFlow from '@/components/goals/GoalCreationFlow.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const goalsStore = useGoalsStore()

const route = useRoute()
const expandedGoalId = ref(route.query.expand || null)

// Creation flow state
const showCreationFlow = ref(false)

// Category grouping
const goalCategories = [
  { key: 'body', label: 'Body' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'performance', label: 'Performance' }
]

const categorizedGoals = computed(() => ({
  body: goalsStore.goals.filter(g => g.category === 'body'),
  nutrition: goalsStore.goals.filter(g => g.category === 'nutrition'),
  performance: goalsStore.goals.filter(g => g.category === 'performance')
}))

const uncategorizedGoals = computed(() =>
  goalsStore.goals.filter(g => !g.category)
)

// Key result form state
const activeKrGoalId = ref(null)
const addingKr = ref(false)
const krError = ref('')
const newKr = ref({ title: '', targetValue: null, unit: '', deadline: '' })

onMounted(() => {
  goalsStore.hydrate()
})

function toggleGoalFocus(goalId) {
  goalsStore.toggleFocus(goalId)
}

function openKrForm(goalId) {
  activeKrGoalId.value = goalId
  newKr.value = { title: '', targetValue: null, unit: '', deadline: '' }
  krError.value = ''
}

function closeKrForm() {
  activeKrGoalId.value = null
  krError.value = ''
}

async function addKeyResult() {
  if (!newKr.value.title.trim() || !newKr.value.targetValue) return
  addingKr.value = true
  krError.value = ''
  try {
    await goalsStore.addKeyResult(
      activeKrGoalId.value,
      newKr.value.title.trim(),
      newKr.value.targetValue,
      newKr.value.unit.trim() || null,
      newKr.value.deadline || null,
    )
    closeKrForm()
  } catch (err) {
    krError.value = 'Failed to add key result. Please try again.'
    console.error(err)
  } finally {
    addingKr.value = false
  }
}
</script>
