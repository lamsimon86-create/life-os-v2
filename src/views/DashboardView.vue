<template>
  <div class="space-y-3 pb-20">
    <!-- 1. Greeting + Gamification + Avatar -->
    <div class="flex justify-between items-start">
      <div>
        <h1 class="text-xl font-bold">Good {{ greeting }}, {{ userStore.name || 'there' }}</h1>
        <p class="text-xs text-slate-400 mt-0.5">{{ formattedDate }}</p>
      </div>
      <div class="flex items-start gap-2">
        <div class="flex flex-col items-end gap-1">
          <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white">
            {{ userStore.streak }}-day streak
          </span>
          <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
            Lv {{ userStore.level }} · {{ userStore.levelInfo?.title }}
          </span>
        </div>
        <AvatarCompanion
          :stage="userStore.avatarStage?.stage || 1"
          :mood="avatarMood"
          :level="userStore.level"
          :level-title="userStore.levelInfo?.title || ''"
          :stage-name="userStore.avatarStage?.name || 'Hatchling'"
          :next-stage-name="userStore.avatarNextStage?.name"
          :next-stage-level="userStore.avatarNextStage?.minLevel"
          :workout-done="workoutDoneToday"
          :all-meals-logged="allMealsLoggedToday"
          :checkin-done="userStore.dailyCheckinDone"
        />
      </div>
    </div>

    <!-- 2. XP Progress Bar -->
    <div>
      <div class="flex justify-between text-[10px] text-slate-500 mb-1">
        <span>{{ userStore.xp || 0 }} / {{ userStore.xpProgress?.next?.xp || userStore.xp }} XP</span>
        <span>{{ userStore.levelInfo?.title }} → {{ xpNextTitle }}</span>
      </div>
      <div class="bg-slate-800 rounded h-1.5">
        <div
          class="bg-gradient-to-r from-purple-500 to-purple-400 rounded h-full transition-all duration-500"
          :style="{ width: `${userStore.xpProgress?.progress || 0}%` }"
        ></div>
      </div>
    </div>

    <!-- 3. Brief Me -->
    <BriefMeButton />

    <!-- 4. This Week | Today Split -->
    <div class="grid grid-cols-2 gap-2.5">
      <WeeklyProgress />
      <TodayChecklist />
    </div>

    <!-- 5. Goal Progress -->
    <GoalProgress />

    <!-- 6. Up Next -->
    <UpNextCards @open-checkin="openCheckinModal" />

    <!-- Daily Check-in Modal -->
    <div
      v-if="showCheckin"
      class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
      @click.self="showCheckin = false"
    >
      <div class="bg-slate-800 rounded-xl p-5 w-full max-w-sm">
        <h3 class="text-base font-bold mb-4">Daily Check-in</h3>

        <div class="mb-4">
          <label class="text-xs text-slate-400 mb-2 block">How's your energy?</label>
          <div class="flex gap-2">
            <button
              v-for="level in ['high', 'medium', 'low']"
              :key="level"
              @click="checkinForm.energy = level"
              class="flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors"
              :class="checkinForm.energy === level
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'"
            >
              {{ level }}
            </button>
          </div>
        </div>

        <div class="mb-4">
          <label class="text-xs text-slate-400 mb-2 block">How'd you sleep?</label>
          <div class="flex gap-2">
            <button
              v-for="quality in ['great', 'ok', 'rough']"
              :key="quality"
              @click="checkinForm.sleepQuality = quality"
              class="flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors"
              :class="checkinForm.sleepQuality === quality
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'"
            >
              {{ quality }}
            </button>
          </div>
        </div>

        <div class="mb-5">
          <label class="text-xs text-slate-400 mb-2 block">Hours of sleep</label>
          <input
            v-model.number="checkinForm.sleepHours"
            type="number"
            min="0"
            max="16"
            step="0.5"
            class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
            placeholder="7.5"
          />
        </div>

        <div class="flex gap-2">
          <button @click="showCheckin = false" class="flex-1 py-2 rounded-lg bg-slate-700 text-sm text-slate-300">
            Cancel
          </button>
          <button
            @click="submitCheckin"
            :disabled="!checkinForm.energy || !checkinForm.sleepQuality"
            class="flex-1 py-2 rounded-lg bg-blue-500 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { getGreeting, formatDate } from '@/lib/constants'
import { getNextLevel } from '@/lib/gamification'
import { getAvatarMood } from '@/lib/avatar'
import { useUserStore } from '@/stores/user'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'
import { useCalendarStore } from '@/stores/calendar'
import BriefMeButton from '@/components/dashboard/BriefMeButton.vue'
import WeeklyProgress from '@/components/dashboard/WeeklyProgress.vue'
import TodayChecklist from '@/components/dashboard/TodayChecklist.vue'
import GoalProgress from '@/components/dashboard/GoalProgress.vue'
import UpNextCards from '@/components/dashboard/UpNextCards.vue'
import AvatarCompanion from '@/components/dashboard/AvatarCompanion.vue'

const userStore = useUserStore()
const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const goalsStore = useGoalsStore()
const calendarStore = useCalendarStore()

const greeting = computed(() => getGreeting())
const formattedDate = computed(() => formatDate())

const xpNextTitle = computed(() => {
  const next = getNextLevel(userStore.levelInfo)
  return next?.title || 'Max'
})

// Avatar mood — computed here to avoid circular store dependencies
const today = computed(() => new Date().toISOString().split('T')[0])

const workoutDoneToday = computed(() => {
  if (fitnessStore.todaysWorkout?.is_rest_day) return true
  return fitnessStore.recentLogs.some(
    l => l.finished_at && l.started_at?.split('T')[0] === today.value
  )
})

const allMealsLoggedToday = computed(() => {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayName = dayNames[new Date().getDay()]
  const todayPlan = mealsStore.weekPlan?.plan_data?.[todayName]
  const planned = todayPlan ? Object.keys(todayPlan).filter(k => todayPlan[k]).length : 0
  const logged = mealsStore.todaysMeals?.length || 0
  return planned > 0 && logged >= planned
})

const avatarMood = computed(() => getAvatarMood({
  workoutDone: workoutDoneToday.value,
  allMealsLogged: allMealsLoggedToday.value,
  checkinDone: userStore.dailyCheckinDone,
  streak: userStore.streak,
  streakBroken: false // TODO: track previous streak to detect break
}))

// Daily check-in modal
const showCheckin = ref(false)
const checkinForm = reactive({
  energy: null,
  sleepQuality: null,
  sleepHours: null
})

function openCheckinModal() {
  showCheckin.value = true
}

async function submitCheckin() {
  await userStore.logDailyState({
    energy: checkinForm.energy,
    sleep_quality: checkinForm.sleepQuality,
    sleep_hours: checkinForm.sleepHours
  })
  showCheckin.value = false
}

// Hydrate all stores on mount
onMounted(async () => {
  await Promise.all([
    userStore.hydrate(),
    fitnessStore.hydrate(),
    mealsStore.hydrate(),
    goalsStore.hydrate(),
    calendarStore.hydrate()
  ])
})
</script>
