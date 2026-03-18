<template>
  <div class="px-4 py-5 space-y-5">

    <!-- Loading -->
    <div v-if="fitnessStore.loading" class="flex justify-center py-16">
      <LoadingSpinner />
    </div>

    <template v-else>

      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-900 rounded-xl p-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="flex-1 py-2 text-xs font-medium rounded-lg transition-colors"
          :class="activeTab === tab.id
            ? 'bg-brand-600 text-white'
            : 'text-slate-400 hover:text-slate-200'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- ===== DASHBOARD TAB ===== -->
      <template v-if="activeTab === 'dashboard'">

        <!-- No program state — smart selection -->
        <template v-if="!fitnessStore.activeProgram">
          <div class="space-y-5">
            <!-- AI Program Builder (primary) -->
            <div class="rounded-xl bg-brand-600/10 border border-brand-600/30 p-5">
              <h3 class="text-lg font-bold text-white mb-1">Build My Program</h3>
              <p class="text-sm text-slate-400 mb-4">AI builds a program tailored to your goals, experience, and schedule.</p>
              <button
                class="w-full py-3 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 active:scale-[0.98] transition-all"
                @click="aiStore.openWithMessage('Build me a workout program based on my profile')"
              >
                Build My Program
              </button>
            </div>

            <!-- Quick Start Templates (fallback) -->
            <div v-if="filteredTemplates.length > 0">
              <h4 class="text-sm font-medium text-slate-500 mb-3">Or pick a template</h4>
              <div class="space-y-2">
                <button
                  v-for="tmpl in filteredTemplates"
                  :key="tmpl.name"
                  class="w-full rounded-xl bg-slate-900 border border-slate-800 p-4 text-left hover:border-brand-500/50 transition-colors"
                  :disabled="creating"
                  @click="selectTemplate(tmpl)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-white">{{ tmpl.name }}</span>
                        <span
                          v-if="tmpl.name === recommendedTemplate"
                          class="px-1.5 py-0.5 text-[10px] font-medium bg-brand-600/20 text-brand-400 rounded"
                        >
                          Recommended
                        </span>
                      </div>
                      <p class="text-xs text-slate-400 mt-1">{{ tmpl.rationale }}</p>
                    </div>
                  </div>
                  <!-- Injury warnings -->
                  <div
                    v-if="getInjuryWarnings(tmpl).length > 0"
                    class="mt-2 px-2 py-1.5 rounded bg-amber-600/10 border border-amber-600/20"
                  >
                    <p v-for="warning in getInjuryWarnings(tmpl)" :key="warning" class="text-[11px] text-amber-400">
                      {{ warning }}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <!-- 2-day users: no templates, nudge to AI -->
            <p v-else class="text-sm text-slate-500 text-center">
              With {{ userPrefs.available_days }} days/week, a custom AI program is your best bet.
            </p>
          </div>
        </template>

        <!-- Has program -->
        <template v-else>
          <!-- Active program -->
          <ProgramCard :program="fitnessStore.activeProgram" />

          <!-- Change program -->
          <button
            class="w-full text-xs text-slate-500 hover:text-slate-300 transition py-1"
            @click="changeProgram"
          >
            Change Program
          </button>

          <!-- Today's workout card -->
          <div class="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <h3 class="text-sm font-semibold text-white mb-2">Today's Workout</h3>

            <!-- Rest day -->
            <div v-if="!fitnessStore.todaysWorkout || fitnessStore.todaysWorkout.is_rest_day" class="text-center py-4">
              <Coffee :size="28" class="mx-auto text-slate-600 mb-2" />
              <p class="text-sm text-slate-400">Rest day. Recover and come back stronger.</p>
            </div>

            <!-- Already completed today -->
            <div v-else-if="todayCompleted" class="text-center py-4">
              <CheckCircle :size="28" class="mx-auto text-green-500 mb-2" />
              <p class="text-sm text-green-400 font-medium">Workout complete!</p>
              <p class="text-xs text-slate-500 mt-1">
                {{ todayCompletedLog?.duration_min || 0 }} min | +{{ todayCompletedLog?.xp_earned || 0 }} XP
              </p>
            </div>

            <!-- Training day - ready to go -->
            <div v-else>
              <p class="text-sm text-slate-300 mb-1">{{ fitnessStore.todaysWorkout.name }}</p>
              <p v-if="fitnessStore.todaysWorkout.focus" class="text-xs text-slate-500">{{ fitnessStore.todaysWorkout.focus }}</p>
              <p v-if="fitnessStore.todaysWorkout.focus" class="text-xs text-slate-500 mb-3">{{ fitnessStore.todaysWorkout.focus }}</p>
              <div v-if="fitnessStore.todaysWorkout.exercises" class="text-xs text-slate-500 mb-3 space-y-0.5">
                <p v-for="ex in fitnessStore.todaysWorkout.exercises" :key="ex.id">
                  {{ ex.exercise_name }} &mdash; {{ ex.target_sets }}&times;{{ ex.target_reps_min }}{{ ex.target_reps_max && ex.target_reps_max !== ex.target_reps_min ? '-' + ex.target_reps_max : '' }}
                </p>
              </div>

              <!-- Resume in-progress or start new -->
              <button
                v-if="fitnessStore.activeSession"
                class="w-full py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 active:scale-[0.98] transition-all"
                @click="resumeWorkout"
              >
                Resume Workout
              </button>
              <button
                v-else
                class="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 active:scale-[0.98] transition-all"
                :disabled="starting"
                @click="handleStartWorkout"
              >
                {{ starting ? 'Starting...' : 'Start Workout' }}
              </button>
            </div>
          </div>

          <!-- Stats row -->
          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-xl bg-slate-900 border border-slate-800 p-3 text-center">
              <p class="text-lg font-bold text-white">{{ fitnessStore.workoutStreak }}</p>
              <p class="text-xs text-slate-500">Streak</p>
            </div>
            <div class="rounded-xl bg-slate-900 border border-slate-800 p-3 text-center">
              <p class="text-lg font-bold text-white">{{ weeklyWorkouts }}</p>
              <p class="text-xs text-slate-500">This Week</p>
            </div>
            <div class="rounded-xl bg-slate-900 border border-slate-800 p-3 text-center">
              <p class="text-lg font-bold text-white">{{ formatVolume(fitnessStore.weeklyVolume) }}</p>
              <p class="text-xs text-slate-500">Volume</p>
            </div>
          </div>

          <!-- Recent workouts -->
          <div v-if="fitnessStore.recentLogs.length > 0">
            <h3 class="text-sm font-semibold text-white mb-2">Recent Workouts</h3>
            <div class="space-y-2">
              <div
                v-for="log in fitnessStore.recentLogs"
                :key="log.id"
                class="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-2.5"
              >
                <div>
                  <p class="text-sm text-slate-200">{{ formatLogDate(log.started_at) }}</p>
                  <p class="text-xs text-slate-500">{{ log.duration_min || 0 }} min</p>
                </div>
                <span
                  v-if="log.xp_earned"
                  class="text-xs font-medium text-brand-400"
                >
                  +{{ log.xp_earned }} XP
                </span>
              </div>
            </div>
          </div>
        </template>
      </template>

      <!-- ===== HISTORY TAB ===== -->
      <template v-if="activeTab === 'history'">
        <HistoryChart :logs="fitnessStore.recentLogs" />
      </template>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Coffee, CheckCircle } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'
import { useAiStore } from '@/stores/ai'
import { useUserStore } from '@/stores/user'
import { useToast } from '@/composables/useToast'
import { getWeekStart } from '@/lib/constants'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import ProgramCard from '@/components/fitness/ProgramCard.vue'
import HistoryChart from '@/components/fitness/HistoryChart.vue'

const fitnessStore = useFitnessStore()
const aiStore = useAiStore()
const userStore = useUserStore()
const router = useRouter()
const toast = useToast()

const activeTab = ref('dashboard')
const creating = ref(false)
const starting = ref(false)
const showPreview = ref(false)

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'history', label: 'History' }
]

// Check if today already has a completed workout
const todayCompleted = computed(() => {
  return !!todayCompletedLog.value
})

const todayCompletedLog = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return fitnessStore.recentLogs.find(log => {
    if (!log.finished_at) return false
    const logDate = new Date(log.started_at).toISOString().split('T')[0]
    return logDate === today
  }) || null
})

const weeklyWorkouts = computed(() => {
  const weekStart = getWeekStart()
  return fitnessStore.recentLogs.filter(log => {
    if (!log.finished_at) return false
    return log.started_at >= weekStart
  }).length
})

function formatVolume(vol) {
  if (vol >= 1000000) return (vol / 1000000).toFixed(1) + 'M'
  if (vol >= 1000) return (vol / 1000).toFixed(1) + 'k'
  return String(vol)
}

function formatLogDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

async function selectTemplate(tmpl) {
  creating.value = true
  try {
    await fitnessStore.createProgramFromTemplate(tmpl)
    toast.show('Program created!', 'success')
  } catch (err) {
    console.error('Failed to create program:', err)
    toast.show('Failed to create program', 'error')
  } finally {
    creating.value = false
  }
}

async function changeProgram() {
  if (!confirm('Switch programs? Your workout history will be kept.')) return
  try {
    await fitnessStore.deactivateProgram()
    toast.show('Program deactivated', 'info')
  } catch (err) {
    toast.show('Failed to change program', 'error')
  }
}

async function handleStartWorkout() {
  if (!fitnessStore.todaysWorkout) return

  starting.value = true
  try {
    const logId = await fitnessStore.startWorkout(fitnessStore.todaysWorkout.id)
    router.push(`/fitness/workout/${logId}`)
  } catch (err) {
    console.error('Failed to start workout:', err)
    toast.show('Failed to start workout', 'error')
  } finally {
    starting.value = false
  }
}

function resumeWorkout() {
  if (fitnessStore.activeSession) {
    router.push(`/fitness/workout/${fitnessStore.activeSession.id}`)
  }
}

onMounted(() => {
  fitnessStore.hydrate()
})

// ==========================================
// Smart program selection
// ==========================================

const userPrefs = computed(() => userStore.preferences || {})

const INJURY_RULES = [
  { keyword: 'knee', exercises: ['Squat', 'Lunges', 'Bulgarian Split Squat', 'Leg Press', 'Leg Extension'] },
  { keyword: 'back', exercises: ['Deadlift', 'Barbell Row', 'Squat'] },
  { keyword: 'spine', exercises: ['Deadlift', 'Barbell Row', 'Squat'] },
  { keyword: 'shoulder', exercises: ['Overhead Press', 'Arnold Press', 'Bench Press', 'Incline Bench Press'] },
  { keyword: 'wrist', exercises: ['Bench Press', 'Push-Ups', 'Barbell Curl'] },
  { keyword: 'elbow', exercises: ['Skull Crushers', 'Tricep Pushdown', 'Barbell Curl'] },
]

const TEMPLATE_RATIONALES = {
  'Push/Pull/Legs (6-day)': 'High volume, high frequency. Best for experienced lifters ready to push hard.',
  'Upper/Lower (4-day)': 'Balanced split with good recovery. Great for intermediate lifters.',
  'Full Body (3-day)': 'Hits every muscle each session. Ideal for beginners or limited schedules.',
}

const filteredTemplates = computed(() => {
  const days = userPrefs.value.available_days
  if (!days || days <= 2) return []
  return templates.filter(t => {
    const trainingDays = t.days.filter(d => !d.is_rest_day).length
    if (days <= 3) return trainingDays <= 3
    if (days <= 4) return trainingDays <= 4
    if (days <= 6) return trainingDays >= 4
    return true // 7 days: show all
  }).map(t => ({ ...t, rationale: TEMPLATE_RATIONALES[t.name] || t.description }))
})

const recommendedTemplate = computed(() => {
  const exp = userPrefs.value.fitness_experience
  const days = userPrefs.value.available_days
  if (!exp) return null
  if (exp === 'beginner') return 'Full Body (3-day)'
  if (days && days >= 5) return 'Push/Pull/Legs (6-day)'
  return 'Upper/Lower (4-day)'
})

function getInjuryWarnings(tmpl) {
  const injuries = userPrefs.value.injuries
  if (!injuries || typeof injuries !== 'string' || !injuries.trim()) return []

  const injuryLower = injuries.toLowerCase()
  const warnings = []
  const allExercises = tmpl.days.flatMap(d => (d.exercises || []).map(e => e.name))

  for (const rule of INJURY_RULES) {
    if (injuryLower.includes(rule.keyword)) {
      const flagged = rule.exercises.filter(ex => allExercises.includes(ex))
      if (flagged.length > 0) {
        warnings.push(`Contains ${flagged.length} exercise${flagged.length > 1 ? 's' : ''} that may affect your ${rule.keyword} — review before starting`)
      }
    }
  }
  return warnings
}

// ==========================================
// Program templates (hardcoded)
// ==========================================

function makeExercise(name, sets, repsMin, repsMax, rest) {
  return { name, sets, reps_min: repsMin, reps_max: repsMax, rest }
}

const templates = [
  {
    name: 'Push/Pull/Legs (6-day)',
    description: '6 days on, 1 rest. Classic PPL split.',
    days: [
      { day_of_week: 0, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 1, name: 'Push A', focus: 'Chest & Triceps', is_rest_day: false, exercises: [
        makeExercise('Bench Press', 4, 6, 8, 120),
        makeExercise('Incline Bench Press', 3, 8, 10, 90),
        makeExercise('Overhead Press', 3, 8, 10, 90),
        makeExercise('Lateral Raises', 3, 12, 15, 60),
        makeExercise('Tricep Pushdown', 3, 10, 12, 60),
        makeExercise('Overhead Tricep Extension', 3, 10, 12, 60)
      ]},
      { day_of_week: 2, name: 'Pull A', focus: 'Back & Biceps', is_rest_day: false, exercises: [
        makeExercise('Barbell Row', 4, 6, 8, 120),
        makeExercise('Pull-Ups', 3, 6, 10, 90),
        makeExercise('Lat Pulldown', 3, 10, 12, 60),
        makeExercise('Face Pulls', 3, 15, 20, 60),
        makeExercise('Barbell Curl', 3, 8, 10, 60),
        makeExercise('Hammer Curl', 3, 10, 12, 60)
      ]},
      { day_of_week: 3, name: 'Legs A', focus: 'Quads & Hamstrings', is_rest_day: false, exercises: [
        makeExercise('Squat', 4, 6, 8, 150),
        makeExercise('Leg Press', 3, 10, 12, 90),
        makeExercise('Romanian Deadlift', 3, 8, 10, 90),
        makeExercise('Leg Curl', 3, 10, 12, 60),
        makeExercise('Leg Extension', 3, 10, 12, 60),
        makeExercise('Calf Raises', 4, 12, 15, 60)
      ]},
      { day_of_week: 4, name: 'Push B', focus: 'Shoulders & Chest', is_rest_day: false, exercises: [
        makeExercise('Dumbbell Bench Press', 4, 8, 10, 90),
        makeExercise('Arnold Press', 3, 8, 10, 90),
        makeExercise('Cable Crossover', 3, 12, 15, 60),
        makeExercise('Lateral Raises', 3, 12, 15, 60),
        makeExercise('Skull Crushers', 3, 10, 12, 60),
        makeExercise('Tricep Pushdown', 3, 10, 12, 60)
      ]},
      { day_of_week: 5, name: 'Pull B', focus: 'Back & Biceps', is_rest_day: false, exercises: [
        makeExercise('Deadlift', 4, 5, 6, 180),
        makeExercise('Seated Cable Row', 3, 10, 12, 90),
        makeExercise('Dumbbell Row', 3, 10, 12, 60),
        makeExercise('Rear Delt Flyes', 3, 12, 15, 60),
        makeExercise('Dumbbell Curl', 3, 10, 12, 60),
        makeExercise('Preacher Curl', 3, 10, 12, 60)
      ]},
      { day_of_week: 6, name: 'Legs B', focus: 'Glutes & Legs', is_rest_day: false, exercises: [
        makeExercise('Squat', 4, 8, 10, 150),
        makeExercise('Bulgarian Split Squat', 3, 8, 10, 90),
        makeExercise('Hip Thrust', 3, 10, 12, 90),
        makeExercise('Leg Curl', 3, 10, 12, 60),
        makeExercise('Calf Raises', 4, 12, 15, 60),
        makeExercise('Lunges', 3, 10, 12, 60)
      ]}
    ]
  },
  {
    name: 'Upper/Lower (4-day)',
    description: 'Mon/Thu upper, Tue/Fri lower, 3 rest days.',
    days: [
      { day_of_week: 0, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 1, name: 'Upper A', focus: 'Chest, Back & Arms', is_rest_day: false, exercises: [
        makeExercise('Bench Press', 4, 6, 8, 120),
        makeExercise('Barbell Row', 4, 6, 8, 120),
        makeExercise('Overhead Press', 3, 8, 10, 90),
        makeExercise('Lat Pulldown', 3, 10, 12, 60),
        makeExercise('Dumbbell Curl', 3, 10, 12, 60),
        makeExercise('Tricep Pushdown', 3, 10, 12, 60)
      ]},
      { day_of_week: 2, name: 'Lower A', focus: 'Quads & Hamstrings', is_rest_day: false, exercises: [
        makeExercise('Squat', 4, 6, 8, 150),
        makeExercise('Romanian Deadlift', 3, 8, 10, 120),
        makeExercise('Leg Press', 3, 10, 12, 90),
        makeExercise('Leg Curl', 3, 10, 12, 60),
        makeExercise('Calf Raises', 4, 12, 15, 60),
        makeExercise('Lunges', 3, 10, 12, 60)
      ]},
      { day_of_week: 3, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 4, name: 'Upper B', focus: 'Shoulders, Back & Arms', is_rest_day: false, exercises: [
        makeExercise('Dumbbell Bench Press', 4, 8, 10, 90),
        makeExercise('Seated Cable Row', 3, 10, 12, 90),
        makeExercise('Arnold Press', 3, 8, 10, 90),
        makeExercise('Pull-Ups', 3, 6, 10, 90),
        makeExercise('Hammer Curl', 3, 10, 12, 60),
        makeExercise('Skull Crushers', 3, 10, 12, 60)
      ]},
      { day_of_week: 5, name: 'Lower B', focus: 'Glutes & Legs', is_rest_day: false, exercises: [
        makeExercise('Deadlift', 4, 5, 6, 180),
        makeExercise('Bulgarian Split Squat', 3, 8, 10, 90),
        makeExercise('Hip Thrust', 3, 10, 12, 90),
        makeExercise('Leg Extension', 3, 10, 12, 60),
        makeExercise('Calf Raises', 4, 12, 15, 60),
        makeExercise('Leg Curl', 3, 10, 12, 60)
      ]},
      { day_of_week: 6, name: 'Rest', focus: '', is_rest_day: true, exercises: [] }
    ]
  },
  {
    name: 'Full Body (3-day)',
    description: 'Mon/Wed/Fri full body, 4 rest days.',
    days: [
      { day_of_week: 0, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 1, name: 'Full Body A', focus: 'Compound Focus', is_rest_day: false, exercises: [
        makeExercise('Squat', 4, 6, 8, 150),
        makeExercise('Bench Press', 4, 6, 8, 120),
        makeExercise('Barbell Row', 3, 8, 10, 90),
        makeExercise('Overhead Press', 3, 8, 10, 90),
        makeExercise('Barbell Curl', 3, 10, 12, 60),
        makeExercise('Calf Raises', 3, 12, 15, 60)
      ]},
      { day_of_week: 2, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 3, name: 'Full Body B', focus: 'Hypertrophy', is_rest_day: false, exercises: [
        makeExercise('Deadlift', 4, 5, 6, 180),
        makeExercise('Dumbbell Bench Press', 3, 10, 12, 90),
        makeExercise('Lat Pulldown', 3, 10, 12, 60),
        makeExercise('Lateral Raises', 3, 12, 15, 60),
        makeExercise('Tricep Pushdown', 3, 10, 12, 60),
        makeExercise('Leg Curl', 3, 10, 12, 60)
      ]},
      { day_of_week: 4, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 5, name: 'Full Body C', focus: 'Strength & Power', is_rest_day: false, exercises: [
        makeExercise('Squat', 4, 8, 10, 120),
        makeExercise('Incline Bench Press', 3, 8, 10, 90),
        makeExercise('Pull-Ups', 3, 6, 10, 90),
        makeExercise('Romanian Deadlift', 3, 8, 10, 90),
        makeExercise('Hammer Curl', 3, 10, 12, 60),
        makeExercise('Calf Raises', 3, 12, 15, 60)
      ]},
      { day_of_week: 6, name: 'Rest', focus: '', is_rest_day: true, exercises: [] }
    ]
  }
]
</script>
