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
          <!-- Weight with steppers -->
          <div class="flex items-center gap-0.5">
            <button
              class="w-7 h-8 rounded-l-lg bg-slate-700 text-slate-300 text-sm font-bold active:bg-slate-600"
              @click="stepWeight(setNum, -5)"
            >&minus;</button>
            <input
              v-model.number="setInputs[setNum].weight"
              type="number"
              inputmode="decimal"
              placeholder="lbs"
              class="w-14 h-8 bg-slate-800 border-y border-slate-700 text-sm text-slate-100 text-center outline-none focus:border-brand-500"
            />
            <button
              class="w-7 h-8 rounded-r-lg bg-slate-700 text-slate-300 text-sm font-bold active:bg-slate-600"
              @click="stepWeight(setNum, 5)"
            >+</button>
          </div>

          <span class="text-slate-600 text-xs">&times;</span>

          <!-- Reps with steppers -->
          <div class="flex items-center gap-0.5">
            <button
              class="w-7 h-8 rounded-l-lg bg-slate-700 text-slate-300 text-sm font-bold active:bg-slate-600"
              @click="stepReps(setNum, -1)"
            >&minus;</button>
            <input
              v-model.number="setInputs[setNum].reps"
              type="number"
              inputmode="numeric"
              placeholder="reps"
              class="w-10 h-8 bg-slate-800 border-y border-slate-700 text-sm text-slate-100 text-center outline-none focus:border-brand-500"
            />
            <button
              class="w-7 h-8 rounded-r-lg bg-slate-700 text-slate-300 text-sm font-bold active:bg-slate-600"
              @click="stepReps(setNum, 1)"
            >+</button>
          </div>

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
  },
  userWeight: {
    type: Number,
    default: null
  },
  experience: {
    type: String,
    default: 'beginner'
  }
})

const emit = defineEmits(['log-set'])

// Build reactive inputs for each set number
const setInputs = reactive({})

// Estimate starting weight based on body weight and experience
const WEIGHT_RATIOS = {
  beginner:     { 'Squat': 0.5, 'Bench Press': 0.4, 'Deadlift': 0.6, 'Overhead Press': 0.25, 'Barbell Row': 0.35, 'Romanian Deadlift': 0.4, 'Incline Bench Press': 0.35, 'Dumbbell Bench Press': 0.15, 'Leg Press': 0.8, 'Hip Thrust': 0.5, 'Arnold Press': 0.1, 'Dumbbell Row': 0.15, 'Lat Pulldown': 0.4, 'Seated Cable Row': 0.35, 'Bulgarian Split Squat': 0.1, 'Barbell Curl': 0.2, 'Dumbbell Curl': 0.08, 'Hammer Curl': 0.08, 'Skull Crushers': 0.15, 'Preacher Curl': 0.15, 'Upright Row': 0.2 },
  intermediate: { 'Squat': 0.75, 'Bench Press': 0.6, 'Deadlift': 0.9, 'Overhead Press': 0.35, 'Barbell Row': 0.5, 'Romanian Deadlift': 0.6, 'Incline Bench Press': 0.5, 'Dumbbell Bench Press': 0.2, 'Leg Press': 1.2, 'Hip Thrust': 0.7, 'Arnold Press': 0.13, 'Dumbbell Row': 0.2, 'Lat Pulldown': 0.5, 'Seated Cable Row': 0.45, 'Bulgarian Split Squat': 0.13, 'Barbell Curl': 0.25, 'Dumbbell Curl': 0.1, 'Hammer Curl': 0.1, 'Skull Crushers': 0.2, 'Preacher Curl': 0.2, 'Upright Row': 0.25 },
  advanced:     { 'Squat': 1.0, 'Bench Press': 0.8, 'Deadlift': 1.2, 'Overhead Press': 0.45, 'Barbell Row': 0.65, 'Romanian Deadlift': 0.8, 'Incline Bench Press': 0.65, 'Dumbbell Bench Press': 0.25, 'Leg Press': 1.5, 'Hip Thrust': 0.9, 'Arnold Press': 0.17, 'Dumbbell Row': 0.25, 'Lat Pulldown': 0.6, 'Seated Cable Row': 0.55, 'Bulgarian Split Squat': 0.17, 'Barbell Curl': 0.3, 'Dumbbell Curl': 0.13, 'Hammer Curl': 0.13, 'Skull Crushers': 0.25, 'Preacher Curl': 0.25, 'Upright Row': 0.3 },
}

function estimateWeight(exerciseName) {
  if (!props.userWeight) return null
  const level = props.experience || 'beginner'
  const ratios = WEIGHT_RATIOS[level] || WEIGHT_RATIOS.beginner
  const ratio = ratios[exerciseName]
  if (!ratio) return null
  // Round to nearest 5
  return Math.round((props.userWeight * ratio) / 5) * 5 || 5
}

function initInputs() {
  for (let i = 1; i <= props.exercise.target_sets; i++) {
    if (!setInputs[i]) {
      const prev = props.previousSets.find(s => s.set_number === i)
      setInputs[i] = {
        weight: prev ? prev.weight : estimateWeight(props.exercise.exercise_name),
        reps: prev ? prev.reps : (props.exercise.target_reps_min || null)
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

function stepWeight(setNum, delta) {
  if (!setInputs[setNum]) return
  const current = setInputs[setNum].weight || 0
  setInputs[setNum].weight = Math.max(0, current + delta)
}

function stepReps(setNum, delta) {
  if (!setInputs[setNum]) return
  const current = setInputs[setNum].reps || 0
  setInputs[setNum].reps = Math.max(1, current + delta)
}

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
