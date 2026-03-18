<template>
  <div class="rounded-xl bg-slate-900 border border-slate-800 p-4">
    <!-- Exercise header -->
    <div class="flex items-center justify-between mb-3">
      <div>
        <h4 class="font-semibold text-white text-sm">{{ exercise.exercise_name }}</h4>
        <p class="text-xs text-slate-500 mt-0.5">
          {{ exercise.target_sets }} sets &times;
          {{ exercise.target_reps_min }}{{ exercise.target_reps_max && exercise.target_reps_max !== exercise.target_reps_min ? '-' + exercise.target_reps_max : '' }} reps
          <span v-if="exercise.rest_seconds" class="ml-1 text-slate-600">| {{ exercise.rest_seconds }}s rest</span>
        </p>
      </div>
      <div
        v-if="completedSets > 0"
        class="text-xs font-medium px-2 py-1 rounded-full"
        :class="completedSets >= exercise.target_sets ? 'bg-green-600/20 text-green-400' : 'bg-brand-600/20 text-brand-400'"
      >
        {{ completedSets }}/{{ exercise.target_sets }}
      </div>
    </div>

    <!-- Set rows -->
    <div class="space-y-2">
      <div
        v-for="setNum in exercise.target_sets"
        :key="setNum"
        class="flex items-center gap-2"
      >
        <!-- Set label -->
        <span class="text-xs text-slate-500 w-6 shrink-0 text-center">{{ setNum }}</span>

        <!-- Logged set display -->
        <template v-if="getLoggedSet(setNum)">
          <div class="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 text-sm text-slate-300">
            <span>{{ getLoggedSet(setNum).weight }} lbs</span>
            <span class="text-slate-600">&times;</span>
            <span>{{ getLoggedSet(setNum).reps }} reps</span>
            <Check :size="14" class="ml-auto text-green-500" />
          </div>
        </template>

        <!-- Input row for unlogged set -->
        <template v-else>
          <input
            v-model.number="setInputs[setNum].weight"
            type="number"
            inputmode="decimal"
            placeholder="lbs"
            class="w-20 rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100 text-center outline-none focus:border-brand-500 transition-colors"
          />
          <span class="text-slate-600 text-xs">&times;</span>
          <input
            v-model.number="setInputs[setNum].reps"
            type="number"
            inputmode="numeric"
            placeholder="reps"
            class="w-16 rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100 text-center outline-none focus:border-brand-500 transition-colors"
          />
          <button
            class="shrink-0 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-500 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!setInputs[setNum].weight || !setInputs[setNum].reps"
            @click="handleLogSet(setNum)"
          >
            Log
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, watch } from 'vue'
import { Check } from 'lucide-vue-next'

const props = defineProps({
  exercise: {
    type: Object,
    required: true
  },
  loggedSets: {
    type: Array,
    default: () => []
  },
  previousSets: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['log-set'])

// Build reactive inputs for each set number
const setInputs = reactive({})

function initInputs() {
  for (let i = 1; i <= props.exercise.target_sets; i++) {
    if (!setInputs[i]) {
      // Pre-fill from previous session if available
      const prev = props.previousSets.find(s => s.set_number === i)
      setInputs[i] = {
        weight: prev ? prev.weight : null,
        reps: prev ? prev.reps : null
      }
    }
  }
}

initInputs()

watch(() => props.exercise.target_sets, initInputs)
watch(() => props.previousSets, () => {
  for (let i = 1; i <= props.exercise.target_sets; i++) {
    if (!getLoggedSet(i) && !setInputs[i]?.weight) {
      const prev = props.previousSets.find(s => s.set_number === i)
      if (prev) {
        setInputs[i] = { weight: prev.weight, reps: prev.reps }
      }
    }
  }
}, { deep: true })

function getLoggedSet(setNum) {
  return props.loggedSets.find(s => s.set_number === setNum)
}

const completedSets = computed(() => {
  return props.loggedSets.length
})

function handleLogSet(setNum) {
  const input = setInputs[setNum]
  if (!input.weight || !input.reps) return

  emit('log-set', {
    exercise_name: props.exercise.exercise_name,
    set_number: setNum,
    weight: input.weight,
    reps: input.reps,
    is_warmup: false
  })
}
</script>
