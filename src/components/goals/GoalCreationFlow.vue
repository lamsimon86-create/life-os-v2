<template>
  <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
    <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto relative">
      <!-- Close button (all steps) -->
      <button @click="$emit('close')" class="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
        <X class="w-4 h-4" />
      </button>

      <!-- Step 1: Category -->
      <div v-if="step === 1">
        <h2 class="text-lg font-bold mb-1">What do you want to achieve?</h2>
        <p class="text-sm text-slate-400 mb-4">Pick a category</p>
        <div class="flex flex-col gap-2">
          <button
            v-for="cat in categories"
            :key="cat.value"
            @click="selectCategory(cat.value)"
            :disabled="isOccupied(cat.value)"
            class="flex items-center gap-3 p-4 rounded-xl text-left transition-colors"
            :class="isOccupied(cat.value) ? 'bg-slate-700/50 opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'"
          >
            <component :is="cat.icon" class="w-5 h-5 text-slate-300" />
            <div>
              <div class="text-sm font-semibold">{{ cat.label }}</div>
              <div class="text-xs text-slate-500">{{ cat.description }}</div>
              <div v-if="isOccupied(cat.value)" class="text-[10px] text-amber-400 mt-0.5">Already have an active goal</div>
            </div>
          </button>
        </div>
        <button @click="$emit('close')" class="w-full mt-3 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
      </div>

      <!-- Step 2: Input -->
      <div v-if="step === 2">
        <h2 class="text-lg font-bold mb-1">{{ categoryLabel }} Goal</h2>
        <p class="text-sm text-slate-400 mb-4">Describe what you want to achieve in your own words</p>
        <textarea
          v-model="userText"
          rows="3"
          placeholder="e.g., I want to get shredded by summer..."
          class="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-sm resize-none mb-4"
          autofocus
        ></textarea>
        <div class="flex gap-2">
          <button @click="step = 1" class="flex-1 py-2.5 rounded-lg bg-slate-700 text-sm text-slate-300">Back</button>
          <button
            @click="refineWithAI"
            :disabled="!userText.trim() || refining"
            class="flex-1 py-2.5 rounded-lg bg-blue-500 text-sm font-semibold text-white disabled:opacity-50"
          >
            {{ refining ? 'AI is thinking...' : 'Continue' }}
          </button>
        </div>
        <p v-if="error" class="text-xs text-red-400 mt-2">{{ error }}</p>
      </div>

      <!-- Step 3: Review -->
      <div v-if="step === 3 && refined">
        <h2 class="text-lg font-bold mb-1">Your Plan</h2>
        <p class="text-sm text-slate-400 mb-4">AI has refined your goal. Review and approve.</p>

        <!-- Refined goal -->
        <div class="bg-slate-700 rounded-xl p-4 mb-4">
          <div class="text-sm font-bold mb-1">{{ refined.refined_title }}</div>
          <div class="text-xs text-slate-400 mb-2">{{ refined.description }}</div>
          <div class="text-xs text-slate-500">
            Deadline: <span class="text-slate-300">{{ refined.deadline_days }} days</span>
          </div>
        </div>

        <!-- Key Results -->
        <div v-if="refined.key_results?.length" class="mb-4">
          <div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Milestones</div>
          <div class="flex flex-col gap-1.5">
            <div v-for="(kr, i) in refined.key_results" :key="i" class="bg-slate-700 rounded-lg px-3 py-2 text-sm">
              {{ kr.title }}: {{ kr.current_value || 0 }} → {{ kr.target_value }} {{ kr.unit }}
            </div>
          </div>
        </div>

        <!-- Prescribed Trackers -->
        <div v-if="refined.prescribed_trackers?.length" class="mb-4">
          <div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Daily Tracking Plan</div>
          <div class="flex flex-col gap-1.5">
            <div v-for="(t, i) in refined.prescribed_trackers" :key="i" class="bg-slate-700 rounded-lg px-3 py-2 flex justify-between items-start">
              <div>
                <div class="text-sm">{{ trackerLabel(t) }}: {{ t.daily_target }} {{ t.unit }}</div>
                <div class="text-[10px] text-slate-500">{{ t.reason }}</div>
              </div>
              <button @click="removeTracker(i)" class="text-slate-500 hover:text-red-400 ml-2 shrink-0">
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button @click="step = 2" class="flex-1 py-2.5 rounded-lg bg-slate-700 text-sm text-slate-300">Back</button>
          <button
            @click="approve"
            :disabled="approving"
            class="flex-1 py-2.5 rounded-lg bg-green-500 text-sm font-semibold text-white disabled:opacity-50"
          >
            {{ approving ? 'Setting up...' : 'Start This Goal' }}
          </button>
        </div>
        <p v-if="error" class="text-xs text-red-400 mt-2">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { X, Dumbbell, UtensilsCrossed, Zap } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals'

const emit = defineEmits(['close', 'created'])
const goalsStore = useGoalsStore()

const step = ref(1)
const category = ref(null)
const userText = ref('')
const refined = ref(null)
const refining = ref(false)
const approving = ref(false)
const error = ref(null)

const categories = [
  { value: 'body', label: 'Body', description: 'Physique, weight, composition', icon: Dumbbell },
  { value: 'nutrition', label: 'Nutrition', description: 'Diet, eating habits, consistency', icon: UtensilsCrossed },
  { value: 'performance', label: 'Performance', description: 'Strength, speed, endurance', icon: Zap }
]

const categoryLabel = computed(() => {
  const cat = categories.find(c => c.value === category.value)
  return cat?.label || ''
})

function isOccupied(cat) {
  return goalsStore.goalsByCategory[cat] !== null
}

function selectCategory(cat) {
  if (isOccupied(cat)) return
  category.value = cat
  step.value = 2
}

async function refineWithAI() {
  if (!userText.value.trim()) return
  refining.value = true
  error.value = null
  try {
    refined.value = await goalsStore.createGoalWithAI(category.value, userText.value.trim())
    step.value = 3
  } catch (e) {
    error.value = e.message || 'Something went wrong. Try again.'
  } finally {
    refining.value = false
  }
}

function removeTracker(index) {
  refined.value.prescribed_trackers.splice(index, 1)
}

async function approve() {
  approving.value = true
  try {
    await goalsStore.approveGoal(
      category.value,
      userText.value.trim(),
      refined.value,
      refined.value.prescribed_trackers || []
    )
    emit('created')
    emit('close')
  } catch (e) {
    error.value = e.message || 'Failed to save goal.'
  } finally {
    approving.value = false
  }
}

function trackerLabel(t) {
  if (t.type === 'supplement') return t.name || 'Supplement'
  const labels = { protein: 'Protein', calories: 'Calories', water: 'Water', workout_frequency: 'Workouts/week', body_weight: 'Monthly weigh-in' }
  return labels[t.type] || t.type
}
</script>
