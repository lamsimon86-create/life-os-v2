# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Life OS v2 dashboard into a structured daily briefing with split-panel layout, on-demand AI briefing, weekly progress rings, goal focus system, smart action cards, and a gamified avatar companion.

**Architecture:** Replace the current single-column card stack (`DashboardView.vue` + 4 sub-components) with a new layout: greeting header with avatar, XP bar, Brief Me button, two-column split panel (This Week rings | Today checklist), goal progress section, and smart Up Next action cards. Store layer gets new computed properties for weekly stats, goal focus, and avatar state. One new store (`calendarStore`) for Google Calendar events. One DB migration adds `is_focused` to goals and creates calendar events table.

**Tech Stack:** Vue 3.5 (Composition API), Pinia stores, Supabase (PostgreSQL + Edge Functions), Tailwind CSS 4, Lucide Vue Next icons, inline SVG for progress rings and avatar.

**Spec:** `docs/superpowers/specs/2026-03-20-dashboard-redesign-design.md`

**Supabase CLI:** All Supabase commands must be prefixed with `SUPABASE_ACCESS_TOKEN=sbp_abf2b370173e54d511095caa8ef525fd6458e594` since the Life OS project is in a separate org from the default CLI profile.

**Week boundaries:** The spec uses Monday-Sunday weeks. The existing `getWeekStart()` in `src/lib/constants.js` returns Sunday. Add a new `getMondayWeekStart()` helper for dashboard computeds. Do NOT modify `getWeekStart()` as other features depend on it.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/004_dashboard_redesign.sql` | Add `is_focused` to goals, create calendar events table |
| `src/stores/calendar.js` | Google Calendar events state + hydration |
| `src/lib/avatar.js` | Avatar stage/mood computation logic |
| `src/components/dashboard/BriefMeButton.vue` | On-demand AI briefing trigger |
| `src/components/dashboard/WeeklyProgress.vue` | This Week panel with 3 SVG progress rings |
| `src/components/dashboard/TodayChecklist.vue` | Today panel with status dot items |
| `src/components/dashboard/GoalProgress.vue` | Focused goals with progress bars |
| `src/components/dashboard/UpNextCards.vue` | Smart context-aware action cards |
| `src/components/dashboard/AvatarCompanion.vue` | Avatar in header + tap popover |

### Modified Files
| File | Changes |
|------|---------|
| `src/stores/goals.js` | Add `focusedGoals`, `dashboardGoals`, `toggleFocus()` |
| `src/stores/fitness.js` | Add `weeklyWorkoutCount`, `lastCompletedWorkout`, `previousWeekVolume`, `volumeTrend` |
| `src/stores/meals.js` | Add `weeklyMealProgress`, `nextMealToLog` |
| `src/stores/user.js` | Add `avatarStage`, `avatarMood`, `dailyCheckinDone` |
| `src/lib/constants.js` | Add `getMondayWeekStart()` helper |
| `src/views/DashboardView.vue` | Complete restructure to new layout |
| `src/views/GoalsView.vue` | Add focus toggle + `route.query.expand` handling |

### Removed Files
| File | Replaced By |
|------|------------|
| `src/components/dashboard/WorkoutCard.vue` | UpNextCards.vue |
| `src/components/dashboard/MealsCard.vue` | UpNextCards.vue |
| `src/components/dashboard/GoalsCard.vue` | GoalProgress.vue |
| `src/components/dashboard/AiInsight.vue` | BriefMeButton.vue |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/004_dashboard_redesign.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add goal focus column
ALTER TABLE v2_goals ADD COLUMN is_focused boolean DEFAULT false;

-- Add hydration tracking to daily logs
ALTER TABLE v2_daily_logs ADD COLUMN water_glasses integer DEFAULT 0;

-- Calendar events table
CREATE TABLE IF NOT EXISTS v2_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  google_event_id text,
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  all_day boolean DEFAULT false,
  location text,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE v2_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own events"
  ON v2_calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own events"
  ON v2_calendar_events FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_v2_calendar_events_user_date
  ON v2_calendar_events (user_id, start_time);
```

- [ ] **Step 2: Push migration to remote**

Run: `cd life-os-v2 && SUPABASE_ACCESS_TOKEN=sbp_abf2b370173e54d511095caa8ef525fd6458e594 npx supabase db push --linked`

Expected: Migration applies successfully.

- [ ] **Step 3: Verify migration**

Run: `SUPABASE_ACCESS_TOKEN=sbp_abf2b370173e54d511095caa8ef525fd6458e594 npx supabase migration list`

Expected: 004 shows as applied on remote.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_dashboard_redesign.sql
git commit -m "feat: add goal focus column and calendar events table"
```

---

## Task 2: Add `getMondayWeekStart()` Helper

**Files:**
- Modify: `src/lib/constants.js`

- [ ] **Step 1: Add the helper function**

Add after the existing `getWeekStart()` function:

```javascript
export function getMondayWeekStart(date) {
  const d = date ? new Date(date) : new Date()
  const day = d.getDay()
  // Monday = 1, so shift: if Sunday (0), go back 6 days; else go back (day - 1) days
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().split('T')[0]
}
```

- [ ] **Step 2: Verify existing exports are unchanged**

Run: `cd life-os-v2 && npm run build`

Expected: Build succeeds, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.js
git commit -m "feat: add getMondayWeekStart() helper for dashboard weekly stats"
```

---

## Task 3: Avatar Logic Module

**Files:**
- Create: `src/lib/avatar.js`

- [ ] **Step 1: Create the avatar module**

```javascript
/**
 * Avatar companion logic — stage derived from level, mood from daily activity.
 * 5 evolution stages, 4 mood states.
 */

export const AVATAR_STAGES = [
  { stage: 1, name: 'Hatchling', minLevel: 1, maxLevel: 2, description: 'Small, just hatched' },
  { stage: 2, name: 'Juvenile', minLevel: 3, maxLevel: 4, description: 'Bigger, more defined' },
  { stage: 3, name: 'Warrior', minLevel: 5, maxLevel: 6, description: 'Strong, battle-ready' },
  { stage: 4, name: 'Champion', minLevel: 7, maxLevel: 8, description: 'Powerful, glowing' },
  { stage: 5, name: 'Mythic', minLevel: 9, maxLevel: 11, description: 'Final form, legendary' }
]

export const MOOD_STATES = ['happy', 'neutral', 'tired', 'sad']

/**
 * Get avatar evolution stage from user level.
 * @param {number} level - User's current level (1-11)
 * @returns {object} Stage object with { stage, name, description, minLevel, maxLevel }
 */
export function getAvatarStage(level) {
  return AVATAR_STAGES.find(s => level >= s.minLevel && level <= s.maxLevel) || AVATAR_STAGES[0]
}

/**
 * Get the next evolution stage (or null if at max).
 * @param {number} level - User's current level
 * @returns {object|null} Next stage object or null
 */
export function getNextStage(level) {
  const current = getAvatarStage(level)
  return AVATAR_STAGES.find(s => s.stage === current.stage + 1) || null
}

/**
 * Calculate avatar mood from daily activity state.
 * @param {object} params
 * @param {boolean} params.workoutDone - Workout completed or rest day
 * @param {boolean} params.allMealsLogged - All planned meals logged today
 * @param {boolean} params.checkinDone - Daily energy/sleep logged
 * @param {number} params.streak - Current streak count
 * @param {boolean} params.streakBroken - Streak was > 0 and is now 0
 * @returns {string} One of: 'happy', 'neutral', 'tired', 'sad'
 */
export function getAvatarMood({ workoutDone, allMealsLogged, checkinDone, streak, streakBroken }) {
  // Streak broken overrides everything
  if (streakBroken) return 'sad'

  const completions = [workoutDone, allMealsLogged, checkinDone].filter(Boolean).length

  if (completions === 3) return 'happy'
  if (completions === 0) return 'tired'
  return 'neutral'
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/avatar.js
git commit -m "feat: avatar companion logic — stages and mood calculation"
```

---

## Task 4: Update goalsStore — Focus System

**Files:**
- Modify: `src/stores/goals.js`

- [ ] **Step 1: Add focus-related computed properties and action**

Add these after the existing `topGoals` computed (around line 30):

```javascript
const focusedGoals = computed(() =>
  goals.value.filter(g => g.status === 'active' && g.is_focused)
)

const focusedCount = computed(() => focusedGoals.value.length)

const dashboardGoals = computed(() => {
  if (focusedGoals.value.length > 0) {
    return focusedGoals.value.slice(0, 3)
  }
  // Fallback: 3 active goals with nearest target_date
  return [...activeGoals.value]
    .sort((a, b) => {
      if (!a.target_date) return 1
      if (!b.target_date) return -1
      return new Date(a.target_date) - new Date(b.target_date)
    })
    .slice(0, 3)
})
```

Add a new action `toggleFocus`:

```javascript
async function toggleFocus(goalId) {
  const goal = goals.value.find(g => g.id === goalId)
  if (!goal) return

  // If trying to focus and already at max 3, don't allow
  if (!goal.is_focused && focusedCount.value >= 3) return

  const newValue = !goal.is_focused
  const { error } = await supabase
    .from('v2_goals')
    .update({ is_focused: newValue })
    .eq('id', goalId)

  if (!error) {
    goal.is_focused = newValue
  }
}
```

Return the new properties from the store's return statement:

```javascript
return {
  // ... existing returns ...
  focusedGoals, focusedCount, dashboardGoals, toggleFocus
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/stores/goals.js
git commit -m "feat: goal focus system — pin up to 3 goals for dashboard"
```

---

## Task 5: Update fitnessStore — Weekly Stats

**Files:**
- Modify: `src/stores/fitness.js`

- [ ] **Step 1: Import getMondayWeekStart at top of file**

Add to existing imports:

```javascript
import { getDayOfWeek, getMondayWeekStart } from '@/lib/constants'
```

- [ ] **Step 2: Add new state ref**

Add after existing state declarations:

```javascript
const previousWeekVolume = ref(0)
```

- [ ] **Step 3: Add computed properties**

Add after existing computed/state:

```javascript
const weeklyWorkoutCount = computed(() => {
  if (!activeProgram.value) return { completed: 0, planned: 0 }

  const planned = activeProgram.value.days
    ? activeProgram.value.days.filter(d => !d.is_rest_day).length
    : 0

  const weekStart = getMondayWeekStart()
  const completed = recentLogs.value.filter(log => {
    if (!log.finished_at) return false
    const logDate = log.started_at.split('T')[0]
    return logDate >= weekStart
  }).length

  return { completed, planned }
})

const lastCompletedWorkout = computed(() => {
  const completed = recentLogs.value.find(log => log.finished_at)
  if (!completed) return null

  // Find the program day name for this log
  const day = activeProgram.value?.days?.find(d => d.id === completed.program_day_id)

  return {
    name: day?.name || 'Workout',
    focus: day?.focus || '',
    duration: completed.duration_min || 0,
    xp: completed.xp_earned || 0
  }
})

const volumeTrend = computed(() => {
  if (previousWeekVolume.value === 0) {
    return { percentage: 0, direction: 'flat' }
  }
  const change = ((weeklyVolume.value - previousWeekVolume.value) / previousWeekVolume.value) * 100
  return {
    percentage: Math.abs(Math.round(change)),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  }
})
```

- [ ] **Step 4: Add previous week volume fetch to hydrate()**

Inside `hydrate()`, after the existing `weeklyVolume` calculation, add:

```javascript
// Fetch previous week volume for trend comparison
const prevWeekStart = getMondayWeekStart(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
const prevWeekEnd = getMondayWeekStart() // current week start = prev week end
const { data: prevSets } = await supabase
  .from('v2_workout_sets')
  .select('weight, reps, workout_log_id, v2_workout_logs!inner(started_at)')
  .gte('v2_workout_logs.started_at', prevWeekStart)
  .lt('v2_workout_logs.started_at', prevWeekEnd)
  .eq('is_warmup', false)

previousWeekVolume.value = (prevSets || []).reduce(
  (sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0
)
```

Note: The join syntax `v2_workout_logs!inner(started_at)` uses Supabase's foreign key join. If the foreign key relationship isn't set up, use a two-step query instead: first get log IDs for the date range from `v2_workout_logs`, then query `v2_workout_sets` with those IDs.

- [ ] **Step 5: Add new properties to return statement**

```javascript
return {
  // ... existing returns ...
  weeklyWorkoutCount, lastCompletedWorkout, volumeTrend, previousWeekVolume
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/stores/fitness.js
git commit -m "feat: weekly workout stats — count, last workout, volume trend"
```

---

## Task 6: Update mealsStore — Weekly Progress

**Files:**
- Modify: `src/stores/meals.js`

- [ ] **Step 1: Import helpers**

Add to existing imports:

```javascript
import { MEAL_TYPES, getMondayWeekStart } from '@/lib/constants'
```

- [ ] **Step 2: Add computed properties**

Add after existing state/computed:

```javascript
const weeklyMealProgress = computed(() => {
  if (!weekPlan.value?.plan_data) return { logged: 0, planned: 0, percentage: 0 }

  const weekStart = getMondayWeekStart()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayStr = new Date().toISOString().split('T')[0]

  let planned = 0
  // Count planned slots from Monday through today (using date strings to avoid timezone issues)
  const startDate = new Date(weekStart + 'T00:00:00')
  const endDate = new Date(todayStr + 'T23:59:59')
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayName = dayNames[d.getDay()]
    const dayPlan = weekPlan.value.plan_data[dayName]
    if (dayPlan) {
      planned += Object.keys(dayPlan).filter(k => dayPlan[k]).length
    }
  }

  // Count logged meals this week
  const logged = recentMeals.value.filter(m => {
    return m.date >= weekStart
  }).length

  const percentage = planned > 0 ? Math.round((logged / planned) * 100) : 0
  return { logged, planned, percentage }
})

const nextMealToLog = computed(() => {
  const hour = new Date().getHours()
  const greeting = getGreeting()

  // Determine which meal type to suggest based on time
  let targetType
  if (hour < 10) targetType = 'breakfast'
  else if (hour < 14) targetType = 'lunch'
  else if (hour < 18) targetType = 'dinner'
  else targetType = 'snack'

  // If that meal is already logged, find the next unlogged one
  const loggedTypes = todaysMeals.value.map(m => m.meal_type)
  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack']

  // Start from target, find first unlogged
  const startIdx = mealOrder.indexOf(targetType)
  for (let i = 0; i < mealOrder.length; i++) {
    const type = mealOrder[(startIdx + i) % mealOrder.length]
    if (!loggedTypes.includes(type)) {
      // Get planned description from today's plan
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const todayName = dayNames[new Date().getDay()]
      const todayPlan = weekPlan.value?.plan_data?.[todayName]
      const planned = todayPlan?.[type] || null

      return { type, planned }
    }
  }

  return null // All meals logged
})
```

- [ ] **Step 3: Add to return statement**

```javascript
return {
  // ... existing returns ...
  weeklyMealProgress, nextMealToLog
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/stores/meals.js
git commit -m "feat: weekly meal progress and next-meal-to-log computed"
```

---

## Task 7: Update userStore — Avatar + Daily Check-in

**Files:**
- Modify: `src/stores/user.js`

- [ ] **Step 1: Import avatar helpers**

Add to existing imports:

```javascript
import { getAvatarStage, getAvatarMood, getNextStage } from '@/lib/avatar'
```

- [ ] **Step 2: Add computed properties**

Add after existing computed properties:

```javascript
const waterGlasses = ref(0)

const dailyCheckinDone = computed(() => energy.value !== null)

const avatarStage = computed(() => getAvatarStage(level.value || 1))

const avatarNextStage = computed(() => getNextStage(level.value || 1))
```

Note: `avatarMood` requires cross-store data (fitness, meals). It will be computed in `DashboardView.vue` or `AvatarCompanion.vue` using data from all stores, NOT inside `userStore`, to avoid circular store dependencies.

- [ ] **Step 3: Add `addWater()` action and populate `waterGlasses` in hydrate**

Add action:

```javascript
async function addWater() {
  waterGlasses.value++
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const today = new Date().toISOString().split('T')[0]
  await supabase
    .from('v2_daily_logs')
    .upsert({
      user_id: user.id,
      date: today,
      water_glasses: waterGlasses.value
    }, { onConflict: 'user_id,date' })
}
```

In the existing `hydrate()` function, where it fetches the daily log, also populate `waterGlasses`:

```javascript
// After fetching daily log data:
waterGlasses.value = logData?.water_glasses || 0
```

- [ ] **Step 4: Add to return statement**

```javascript
return {
  // ... existing returns ...
  waterGlasses, addWater, dailyCheckinDone, avatarStage, avatarNextStage
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/stores/user.js
git commit -m "feat: avatar stage computed + daily check-in status"
```

---

## Task 8: Create calendarStore

**Files:**
- Create: `src/stores/calendar.js`

- [ ] **Step 1: Create the store**

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref([])
  const connected = ref(false)
  const loading = ref(false)

  const todaysEvents = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return events.value
      .filter(e => {
        const eventDate = e.start_time?.split('T')[0]
        return eventDate === today
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  })

  const nextEvent = computed(() => {
    const now = new Date()
    return todaysEvents.value.find(e => new Date(e.start_time) > now) || null
  })

  async function hydrate() {
    loading.value = true

    try {
      // Check if calendar events table has any data for this user
      // (presence of data implies calendar is connected)
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('v2_calendar_events')
        .select('*')
        .gte('start_time', today)
        .lt('start_time', tomorrow)
        .order('start_time')

      if (error) {
        // Table might not exist yet or user has no events — graceful degradation
        connected.value = false
        events.value = []
        return
      }

      events.value = data || []
      // If we got a response (even empty), the table exists and user may be connected
      // Check if there's any synced data at all to determine connection status
      if (data && data.length > 0) {
        connected.value = true
      } else {
        // Check if user has ANY events (not just today) to determine if connected
        const { count } = await supabase
          .from('v2_calendar_events')
          .select('id', { count: 'exact', head: true })

        connected.value = (count || 0) > 0
      }
    } catch (e) {
      connected.value = false
      events.value = []
    } finally {
      loading.value = false
    }
  }

  return {
    events, connected, loading,
    todaysEvents, nextEvent,
    hydrate
  }
})
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/stores/calendar.js
git commit -m "feat: calendar store — today's events from Google Calendar sync"
```

---

## Task 9: BriefMeButton Component

**Files:**
- Create: `src/components/dashboard/BriefMeButton.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <button
    @click="briefMe"
    class="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-700 bg-gradient-to-r from-slate-800 to-slate-800/80 hover:from-slate-700 hover:to-slate-700/80 transition-colors text-left"
  >
    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-content-center shrink-0 flex justify-center">
      <Sparkles class="w-4 h-4 text-white" />
    </div>
    <div class="min-w-0">
      <div class="text-sm font-semibold text-slate-200">Brief me on my day</div>
      <div class="text-xs text-slate-500">AI summary of your schedule, progress & priorities</div>
    </div>
    <ChevronRight class="w-4 h-4 text-slate-500 shrink-0 ml-auto" />
  </button>
</template>

<script setup>
import { Sparkles, ChevronRight } from 'lucide-vue-next'
import { useAiStore } from '@/stores/ai'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'
import { useCalendarStore } from '@/stores/calendar'
import { useUserStore } from '@/stores/user'

const aiStore = useAiStore()
const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const goalsStore = useGoalsStore()
const calendarStore = useCalendarStore()
const userStore = useUserStore()

function briefMe() {
  // Build a contextual briefing prompt
  const parts = []

  // Calendar
  const events = calendarStore.todaysEvents
  if (events.length > 0) {
    const eventList = events.map(e => {
      const time = new Date(e.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      return `${time}: ${e.title}`
    }).join(', ')
    parts.push(`Today's schedule: ${eventList}`)
  } else {
    parts.push('No calendar events today.')
  }

  // Workout
  const workout = fitnessStore.todaysWorkout
  if (workout?.is_rest_day) {
    parts.push('Today is a rest day.')
  } else if (workout) {
    const exerciseCount = workout.exercises?.length || 0
    parts.push(`Workout: ${workout.name} (${workout.focus}) — ${exerciseCount} exercises.`)
  }

  // Meals
  const mealProgress = mealsStore.weeklyMealProgress
  parts.push(`Meals this week: ${mealProgress.logged}/${mealProgress.planned} logged (${mealProgress.percentage}%).`)

  // Goals
  const goals = goalsStore.dashboardGoals
  if (goals.length > 0) {
    const goalList = goals.map(g => `${g.title} (${goalsStore.goalProgress(g)}%)`).join(', ')
    parts.push(`Focus goals: ${goalList}.`)
  }

  // Weekly fitness
  const wc = fitnessStore.weeklyWorkoutCount
  parts.push(`Workouts this week: ${wc.completed}/${wc.planned}.`)

  // Energy/sleep
  if (userStore.dailyCheckinDone) {
    parts.push(`Energy: ${userStore.energy}, Sleep: ${userStore.sleepQuality}.`)
  }

  const prompt = `Give me a concise morning briefing. Here's my data:\n\n${parts.join('\n')}\n\nKeep it to 3-4 sentences. Be direct, not motivational. Tell me what I need to know.`

  aiStore.openWithMessage(prompt)
}
</script>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/BriefMeButton.vue
git commit -m "feat: Brief Me button — on-demand AI day briefing"
```

---

## Task 10: WeeklyProgress Component

**Files:**
- Create: `src/components/dashboard/WeeklyProgress.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div class="bg-slate-800 rounded-xl p-3">
    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">This Week</div>

    <div class="flex flex-col gap-3">
      <!-- Workouts Ring -->
      <div class="flex items-center gap-2">
        <div class="relative w-9 h-9 shrink-0">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#334155" stroke-width="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke="#22c55e" stroke-width="3"
              :stroke-dasharray="`${workoutDash} ${circumference}`"
              stroke-linecap="round"
              transform="rotate(-90 18 18)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-green-400">
            {{ wc.completed }}/{{ wc.planned }}
          </div>
        </div>
        <div>
          <div class="text-xs font-semibold">Workouts</div>
          <div class="text-[10px] text-slate-500">{{ wc.planned - wc.completed }} remaining</div>
        </div>
      </div>

      <!-- Meals Ring -->
      <div class="flex items-center gap-2">
        <div class="relative w-9 h-9 shrink-0">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#334155" stroke-width="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke="#3b82f6" stroke-width="3"
              :stroke-dasharray="`${mealDash} ${circumference}`"
              stroke-linecap="round"
              transform="rotate(-90 18 18)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-blue-400">
            {{ mp.percentage }}%
          </div>
        </div>
        <div>
          <div class="text-xs font-semibold">Meals</div>
          <div class="text-[10px] text-slate-500">{{ mp.logged }}/{{ mp.planned }} logged</div>
        </div>
      </div>

      <!-- Goals Ring -->
      <div class="flex items-center gap-2">
        <div class="relative w-9 h-9 shrink-0">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#334155" stroke-width="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke="#a78bfa" stroke-width="3"
              :stroke-dasharray="`${goalDash} ${circumference}`"
              stroke-linecap="round"
              transform="rotate(-90 18 18)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-purple-400">
            {{ goalProgress }}%
          </div>
        </div>
        <div>
          <div class="text-xs font-semibold">Goals</div>
          <div class="text-[10px] text-slate-500">{{ activeGoalCount }} active</div>
        </div>
      </div>
    </div>

    <!-- Last Workout -->
    <div v-if="lastWorkout" class="mt-3 pt-2 border-t border-slate-700">
      <div class="text-[10px] text-slate-500">
        Last: {{ lastWorkout.name }}, {{ lastWorkout.duration }}min, +{{ lastWorkout.xp }} XP
      </div>
    </div>

    <!-- Volume Trend -->
    <div v-if="trend.direction !== 'flat'" class="mt-1">
      <div class="text-[10px]" :class="trend.direction === 'up' ? 'text-green-400' : 'text-red-400'">
        {{ trend.direction === 'up' ? '↑' : '↓' }} {{ trend.percentage }}% volume vs last week
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'

const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const goalsStore = useGoalsStore()

const circumference = 2 * Math.PI * 15 // ~94.2

const wc = computed(() => fitnessStore.weeklyWorkoutCount)
const mp = computed(() => mealsStore.weeklyMealProgress)
const lastWorkout = computed(() => fitnessStore.lastCompletedWorkout)
const trend = computed(() => fitnessStore.volumeTrend)
const activeGoalCount = computed(() => goalsStore.activeGoals.length)

const goalProgress = computed(() => {
  const goals = goalsStore.activeGoals
  if (goals.length === 0) return 0
  const total = goals.reduce((sum, g) => sum + goalsStore.goalProgress(g), 0)
  return Math.round(total / goals.length)
})

const workoutDash = computed(() => {
  if (wc.value.planned === 0) return 0
  return (wc.value.completed / wc.value.planned) * circumference
})

const mealDash = computed(() => (mp.value.percentage / 100) * circumference)

const goalDash = computed(() => (goalProgress.value / 100) * circumference)
</script>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/WeeklyProgress.vue
git commit -m "feat: WeeklyProgress — 3 progress rings with volume trend"
```

---

## Task 11: TodayChecklist Component

**Files:**
- Create: `src/components/dashboard/TodayChecklist.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div class="bg-slate-800 rounded-xl p-3">
    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Today</div>

    <div class="flex flex-col gap-2">
      <!-- Workout -->
      <div class="flex items-start gap-2">
        <div
          class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
          :class="workoutStatus.class"
        >
          <Check v-if="workoutStatus.done" class="w-2.5 h-2.5" />
        </div>
        <div>
          <div class="text-xs font-semibold">{{ workoutStatus.title }}</div>
          <div class="text-[10px] text-slate-500">{{ workoutStatus.subtitle }}</div>
        </div>
      </div>

      <!-- Meals -->
      <div class="flex items-start gap-2">
        <div
          class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
          :class="mealStatus.class"
        >
          <Check v-if="mealStatus.done" class="w-2.5 h-2.5" />
        </div>
        <div>
          <div class="text-xs font-semibold">Meals</div>
          <div class="text-[10px] text-slate-500">{{ mealStatus.subtitle }}</div>
        </div>
      </div>

      <!-- Goals -->
      <div class="flex items-start gap-2">
        <div
          class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5"
          :class="goalStatus.class"
        ></div>
        <div>
          <div class="text-xs font-semibold">Goals</div>
          <div class="text-[10px] text-slate-500">{{ goalStatus.subtitle }}</div>
        </div>
      </div>

      <!-- Schedule (if connected) -->
      <div v-if="calendarStore.connected || calendarStore.todaysEvents.length > 0" class="flex items-start gap-2">
        <div class="w-[18px] h-[18px] rounded-full border-2 border-slate-500 shrink-0 mt-0.5"></div>
        <div>
          <div class="text-xs font-semibold">Schedule</div>
          <div class="text-[10px] text-slate-500">{{ scheduleSubtitle }}</div>
        </div>
      </div>
      <router-link
        v-else-if="!calendarStore.loading"
        to="/settings"
        class="text-[10px] text-blue-400 hover:text-blue-300 ml-7"
      >
        Connect calendar
      </router-link>

      <!-- Daily Check-in -->
      <div class="flex items-start gap-2">
        <div
          class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
          :class="userStore.dailyCheckinDone ? 'border-green-500 bg-green-500' : 'border-slate-500'"
        >
          <Check v-if="userStore.dailyCheckinDone" class="w-2.5 h-2.5 text-slate-900" />
        </div>
        <div>
          <div class="text-xs font-semibold">Daily Check-in</div>
          <div class="text-[10px] text-slate-500">
            {{ userStore.dailyCheckinDone
              ? `Energy: ${userStore.energy}, Sleep: ${userStore.sleepQuality}`
              : 'Energy & sleep not logged'
            }}
          </div>
        </div>
      </div>

      <!-- Hydration -->
      <div class="flex items-start gap-2">
        <div
          class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
          :class="hydrationStatus.class"
        >
          <Check v-if="hydrationStatus.done" class="w-2.5 h-2.5 text-slate-900" />
        </div>
        <div>
          <div class="text-xs font-semibold">Water</div>
          <div class="text-[10px] text-slate-500">{{ userStore.waterGlasses }}/8 glasses</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'
import { useUserStore } from '@/stores/user'
import { useCalendarStore } from '@/stores/calendar'

const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const goalsStore = useGoalsStore()
const userStore = useUserStore()
const calendarStore = useCalendarStore()

const workoutStatus = computed(() => {
  const workout = fitnessStore.todaysWorkout
  if (!fitnessStore.activeProgram) {
    return { title: 'No program', subtitle: 'Set up a program', class: 'border-slate-500', done: false }
  }
  if (workout?.is_rest_day) {
    return { title: 'Rest Day', subtitle: 'Recovery day', class: 'border-green-500 bg-green-500/20', done: false }
  }

  // Check if completed today
  const today = new Date().toISOString().split('T')[0]
  const completed = fitnessStore.recentLogs.find(
    l => l.finished_at && l.started_at?.split('T')[0] === today
  )

  if (completed) {
    return {
      title: `${workout?.name || 'Workout'}`,
      subtitle: `Done — ${completed.duration_min}min, +${completed.xp_earned} XP`,
      class: 'border-green-500 bg-green-500',
      done: true
    }
  }

  if (workout) {
    const count = workout.exercises?.length || 0
    return {
      title: workout.name,
      subtitle: `${workout.focus} · ${count} exercises`,
      class: 'border-green-500',
      done: false
    }
  }

  return { title: 'No workout today', subtitle: '', class: 'border-slate-500', done: false }
})

const mealStatus = computed(() => {
  const logged = mealsStore.todaysMeals?.length || 0
  // Count today's planned meals from plan_data
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayName = dayNames[new Date().getDay()]
  const todayPlan = mealsStore.weekPlan?.plan_data?.[todayName]
  const planned = todayPlan ? Object.keys(todayPlan).filter(k => todayPlan[k]).length : 4

  if (logged >= planned && planned > 0) {
    return { subtitle: `${logged}/${planned} logged today`, class: 'border-green-500 bg-green-500', done: true }
  }
  if (logged > 0) {
    return { subtitle: `${logged}/${planned} logged today`, class: 'border-amber-500', done: false }
  }
  return { subtitle: `0/${planned} logged today`, class: 'border-slate-500', done: false }
})

const goalStatus = computed(() => {
  const active = goalsStore.activeGoals
  if (active.length === 0) return { subtitle: 'No active goals', class: 'border-slate-500' }

  // Check for KRs with approaching deadlines (within 7 days)
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  let dueCount = 0
  active.forEach(g => {
    g.key_results?.forEach(kr => {
      if (kr.deadline && kr.deadline <= soon && kr.current_value < kr.target_value) {
        dueCount++
      }
    })
  })

  if (dueCount > 0) {
    return { subtitle: `${dueCount} key results due`, class: 'border-amber-500' }
  }
  return { subtitle: 'All on track', class: 'border-green-500' }
})

const hydrationStatus = computed(() => {
  const glasses = userStore.waterGlasses || 0
  if (glasses >= 8) return { class: 'border-green-500 bg-green-500', done: true }
  if (glasses > 0) return { class: 'border-amber-500', done: false }
  return { class: 'border-slate-500', done: false }
})

const scheduleSubtitle = computed(() => {
  const events = calendarStore.todaysEvents
  if (events.length === 0) return 'No events today'

  const next = calendarStore.nextEvent
  if (next) {
    const time = new Date(next.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `${events.length} event${events.length > 1 ? 's' : ''}, next at ${time}`
  }
  return `${events.length} event${events.length > 1 ? 's' : ''} today`
})
</script>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/TodayChecklist.vue
git commit -m "feat: TodayChecklist — status dots for workout, meals, goals, schedule, check-in"
```

---

## Task 12: GoalProgress Component

**Files:**
- Create: `src/components/dashboard/GoalProgress.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div>
    <div class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Goal Progress</div>

    <!-- Empty state -->
    <div v-if="goals.length === 0" class="bg-slate-800 rounded-xl p-4 text-center">
      <p class="text-sm text-slate-400">No active goals yet</p>
      <router-link to="/goals" class="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">
        Set your first goal
      </router-link>
    </div>

    <!-- Goal cards -->
    <div v-else class="flex flex-col gap-2">
      <router-link
        v-for="goal in goals"
        :key="goal.id"
        :to="{ path: '/goals', query: { expand: goal.id } }"
        class="bg-slate-800 rounded-xl p-3.5 block hover:bg-slate-750 transition-colors"
      >
        <!-- Title + progress % -->
        <div class="flex justify-between items-center mb-2">
          <div class="text-sm font-semibold truncate pr-2">{{ goal.title }}</div>
          <div class="text-xs font-bold text-purple-400 shrink-0">{{ progress(goal) }}%</div>
        </div>

        <!-- Progress bar -->
        <div class="bg-slate-700 rounded h-1.5 mb-2">
          <div
            class="bg-purple-500 rounded h-full transition-all duration-500"
            :style="{ width: `${progress(goal)}%` }"
          ></div>
        </div>

        <!-- Top 2 KRs -->
        <div class="flex flex-wrap gap-x-3 gap-y-0.5">
          <div
            v-for="kr in goal.key_results?.slice(0, 2)"
            :key="kr.id"
            class="text-[10px] text-slate-500"
          >
            {{ kr.title }}: <span class="text-slate-300">{{ kr.current_value }} / {{ kr.target_value }}</span>
          </div>
        </div>
      </router-link>

      <!-- View all link -->
      <router-link
        v-if="goalsStore.activeGoals.length > 3"
        to="/goals"
        class="text-xs text-blue-400 hover:text-blue-300 text-center mt-1"
      >
        View all {{ goalsStore.activeGoals.length }} goals
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGoalsStore } from '@/stores/goals'

const goalsStore = useGoalsStore()

const goals = computed(() => goalsStore.dashboardGoals)

function progress(goal) {
  return goalsStore.goalProgress(goal)
}
</script>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/GoalProgress.vue
git commit -m "feat: GoalProgress — focused goals with progress bars and KR snapshots"
```

---

## Task 13: UpNextCards Component

**Files:**
- Create: `src/components/dashboard/UpNextCards.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div>
    <div class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Up Next</div>

    <!-- All done -->
    <div v-if="cards.length === 0" class="bg-slate-800 rounded-xl p-4 text-center">
      <p class="text-sm text-slate-400">You're all caught up</p>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="card in cards"
        :key="card.key"
        class="bg-slate-800 rounded-xl p-3.5 flex justify-between items-center"
        :class="`border-l-[3px] ${card.borderClass}`"
      >
        <div class="min-w-0 pr-3">
          <div class="text-sm font-semibold" :class="card.muted ? 'text-slate-500' : ''">{{ card.title }}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">{{ card.subtitle }}</div>
        </div>
        <button
          v-if="card.action"
          @click="card.action.handler"
          class="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold"
          :class="card.action.class"
        >
          {{ card.action.label }}
        </button>
        <Check v-else-if="card.muted" class="w-4 h-4 text-green-500 shrink-0" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Check } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useUserStore } from '@/stores/user'
import { getGreeting } from '@/lib/constants'

const emit = defineEmits(['openCheckin'])

const router = useRouter()
const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const userStore = useUserStore()

const cards = computed(() => {
  const result = []
  const incomplete = []
  const completed = []

  // Workout card
  const workout = fitnessStore.todaysWorkout
  const today = new Date().toISOString().split('T')[0]
  const completedLog = fitnessStore.recentLogs.find(
    l => l.finished_at && l.started_at?.split('T')[0] === today
  )

  if (!fitnessStore.activeProgram) {
    incomplete.push({
      key: 'workout-setup',
      title: 'Set up a program',
      subtitle: 'Create your training program to get started',
      borderClass: 'border-green-500',
      action: {
        label: 'Setup',
        class: 'bg-green-500 text-slate-900',
        handler: () => router.push('/fitness')
      }
    })
  } else if (workout?.is_rest_day) {
    completed.push({
      key: 'workout-rest',
      title: 'Rest Day — Recovery',
      subtitle: 'Let your body rebuild',
      borderClass: 'border-green-500/50',
      muted: false
    })
  } else if (completedLog) {
    completed.push({
      key: 'workout-done',
      title: `Completed: ${workout?.name || 'Workout'}`,
      subtitle: `${completedLog.duration_min}min, +${completedLog.xp_earned} XP`,
      borderClass: 'border-green-500/50',
      muted: true
    })
  } else if (workout) {
    const count = workout.exercises?.length || 0
    incomplete.push({
      key: 'workout',
      title: `${workout.name} — ${workout.focus}`,
      subtitle: `${count} exercises · ~${count * 8}min`,
      borderClass: 'border-green-500',
      action: {
        label: 'Start',
        class: 'bg-green-500 text-slate-900',
        handler: async () => {
          const logId = await fitnessStore.startWorkout(workout.id)
          if (logId) router.push(`/fitness/workout/${logId}`)
        }
      }
    })
  }

  // Meal card
  const nextMeal = mealsStore.nextMealToLog
  if (nextMeal) {
    const typeLabel = nextMeal.type.charAt(0).toUpperCase() + nextMeal.type.slice(1)
    incomplete.push({
      key: 'meal',
      title: `Log ${typeLabel}`,
      subtitle: nextMeal.planned ? `Planned: ${nextMeal.planned}` : 'No plan for this meal',
      borderClass: 'border-blue-500',
      action: {
        label: 'Log',
        class: 'bg-blue-500 text-white',
        handler: () => router.push('/meals')
      }
    })
  }

  // Hydration card (always visible)
  const glasses = userStore.waterGlasses || 0
  const waterGoal = 8
  if (glasses < waterGoal) {
    incomplete.push({
      key: 'water',
      title: `Water — ${glasses}/${waterGoal} glasses`,
      subtitle: `${waterGoal - glasses} more to hit your goal`,
      borderClass: 'border-sky-400',
      action: {
        label: '+1',
        class: 'bg-sky-400 text-slate-900',
        handler: () => userStore.addWater()
      }
    })
  } else {
    completed.push({
      key: 'water-done',
      title: `Water — ${glasses}/${waterGoal} glasses`,
      subtitle: 'Goal reached!',
      borderClass: 'border-sky-400/50',
      muted: true
    })
  }

  // Daily check-in card
  if (!userStore.dailyCheckinDone) {
    incomplete.push({
      key: 'checkin',
      title: 'Daily Check-in',
      subtitle: "How's your energy? How'd you sleep?",
      borderClass: 'border-slate-500',
      action: {
        label: 'Log',
        class: 'bg-slate-600 text-white',
        handler: () => {
          // Emit event for parent to handle (inline form or modal)
          emit('openCheckin')
        }
      }
    })
  }

  // Order by time of day
  const greeting = getGreeting()
  if (greeting === 'Morning') {
    // Breakfast first, then workout
    incomplete.sort((a, b) => {
      if (a.key === 'meal') return -1
      if (b.key === 'meal') return 1
      return 0
    })
  } else if (greeting === 'Afternoon') {
    // Workout first if not done
    incomplete.sort((a, b) => {
      if (a.key === 'workout') return -1
      if (b.key === 'workout') return 1
      return 0
    })
  } else if (greeting === 'Evening') {
    // Dinner first, then check-in
    incomplete.sort((a, b) => {
      if (a.key === 'meal') return -1
      if (b.key === 'meal') return 1
      if (a.key === 'checkin') return -1
      if (b.key === 'checkin') return 1
      return 0
    })
  }

  return [...incomplete, ...completed]
})
</script>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/UpNextCards.vue
git commit -m "feat: UpNextCards — smart action cards with context-aware ordering"
```

---

## Task 14: AvatarCompanion Component

**Files:**
- Create: `src/components/dashboard/AvatarCompanion.vue`

- [ ] **Step 1: Create the component**

This component renders a simple SVG avatar that evolves in appearance based on stage, with mood-based colors. Uses procedural SVG (no external art files needed for v1).

```vue
<template>
  <div class="relative">
    <button @click="showDetail = !showDetail" class="focus:outline-none">
      <svg :width="size" :height="size" viewBox="0 0 48 48">
        <!-- Body -->
        <circle
          :cx="24" :cy="bodyY"
          :r="bodyRadius"
          :fill="bodyColor"
          :opacity="mood === 'sad' ? 0.5 : 1"
        >
          <!-- Idle bounce for happy -->
          <animate
            v-if="mood === 'happy'"
            attributeName="cy"
            :values="`${bodyY};${bodyY - 2};${bodyY}`"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>

        <!-- Eyes -->
        <circle :cx="24 - eyeOffset" :cy="eyeY" r="2" fill="#0f172a" />
        <circle :cx="24 + eyeOffset" :cy="eyeY" r="2" fill="#0f172a" />

        <!-- Mouth -->
        <path
          v-if="mood === 'happy'"
          :d="`M${24 - mouthWidth} ${mouthY} Q24 ${mouthY + 4} ${24 + mouthWidth} ${mouthY}`"
          fill="none" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"
        />
        <line
          v-else-if="mood === 'tired'"
          :x1="24 - mouthWidth" :y1="mouthY" :x2="24 + mouthWidth" :y2="mouthY"
          stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"
        />
        <path
          v-else-if="mood === 'sad'"
          :d="`M${24 - mouthWidth} ${mouthY + 3} Q24 ${mouthY - 1} ${24 + mouthWidth} ${mouthY + 3}`"
          fill="none" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"
        />
        <line
          v-else
          :x1="24 - mouthWidth" :y1="mouthY" :x2="24 + mouthWidth" :y2="mouthY"
          stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"
        />

        <!-- Crown/extras for higher stages -->
        <polygon
          v-if="stage >= 3"
          :points="crownPoints"
          :fill="crownColor"
          :opacity="mood === 'sad' ? 0.3 : 0.8"
        />

        <!-- Glow for stage 4+ -->
        <circle
          v-if="stage >= 4"
          cx="24" :cy="bodyY" :r="bodyRadius + 4"
          fill="none" :stroke="glowColor" stroke-width="1" opacity="0.4"
        >
          <animate
            attributeName="opacity"
            values="0.2;0.5;0.2"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>

        <!-- Mythic aura for stage 5 -->
        <circle
          v-if="stage >= 5"
          cx="24" :cy="bodyY" :r="bodyRadius + 8"
          fill="none" :stroke="glowColor" stroke-width="0.5" opacity="0.2"
        >
          <animate
            attributeName="r"
            :values="`${bodyRadius + 6};${bodyRadius + 10};${bodyRadius + 6}`"
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </button>

    <!-- Detail popover (only on interactive instances) -->
    <div
      v-if="showDetail && interactive"
      class="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl z-50"
    >
      <div class="flex items-center gap-3 mb-3">
        <AvatarCompanion :stage="stage" :mood="mood" :size="56" :interactive="false" />
        <div>
          <div class="text-sm font-bold">{{ stageName }}</div>
          <div class="text-xs text-slate-400">Level {{ level }} · {{ levelTitle }}</div>
        </div>
      </div>

      <div class="text-xs text-slate-400 mb-2">Mood: <span class="text-slate-200 capitalize">{{ mood }}</span></div>

      <div class="flex flex-col gap-1 text-[10px] text-slate-500">
        <div>{{ workoutDone ? '✓' : '○' }} Workout</div>
        <div>{{ allMealsLogged ? '✓' : '○' }} Meals</div>
        <div>{{ checkinDone ? '✓' : '○' }} Check-in</div>
      </div>

      <div v-if="nextStageName" class="mt-3 pt-2 border-t border-slate-700 text-[10px] text-slate-500">
        Next evolution: <span class="text-purple-400">{{ nextStageName }}</span> at Level {{ nextStageLevel }}
      </div>
    </div>

    <!-- Backdrop to close popover -->
    <div v-if="showDetail && interactive" class="fixed inset-0 z-40" @click="showDetail = false"></div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  stage: { type: Number, default: 1 },
  mood: { type: String, default: 'neutral' },
  size: { type: Number, default: 44 },
  level: { type: Number, default: 1 },
  levelTitle: { type: String, default: '' },
  stageName: { type: String, default: 'Hatchling' },
  nextStageName: { type: String, default: null },
  nextStageLevel: { type: Number, default: null },
  workoutDone: { type: Boolean, default: false },
  allMealsLogged: { type: Boolean, default: false },
  checkinDone: { type: Boolean, default: false },
  interactive: { type: Boolean, default: true }
})

const showDetail = ref(false)

// Scale body based on stage
const bodyRadius = computed(() => 8 + props.stage * 2) // 10, 12, 14, 16, 18
const bodyY = computed(() => 28 - (props.stage - 1)) // shifts up slightly each stage
const eyeOffset = computed(() => 3 + props.stage * 0.5)
const eyeY = computed(() => bodyY.value - 2)
const mouthWidth = computed(() => 3 + props.stage * 0.5)
const mouthY = computed(() => bodyY.value + 3)

const moodColors = {
  happy: '#22c55e',
  neutral: '#3b82f6',
  tired: '#94a3b8',
  sad: '#64748b'
}

const bodyColor = computed(() => moodColors[props.mood] || moodColors.neutral)
const crownColor = computed(() => props.stage >= 4 ? '#eab308' : '#a78bfa')
const glowColor = computed(() => props.stage >= 5 ? '#eab308' : '#a78bfa')

const crownPoints = computed(() => {
  const cx = 24
  const top = bodyY.value - bodyRadius.value - 6
  const base = bodyY.value - bodyRadius.value + 1
  const w = bodyRadius.value * 0.6
  return `${cx - w},${base} ${cx - w / 2},${top} ${cx},${base - 2} ${cx + w / 2},${top} ${cx + w},${base}`
})
</script>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/AvatarCompanion.vue
git commit -m "feat: AvatarCompanion — procedural SVG with 5 stages and 4 moods"
```

---

## Task 15: Restructure DashboardView

**Files:**
- Modify: `src/views/DashboardView.vue` (complete rewrite)

- [ ] **Step 1: Rewrite DashboardView.vue**

Replace the entire file content with:

```vue
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds. May have warnings about unused imports if old components are still referenced elsewhere — that's fine, they'll be cleaned up in Task 17.

- [ ] **Step 3: Verify in dev server**

Run: `npm run dev`

Open the app in browser, navigate to dashboard. Verify:
- Greeting shows with correct time-of-day
- Streak and level pills display
- Avatar renders in top-right corner
- XP bar shows progress
- Brief Me button is clickable
- Split panel shows This Week rings and Today checklist
- Goal Progress shows goals (or empty state)
- Up Next shows action cards
- Daily check-in modal opens when clicking Log on check-in card

- [ ] **Step 4: Commit**

```bash
git add src/views/DashboardView.vue
git commit -m "feat: restructure dashboard — split layout with all new components"
```

---

## Task 16: Update GoalsView — Focus Toggle + Route Expand

**Files:**
- Modify: `src/views/GoalsView.vue`

- [ ] **Step 1: Add route query handling and focus toggle**

At the top of the `<script setup>`, add:

```javascript
import { useRoute } from 'vue-router'
import { Star } from 'lucide-vue-next'

const route = useRoute()
```

Add state for expanded goal:

```javascript
const expandedGoalId = ref(route.query.expand || null)
```

Add focus toggle handler:

```javascript
function toggleGoalFocus(goalId) {
  goalsStore.toggleFocus(goalId)
}
```

In the template, for each goal card, add a focus/star button:

```html
<button
  @click.stop="toggleGoalFocus(goal.id)"
  class="p-1 rounded transition-colors"
  :class="goal.is_focused ? 'text-yellow-400' : 'text-slate-500 hover:text-slate-300'"
  :title="goal.is_focused ? 'Unpin from dashboard' : 'Pin to dashboard'"
>
  <Star class="w-4 h-4" :fill="goal.is_focused ? 'currentColor' : 'none'" />
</button>
```

Also add auto-expand on mount if `route.query.expand` is set — the goal card for that ID should be open/expanded by default.

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Test**

Run: `npm run dev`

- Navigate to Goals page
- Verify star/pin button appears on each goal
- Click star — should fill yellow and persist
- Click again — should unfill
- Try pinning 3 goals, then a 4th — should not allow
- Navigate to `/goals?expand=<goalId>` — that goal should be expanded

- [ ] **Step 4: Commit**

```bash
git add src/views/GoalsView.vue
git commit -m "feat: goal focus toggle + auto-expand from route query"
```

---

## Task 17: Remove Old Dashboard Components

**Files:**
- Delete: `src/components/dashboard/WorkoutCard.vue`
- Delete: `src/components/dashboard/MealsCard.vue`
- Delete: `src/components/dashboard/GoalsCard.vue`
- Delete: `src/components/dashboard/AiInsight.vue`

- [ ] **Step 1: Verify no other files import the old components**

Search the codebase for imports of WorkoutCard, MealsCard, GoalsCard, AiInsight. The only consumer should have been the old DashboardView.vue which we already rewrote.

Run: `grep -r "WorkoutCard\|MealsCard\|GoalsCard\|AiInsight" src/ --include="*.vue" --include="*.js"`

Expected: No results (or only the old files themselves).

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/dashboard/WorkoutCard.vue
git rm src/components/dashboard/MealsCard.vue
git rm src/components/dashboard/GoalsCard.vue
git rm src/components/dashboard/AiInsight.vue
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: Build succeeds with no missing import errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove old dashboard components replaced by redesign"
```

---

## Task 18: Final Verification + Push

- [ ] **Step 1: Full build check**

Run: `npm run build`

Expected: Build succeeds, no errors.

- [ ] **Step 2: Dev server smoke test**

Run: `npm run dev`

Walk through the full dashboard:
1. Greeting + avatar + pills render correctly
2. XP bar shows progress
3. Brief Me opens AI panel with contextual prompt
4. This Week rings show correct data
5. Today checklist shows correct statuses
6. Goal Progress shows focused goals (or nearest deadline fallback)
7. Up Next cards show with correct ordering
8. Daily check-in modal works
9. Avatar mood updates when tasks are completed
10. Navigate to Goals — star/pin toggle works

- [ ] **Step 3: Push to remote**

```bash
git push origin master
```

Expected: Push succeeds, GitHub Actions deploys to Pages.

- [ ] **Step 4: Verify live deployment**

Check https://lamsimon86-create.github.io/life-os-v2/ loads with the new dashboard.

---

## Parallelization Notes

Tasks that can run in parallel (no dependencies between them):
- **Tasks 3-8** (avatar module, store updates, calendar store) — all independent
- **Tasks 9-14** (all new components) — independent of each other, but depend on Tasks 3-8 being done
- **Task 15** (DashboardView) — depends on all components (Tasks 9-14)
- **Task 16** (GoalsView) — depends only on Task 4 (goalsStore focus)
- **Task 17** (cleanup) — depends on Task 15

Recommended parallel groups:
1. Tasks 1-2 (migration + helper) — sequential, do first
2. Tasks 3-8 — all in parallel
3. Tasks 9-14 — all in parallel
4. Tasks 15-16 — in parallel
5. Tasks 17-18 — sequential, do last
