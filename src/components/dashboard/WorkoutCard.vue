<template>
  <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
    <!-- No program -->
    <template v-if="!fitnessStore.activeProgram">
      <div class="flex items-center justify-between mb-1">
        <span class="text-sm font-medium text-slate-400">Today's Workout</span>
        <Dumbbell class="w-4 h-4 text-slate-500" />
      </div>
      <p class="text-slate-300 text-sm mt-2">No program active.</p>
      <router-link
        to="/fitness"
        class="mt-3 inline-flex items-center gap-1 text-brand-400 text-sm font-medium hover:text-brand-300 transition-colors"
      >
        Set up a program <ChevronRight class="w-4 h-4" />
      </router-link>
    </template>

    <!-- Rest day -->
    <template v-else-if="fitnessStore.todaysWorkout?.is_rest_day">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-slate-400">Today's Workout</span>
        <Moon class="w-4 h-4 text-slate-500" />
      </div>
      <div class="flex items-center gap-2">
        <Moon class="w-5 h-5 text-indigo-400" />
        <span class="text-slate-100 font-semibold">Rest Day</span>
      </div>
      <p class="text-slate-400 text-sm mt-1">Recovery is part of the process. Take it easy today.</p>
    </template>

    <!-- Completed today -->
    <template v-else-if="completedToday">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-slate-400">Today's Workout</span>
        <CheckCircle class="w-4 h-4 text-emerald-400" />
      </div>
      <div class="flex items-center gap-2">
        <CheckCircle class="w-5 h-5 text-emerald-400" />
        <span class="text-slate-100 font-semibold">{{ fitnessStore.todaysWorkout?.name || 'Workout' }} — Done</span>
      </div>
      <div class="flex items-center gap-4 mt-2 text-sm text-slate-400">
        <span v-if="completedLog?.duration_min">{{ completedLog.duration_min }} min</span>
        <span v-if="completedLog?.xp_earned" class="text-purple-400">+{{ completedLog.xp_earned }} XP</span>
      </div>
    </template>

    <!-- Active training day -->
    <template v-else-if="fitnessStore.todaysWorkout">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-slate-400">Today's Workout</span>
        <Dumbbell class="w-4 h-4 text-brand-400" />
      </div>
      <p class="text-slate-100 font-semibold">{{ fitnessStore.todaysWorkout.name }}</p>
      <p v-if="fitnessStore.todaysWorkout.focus" class="text-slate-400 text-sm mt-0.5">
        {{ fitnessStore.todaysWorkout.focus }}
      </p>
      <p class="text-slate-500 text-xs mt-1">
        {{ exerciseCount }} exercise{{ exerciseCount !== 1 ? 's' : '' }}
      </p>
      <button
        @click="startWorkout"
        class="mt-3 w-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg py-2 px-4 transition-colors"
      >
        Start Workout
      </button>
    </template>

    <!-- Program exists but no day scheduled today -->
    <template v-else>
      <div class="flex items-center justify-between mb-1">
        <span class="text-sm font-medium text-slate-400">Today's Workout</span>
        <Dumbbell class="w-4 h-4 text-slate-500" />
      </div>
      <p class="text-slate-300 text-sm mt-2">No workout scheduled today.</p>
      <router-link
        to="/fitness"
        class="mt-3 inline-flex items-center gap-1 text-brand-400 text-sm font-medium hover:text-brand-300 transition-colors"
      >
        View program <ChevronRight class="w-4 h-4" />
      </router-link>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Dumbbell, Moon, CheckCircle, ChevronRight } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'

const fitnessStore = useFitnessStore()
const router = useRouter()

const exerciseCount = computed(() => fitnessStore.todaysWorkout?.exercises?.length || 0)

const completedLog = computed(() => {
  if (!fitnessStore.recentLogs.length) return null
  const today = new Date().toISOString().split('T')[0]
  return fitnessStore.recentLogs.find((log) => {
    if (!log.finished_at) return false
    return log.started_at.startsWith(today)
  }) || null
})

const completedToday = computed(() => !!completedLog.value)

async function startWorkout() {
  const dayId = fitnessStore.todaysWorkout?.id
  if (!dayId) return
  try {
    const logId = await fitnessStore.startWorkout(dayId)
    router.push(`/fitness/workout/${logId}`)
  } catch (err) {
    console.error('Failed to start workout:', err)
  }
}
</script>
