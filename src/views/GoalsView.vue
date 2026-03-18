<template>
  <div class="min-h-screen bg-slate-950 px-4 py-6">
    <div class="mx-auto max-w-md space-y-6">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-100">Goals</h1>
        <button
          class="rounded-lg p-2 transition-colors"
          :class="showNewGoalForm ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'"
          aria-label="Add goal"
          @click="showNewGoalForm = !showNewGoalForm"
        >
          <Plus :size="20" />
        </button>
      </div>

      <!-- New goal form -->
      <div v-if="showNewGoalForm" class="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <h2 class="text-sm font-semibold text-slate-200">New Goal</h2>
        <input
          v-model="newGoal.title"
          type="text"
          placeholder="Goal title"
          class="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600"
        />
        <textarea
          v-model="newGoal.description"
          placeholder="Description (optional)"
          rows="2"
          class="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600 resize-none"
        />
        <input
          v-model="newGoal.targetDate"
          type="date"
          class="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-400 outline-none focus:ring-2 focus:ring-brand-600"
        />
        <div class="flex gap-2 pt-1">
          <button
            :disabled="creating || !newGoal.title.trim()"
            class="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            @click="createGoal"
          >
            {{ creating ? 'Creating...' : 'Create Goal' }}
          </button>
          <button
            class="rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-700 transition-colors"
            @click="cancelNewGoal"
          >
            Cancel
          </button>
        </div>
        <p v-if="createError" class="text-xs text-red-400">{{ createError }}</p>
      </div>

      <!-- Loading -->
      <LoadingSpinner v-if="goalsStore.loading" />

      <!-- Empty state -->
      <EmptyState
        v-else-if="!goalsStore.loading && goalsStore.goals.length === 0"
        title="No goals yet"
        description="Create your first goal to start tracking your progress."
      />

      <!-- Goal cards -->
      <div v-else class="space-y-4">
        <GoalCard
          v-for="goal in goalsStore.goals"
          :key="goal.id"
          :goal="goal"
          @add-kr="openKrForm"
        />
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
import { ref, onMounted } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals'
import GoalCard from '@/components/goals/GoalCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const goalsStore = useGoalsStore()

// New goal form state
const showNewGoalForm = ref(false)
const creating = ref(false)
const createError = ref('')
const newGoal = ref({ title: '', description: '', targetDate: '' })

// Key result form state
const activeKrGoalId = ref(null)
const addingKr = ref(false)
const krError = ref('')
const newKr = ref({ title: '', targetValue: null, unit: '', deadline: '' })

onMounted(() => {
  goalsStore.hydrate()
})

function cancelNewGoal() {
  showNewGoalForm.value = false
  newGoal.value = { title: '', description: '', targetDate: '' }
  createError.value = ''
}

async function createGoal() {
  if (!newGoal.value.title.trim()) return
  creating.value = true
  createError.value = ''
  try {
    await goalsStore.createGoal(
      newGoal.value.title.trim(),
      newGoal.value.description.trim(),
      newGoal.value.targetDate || null,
    )
    cancelNewGoal()
  } catch (err) {
    createError.value = 'Failed to create goal. Please try again.'
    console.error(err)
  } finally {
    creating.value = false
  }
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
