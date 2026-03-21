<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">

    <!-- Loading -->
    <div v-if="loading" class="flex min-h-screen items-center justify-center">
      <LoadingSpinner />
    </div>

    <!-- Error: no session -->
    <div v-else-if="!session" class="flex flex-col items-center justify-center min-h-screen px-6 gap-4">
      <p class="text-slate-400 text-sm">Workout session not found.</p>
      <button
        class="px-4 py-2 rounded-lg bg-slate-800 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
        @click="router.push('/fitness')"
      >
        Back to Fitness
      </button>
    </div>

    <!-- Active workout -->
    <template v-else>

      <!-- Sticky header -->
      <header class="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div class="flex items-center justify-between max-w-lg mx-auto">
          <button
            class="text-slate-400 hover:text-white transition-colors p-1"
            @click="confirmExit"
          >
            <ArrowLeft :size="20" />
          </button>
          <div class="text-center">
            <p class="text-sm font-semibold text-white">{{ programDayName }}</p>
            <p class="text-xs text-brand-400 tabular-nums">{{ elapsedDisplay }}</p>
          </div>
          <div class="w-7" />
        </div>
      </header>

      <!-- Exercise list -->
      <div class="max-w-lg mx-auto px-4 py-4 space-y-4 pb-28">
        <ExerciseCard
          v-for="exercise in exercises"
          :key="exercise.id"
          :exercise="exercise"
          :logged-sets="getSetsForExercise(exercise.exercise_name)"
          :previous-sets="getPreviousSetsForExercise(exercise.exercise_name)"
          :current-p-r-s="currentPRs"
          @log-set="handleLogSet($event, exercise)"
          @start-rest="startRestTimer"
          @swap="handleExerciseSwap"
        />
      </div>

      <!-- Rest timer -->
      <RestTimer
        :seconds="currentRestSeconds"
        :active="showRestTimer"
        @dismiss="showRestTimer = false"
        @adjust="(s) => currentRestSeconds = s"
      />

      <!-- Finish button -->
      <div class="fixed bottom-0 inset-x-0 z-20 bg-slate-950/90 backdrop-blur border-t border-slate-800 px-4 py-3">
        <div class="max-w-lg mx-auto">
          <button
            class="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 active:scale-[0.98] transition-all disabled:opacity-40"
            :disabled="finishing || loggedSets.length === 0"
            @click="handleFinish"
          >
            {{ finishing ? 'Finishing...' : 'Finish Workout' }}
          </button>
        </div>
      </div>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { useToast } from '@/composables/useToast'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import ExerciseCard from '@/components/fitness/ExerciseCard.vue'
import RestTimer from '@/components/fitness/RestTimer.vue'

const route = useRoute()
const router = useRouter()
const fitnessStore = useFitnessStore()
const authStore = useAuthStore()
const userStore = useUserStore()
const toast = useToast()

const loading = ref(true)
const finishing = ref(false)
const session = ref(null)
const programDay = ref(null)
const exercises = ref([])
const loggedSets = ref([])
const previousSets = ref([])
const showRestTimer = ref(false)
const currentRestSeconds = ref(90)
const currentPRs = ref({})

// Elapsed timer
const elapsedSeconds = ref(0)
let timerInterval = null

const elapsedDisplay = computed(() => {
  const h = Math.floor(elapsedSeconds.value / 3600)
  const m = Math.floor((elapsedSeconds.value % 3600) / 60)
  const s = elapsedSeconds.value % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const programDayName = computed(() => {
  return programDay.value?.name || 'Workout'
})

function getSetsForExercise(exerciseName) {
  return loggedSets.value.filter(s => s.exercise_name === exerciseName)
}

function getPreviousSetsForExercise(exerciseName) {
  return previousSets.value.filter(s => s.exercise_name === exerciseName)
}

async function handleLogSet(setData, exercise) {
  if (!session.value || !authStore.userId) return

  const fullSetData = {
    workout_log_id: session.value.id,
    user_id: authStore.userId,
    exercise_name: setData.exercise_name,
    set_number: setData.set_number,
    weight: setData.weight,
    reps: setData.reps,
    is_warmup: setData.is_warmup || false,
    rpe: setData.rpe || null,
    substituted_for: setData.substituted_for || null
  }

  try {
    await fitnessStore.logSet(fullSetData)
    loggedSets.value.push(fullSetData)

    // Rest timer triggered by ExerciseCard via @start-rest
  } catch (err) {
    console.error('Failed to log set:', err)
    toast.show('Failed to log set', 'error')
  }
}

function startRestTimer(seconds) {
  currentRestSeconds.value = seconds
  showRestTimer.value = true
}

function handleExerciseSwap({ original, substitute }) {
  // ExerciseCard handles swap display and weight prefill internally
}

async function handleFinish() {
  finishing.value = true
  try {
    const xp = await fitnessStore.finishWorkout()
    toast.show(`Workout complete! +${xp} XP`, 'success')
    router.push('/fitness')
  } catch (err) {
    console.error('Failed to finish workout:', err)
    toast.show('Failed to finish workout', 'error')
  } finally {
    finishing.value = false
  }
}

function confirmExit() {
  if (loggedSets.value.length > 0) {
    const ok = window.confirm('Leave workout? Your logged sets are saved, and you can resume later.')
    if (!ok) return
  }
  router.push('/fitness')
}

function startElapsedTimer(startedAt) {
  const start = new Date(startedAt).getTime()
  elapsedSeconds.value = Math.floor((Date.now() - start) / 1000)

  timerInterval = setInterval(() => {
    elapsedSeconds.value = Math.floor((Date.now() - start) / 1000)
  }, 1000)
}

onMounted(async () => {
  const logId = route.params.id
  if (!logId) {
    loading.value = false
    return
  }

  try {
    // Fetch the workout log
    const { data: logData, error: logError } = await supabase
      .from('v2_workout_logs')
      .select('*')
      .eq('id', logId)
      .single()

    if (logError || !logData) {
      loading.value = false
      return
    }

    session.value = logData
    fitnessStore.activeSession = logData

    // Fetch the program day with exercises
    if (logData.program_day_id) {
      const { data: dayData } = await supabase
        .from('v2_program_days')
        .select(`
          *,
          exercises:v2_program_exercises(*)
        `)
        .eq('id', logData.program_day_id)
        .single()

      if (dayData) {
        programDay.value = dayData
        exercises.value = (dayData.exercises || []).sort((a, b) => a.sort_order - b.sort_order)
      }

      // Fetch previously logged sets for this session (in case of resume)
      const { data: existingSets } = await supabase
        .from('v2_workout_sets')
        .select('*')
        .eq('workout_log_id', logId)
        .order('set_number', { ascending: true })

      loggedSets.value = existingSets || []

      // Fetch last session's sets for pre-fill
      const lastSets = await fitnessStore.fetchLastSessionSets(logData.program_day_id)
      previousSets.value = lastSets
    }

    // Fetch PRs for PR detection during workout
    await fitnessStore.fetchPersonalRecords()
    const prMap = {}
    for (const pr of fitnessStore.personalRecords) {
      prMap[pr.exercise_name] = pr.weight
    }
    currentPRs.value = prMap

    // Start the elapsed timer
    startElapsedTimer(logData.started_at)
  } catch (err) {
    console.error('Failed to load workout:', err)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  clearInterval(timerInterval)
})
</script>
