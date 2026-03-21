<template>
  <!-- Skipped state -->
  <div v-if="skipped" class="rounded-xl bg-slate-900/50 border border-slate-800 p-4 opacity-50">
    <div class="flex items-center justify-between">
      <h4 class="font-semibold text-slate-500 text-sm line-through">{{ displayExercise.exercise_name }}</h4>
      <button
        class="text-xs text-blue-400 hover:text-blue-300"
        @click="skipped = false"
      >Undo Skip</button>
    </div>
  </div>

  <!-- Active card -->
  <div
    v-else
    class="rounded-xl bg-slate-900 border border-slate-800 p-4"
    :class="{ 'border-l-[3px] border-l-blue-500': isSwapped }"
  >
    <!-- Exercise header -->
    <div
      class="flex items-center justify-between mb-3"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h4 class="font-semibold text-white text-sm truncate">{{ displayExercise.exercise_name }}</h4>
          <span v-if="isSwapped" class="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">Swapped</span>
          <span v-if="newPR" class="text-[10px] font-bold text-amber-400 animate-pulse">NEW PR</span>
        </div>
        <p class="text-xs text-slate-500 mt-0.5">
          {{ exercise.target_sets }} sets &times;
          {{ exercise.target_reps_min }}{{ exercise.target_reps_max && exercise.target_reps_max !== exercise.target_reps_min ? '-' + exercise.target_reps_max : '' }} reps
          <span v-if="exercise.rest_seconds" class="ml-1 text-slate-600">| {{ exercise.rest_seconds }}s rest</span>
        </p>
        <p v-if="isSwapped" class="text-[10px] text-slate-600 mt-0.5">replaces {{ originalName }}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          v-if="isSwapped && completedSets === 0"
          class="text-[10px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded bg-slate-800"
          @click="undoSwap"
        >Undo</button>
        <button
          class="text-[10px] text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-slate-800"
          @click="showExerciseSearch = true"
        >Swap</button>
        <div
          v-if="completedSets > 0"
          class="text-xs font-medium px-2 py-1 rounded-full"
          :class="completedSets >= exercise.target_sets ? 'bg-green-600/20 text-green-400' : 'bg-brand-600/20 text-brand-400'"
        >
          {{ completedSets }}/{{ exercise.target_sets }}
        </div>
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
            <span v-if="getLoggedSet(setNum)?.rpe" class="text-[10px] text-amber-400">RPE {{ getLoggedSet(setNum).rpe }}</span>
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

          <!-- RPE dropdown -->
          <select
            v-model="rpeInputs[setNum]"
            class="bg-slate-700 border-none text-slate-400 rounded-md text-[10px] w-[38px] py-1 px-0.5"
          >
            <option value="">RPE</option>
            <option v-for="r in [6,7,8,9,10]" :key="r" :value="r">{{ r }}</option>
          </select>

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

    <!-- Exercise search modal -->
    <ExerciseSearch
      :visible="showExerciseSearch"
      title="Swap Exercise"
      @select="handleSwap"
      @close="showExerciseSearch = false"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { Check } from 'lucide-vue-next'
import ExerciseSearch from '@/components/fitness/ExerciseSearch.vue'
import { useFitnessStore } from '@/stores/fitness'

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
  currentPRs: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['log-set', 'swap', 'start-rest'])

// Swap state
const skipped = ref(false)
const swappedExercise = ref(null)
const showExerciseSearch = ref(false)
const rpeInputs = reactive({})
const newPR = ref(false)

const displayExercise = computed(() => swappedExercise.value || props.exercise)
const isSwapped = computed(() => !!swappedExercise.value)
const originalName = computed(() => props.exercise.exercise_name)

// Build reactive inputs for each set number
const setInputs = ref({})

function initInputs() {
  for (let i = 1; i <= props.exercise.target_sets; i++) {
    if (!setInputs.value[i]) {
      const prev = props.previousSets.find(s => s.set_number === i)
      setInputs.value[i] = {
        weight: prev ? prev.weight : '',
        reps: prev ? prev.reps : (props.exercise.target_reps_min || null)
      }
    }
  }
}

initInputs()

watch(() => props.exercise.target_sets, initInputs)
watch(() => props.previousSets, () => {
  for (let i = 1; i <= props.exercise.target_sets; i++) {
    if (!getLoggedSet(i) && !setInputs.value[i]?.weight) {
      const prev = props.previousSets.find(s => s.set_number === i)
      if (prev) {
        setInputs.value[i] = { weight: prev.weight, reps: prev.reps }
      }
    }
  }
}, { deep: true })

function stepWeight(setNum, delta) {
  if (!setInputs.value[setNum]) return
  const current = setInputs.value[setNum].weight || 0
  setInputs.value[setNum].weight = Math.max(0, current + delta)
}

function stepReps(setNum, delta) {
  if (!setInputs.value[setNum]) return
  const current = setInputs.value[setNum].reps || 0
  setInputs.value[setNum].reps = Math.max(1, current + delta)
}

function getLoggedSet(setNum) {
  return props.loggedSets.find(s => s.set_number === setNum)
}

const completedSets = computed(() => {
  return props.loggedSets.length
})

// Swap handlers
async function handleSwap(exercise) {
  const fitnessStore = useFitnessStore()
  swappedExercise.value = {
    ...props.exercise,
    exercise_name: exercise.name,
    _muscle_group: exercise.muscle_group
  }
  showExerciseSearch.value = false
  const lastSet = await fitnessStore.fetchLastWeightForExercise(exercise.name)
  setInputs.value = {}
  for (let i = 1; i <= props.exercise.target_sets; i++) {
    setInputs.value[i] = {
      weight: lastSet?.weight || '',
      reps: props.exercise.target_reps_min || 8
    }
  }
}

function undoSwap() {
  swappedExercise.value = null
  initInputs()
}

// Skip long-press
let skipTimer = null
function onPointerDown() {
  skipTimer = setTimeout(() => { skipped.value = true }, 600)
}
function onPointerUp() {
  clearTimeout(skipTimer)
}

function handleLogSet(setNum) {
  const input = setInputs.value[setNum]
  if (!input?.weight || !input?.reps) return

  emit('log-set', {
    exercise_name: displayExercise.value.exercise_name,
    set_number: setNum,
    weight: Number(input.weight),
    reps: Number(input.reps),
    is_warmup: false,
    rpe: rpeInputs[setNum] ? Number(rpeInputs[setNum]) : null,
    substituted_for: isSwapped.value ? originalName.value : null
  })

  emit('start-rest', displayExercise.value.rest_seconds || 90)

  // PR detection
  const prWeight = props.currentPRs[displayExercise.value.exercise_name]
  if (prWeight && Number(input.weight) > prWeight) {
    newPR.value = true
    setTimeout(() => { newPR.value = false }, 3000)
  }
}
</script>
