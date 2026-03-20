<template>
  <div class="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
    <!-- Header row -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <component :is="mealIcon" :size="16" class="text-brand-400 shrink-0" />
        <span class="text-sm font-semibold text-slate-200 capitalize">{{ mealType }}</span>
      </div>
      <CheckCircle v-if="logged" :size="16" class="text-green-400 shrink-0" />
    </div>

    <!-- Planned meal -->
    <p v-if="planned && !logged" class="text-xs text-slate-400">
      Planned: <span class="text-slate-300">{{ planned.name }}</span>
    </p>

    <!-- Logged meal -->
    <div v-if="logged" class="space-y-1">
      <p class="text-sm text-slate-100 font-medium">{{ logged.name }}</p>
      <div class="flex items-center gap-3 text-xs text-slate-500">
        <span v-if="logged.calories">{{ logged.calories }} kcal</span>
        <span v-if="logged.protein_g">{{ logged.protein_g }}g protein</span>
      </div>
      <!-- Rating stars -->
      <div v-if="logged.rating" class="flex items-center gap-0.5 mt-1">
        <Star
          v-for="i in 5"
          :key="i"
          :size="12"
          :class="i <= logged.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'"
        />
      </div>
    </div>

    <!-- Log form -->
    <div v-if="!logged">
      <button
        v-if="!showForm"
        class="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
        @click="showForm = true"
      >
        <Plus :size="14" />
        Log meal
      </button>

      <div v-else class="space-y-2">
        <!-- Description field with AI estimation -->
        <div>
          <textarea
            v-model="form.description"
            placeholder="Describe what you ate (AI estimates macros)..."
            rows="2"
            class="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600 resize-none"
          ></textarea>
          <button
            v-if="form.description && !estimating"
            @click="estimateFromDescription"
            class="text-xs text-blue-400 hover:text-blue-300 mt-1"
          >
            Estimate macros with AI
          </button>
          <span v-if="estimating" class="text-xs text-slate-500 mt-1 block">Estimating...</span>
        </div>

        <input
          v-model="form.name"
          type="text"
          placeholder="Meal name"
          class="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600"
        />
        <div class="flex gap-2">
          <input
            v-model.number="form.calories"
            type="number"
            placeholder="Calories"
            class="w-1/2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600"
          />
          <input
            v-model.number="form.protein_g"
            type="number"
            placeholder="Protein (g)"
            class="w-1/2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600"
          />
        </div>
        <div class="flex gap-2">
          <button
            :disabled="!form.name.trim() || saving"
            class="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            @click="submit"
          >
            {{ saving ? 'Saving...' : 'Log' }}
          </button>
          <button
            class="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-400 hover:bg-slate-700 transition-colors"
            @click="cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- "Will you eat this again?" prompt -->
    <div v-if="showSavePrompt" class="mt-2 p-2 bg-slate-700/50 rounded-lg flex items-center justify-between">
      <span class="text-xs text-slate-300">Will you eat this again?</span>
      <div class="flex gap-2">
        <button @click="saveForReuse" class="text-xs text-blue-400 hover:text-blue-300">Yes, save it</button>
        <button @click="showSavePrompt = false" class="text-xs text-slate-500 hover:text-slate-300">No</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  CheckCircle,
  Plus,
  Star,
  Coffee,
  Salad,
  Utensils,
  Apple,
} from 'lucide-vue-next'
import { useMealsStore } from '@/stores/meals'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  mealType: {
    type: String,
    required: true,
  },
  planned: {
    type: Object,
    default: null,
  },
  logged: {
    type: Object,
    default: null,
  },
})

const mealsStore = useMealsStore()
const { show: showToast } = useToast()

const showForm = ref(false)
const saving = ref(false)
const estimating = ref(false)
const showSavePrompt = ref(false)

const form = ref({
  name: '',
  calories: null,
  protein_g: null,
  description: '',
  confidence: null,
})

// Store last logged meal data for the save-for-reuse prompt
const lastLoggedForm = ref(null)

const mealIcon = computed(() => {
  const icons = {
    breakfast: Coffee,
    lunch: Salad,
    dinner: Utensils,
    snack: Apple,
  }
  return icons[props.mealType] || Utensils
})

function cancel() {
  showForm.value = false
  form.value = { name: '', calories: null, protein_g: null, description: '', confidence: null }
}

async function estimateFromDescription() {
  if (!form.value.description) return
  estimating.value = true
  try {
    const result = await mealsStore.estimateMacros(form.value.description)
    form.value.calories = result.calories
    form.value.protein_g = result.protein
    form.value.confidence = result.confidence
    if (!form.value.name) form.value.name = form.value.description.slice(0, 50)
  } catch (e) {
    showToast('Could not estimate macros', 'error')
  } finally {
    estimating.value = false
  }
}

async function submit() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    const today = new Date().toISOString().split('T')[0]
    await mealsStore.logMeal({
      date: today,
      meal_type: props.mealType,
      name: form.value.name.trim(),
      calories: form.value.calories || null,
      protein_g: form.value.protein_g || null,
      description: form.value.description || null,
      confidence: form.value.confidence || null,
    })
    showToast('Meal logged!', 'success')

    // Show "eat again?" prompt if description and macros are present
    if (form.value.description && (form.value.calories || form.value.protein_g)) {
      lastLoggedForm.value = { ...form.value }
      showSavePrompt.value = true
    }

    cancel()
  } catch (err) {
    console.error('Failed to log meal:', err)
    showToast('Failed to log meal', 'error')
  } finally {
    saving.value = false
  }
}

async function saveForReuse() {
  const data = lastLoggedForm.value
  if (!data) {
    showSavePrompt.value = false
    return
  }
  await mealsStore.saveAsMeal({
    name: data.name || data.description?.slice(0, 50),
    description: data.description,
    calories: data.calories,
    protein: data.protein_g,
  })
  showSavePrompt.value = false
  showToast('Meal saved for reuse!', 'success')
}
</script>
