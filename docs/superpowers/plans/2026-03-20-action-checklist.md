# Action Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TodayChecklist + UpNextCards with a single ActionChecklist component that makes every daily item actionable, collapses completed items, and shows a progress bar for momentum.

**Architecture:** A single Vue component reads from existing stores (fitness, meals, user, supplement) to build an ordered list of today's actionable items. Incomplete items render with action buttons; completed items collapse into an expandable counter. DashboardView swaps the two old components for this one and moves WeeklyProgress to full-width.

**Tech Stack:** Vue 3.5 (Composition API), Pinia stores, Tailwind CSS 4, Lucide Vue Next icons.

**Spec:** `docs/superpowers/specs/2026-03-20-action-checklist-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/dashboard/ActionChecklist.vue` | Merged action checklist — progress bar, actionable items, collapsed completions |

### Modified Files
| File | Changes |
|------|---------|
| `src/views/DashboardView.vue` | Remove grid layout, swap TodayChecklist + UpNextCards for ActionChecklist, update imports |

### Deleted Files
| File | Replaced By |
|------|------------|
| `src/components/dashboard/TodayChecklist.vue` | ActionChecklist |
| `src/components/dashboard/UpNextCards.vue` | ActionChecklist |

---

## Task 1: Create ActionChecklist Component

**Files:**
- Create: `src/components/dashboard/ActionChecklist.vue`

- [ ] **Step 1: Create the component file with imports and store setup**

```vue
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Check, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { getGreeting } from '@/lib/constants'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useUserStore } from '@/stores/user'
import { useSupplementStore } from '@/stores/supplement'

const emit = defineEmits(['openCheckin'])
const router = useRouter()
const fitnessStore = useFitnessStore()
const mealsStore = useMealsStore()
const userStore = useUserStore()
const supplementStore = useSupplementStore()

const showCompleted = ref(false)
const showSupplements = ref(false)
</script>
```

- [ ] **Step 2: Add the today date and workout completion helpers**

```javascript
const today = computed(() => new Date().toISOString().split('T')[0])

const completedWorkoutLog = computed(() =>
  fitnessStore.recentLogs.find(
    l => l.finished_at && l.started_at?.split('T')[0] === today.value
  )
)

const workout = computed(() => fitnessStore.todaysWorkout)
```

- [ ] **Step 3: Add meal count helpers**

```javascript
const plannedMealCount = computed(() => {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayName = dayNames[new Date().getDay()]
  const todayPlan = mealsStore.weekPlan?.plan_data?.[todayName]
  if (!todayPlan) return 4
  return Object.keys(todayPlan).filter(k => todayPlan[k]).length
})

const mealsLogged = computed(() => mealsStore.todaysMeals?.length || 0)
```

- [ ] **Step 4: Add the completion status computeds**

```javascript
const isWorkoutDone = computed(() => !!completedWorkoutLog.value)
const isMealsDone = computed(() => !mealsStore.nextMealToLog)
const isWaterDone = computed(() => (userStore.waterGlasses || 0) >= userStore.waterGoal)
const isSuppsDone = computed(() => {
  const s = supplementStore.supplementStatus
  return s.due > 0 && s.taken >= s.due
})
const isCheckinDone = computed(() => userStore.dailyCheckinDone)
```

- [ ] **Step 5: Build the incomplete items list with smart ordering**

```javascript
const incompleteItems = computed(() => {
  const items = []

  // Workout
  if (!fitnessStore.activeProgram) {
    // "No program" — context row, not counted
  } else if (workout.value?.is_rest_day) {
    // Rest day — handled separately
  } else if (!isWorkoutDone.value && workout.value) {
    const count = workout.value.exercises?.length || 0
    items.push({
      key: 'workout',
      title: `${workout.value.name} — ${workout.value.focus}`,
      subtitle: `${count} exercises · ~${count * 8}min`,
      borderClass: 'border-green-500',
      action: {
        label: 'Start',
        class: 'bg-green-500 text-slate-900',
        handler: async () => {
          const logId = await fitnessStore.startWorkout(workout.value.id)
          if (logId) router.push(`/fitness/workout/${logId}`)
        }
      }
    })
  }

  // Meal
  const nextMeal = mealsStore.nextMealToLog
  if (nextMeal) {
    const typeLabel = nextMeal.type.charAt(0).toUpperCase() + nextMeal.type.slice(1)
    items.push({
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

  // Water
  if (!isWaterDone.value) {
    const glasses = userStore.waterGlasses || 0
    items.push({
      key: 'water',
      title: `Water — ${glasses}/${userStore.waterGoal} glasses`,
      subtitle: `${userStore.waterGoal - glasses} more to hit your goal`,
      borderClass: 'border-sky-400',
      action: {
        label: '+1',
        class: 'bg-sky-400 text-slate-900',
        handler: () => userStore.addWater()
      }
    })
  }

  // Supplements
  const suppStatus = supplementStore.supplementStatus
  if (suppStatus.due > 0 && !isSuppsDone.value) {
    items.push({
      key: 'supplements',
      title: `Supplements — ${suppStatus.taken}/${suppStatus.due}`,
      subtitle: `${suppStatus.due - suppStatus.taken} remaining`,
      borderClass: 'border-teal-400',
      expandable: true
    })
  }

  // Check-in
  if (!isCheckinDone.value) {
    items.push({
      key: 'checkin',
      title: 'Daily Check-in',
      subtitle: "How's your energy? How'd you sleep?",
      borderClass: 'border-slate-500',
      action: {
        label: 'Log',
        class: 'bg-slate-600 text-white',
        handler: () => emit('openCheckin')
      }
    })
  }

  // Smart ordering by time of day
  const greeting = getGreeting()
  if (greeting === 'Morning') {
    items.sort((a, b) => {
      if (a.key === 'meal') return -1
      if (b.key === 'meal') return 1
      return 0
    })
  } else if (greeting === 'Afternoon') {
    items.sort((a, b) => {
      if (a.key === 'workout') return -1
      if (b.key === 'workout') return 1
      return 0
    })
  } else if (greeting === 'Evening') {
    items.sort((a, b) => {
      if (a.key === 'meal') return -1
      if (b.key === 'meal') return 1
      if (a.key === 'checkin') return -1
      if (b.key === 'checkin') return 1
      return 0
    })
  }

  return items
})
```

- [ ] **Step 6: Build the completed items list**

```javascript
const completedItems = computed(() => {
  const items = []

  if (isWorkoutDone.value && workout.value) {
    items.push({
      key: 'workout-done',
      title: workout.value.name || 'Workout',
      subtitle: `${completedWorkoutLog.value.duration_min}min, +${completedWorkoutLog.value.xp_earned} XP`,
      borderClass: 'border-green-500/50'
    })
  }

  if (isMealsDone.value) {
    items.push({
      key: 'meals-done',
      title: 'Meals',
      subtitle: `${mealsLogged.value}/${plannedMealCount.value} logged today`,
      borderClass: 'border-blue-500/50'
    })
  }

  if (isWaterDone.value) {
    const glasses = userStore.waterGlasses || 0
    items.push({
      key: 'water-done',
      title: `Water — ${glasses}/${userStore.waterGoal} glasses`,
      subtitle: 'Goal reached!',
      borderClass: 'border-sky-400/50'
    })
  }

  if (isSuppsDone.value) {
    const s = supplementStore.supplementStatus
    items.push({
      key: 'supps-done',
      title: `Supplements — ${s.taken}/${s.due}`,
      subtitle: 'All taken',
      borderClass: 'border-teal-400/50'
    })
  }

  if (isCheckinDone.value) {
    items.push({
      key: 'checkin-done',
      title: 'Daily Check-in',
      subtitle: `Energy: ${userStore.energy}, Sleep: ${userStore.sleepQuality}`,
      borderClass: 'border-slate-500/50'
    })
  }

  return items
})
```

- [ ] **Step 7: Add context rows and progress computeds**

```javascript
const contextRows = computed(() => {
  const rows = []
  if (!fitnessStore.activeProgram) {
    rows.push({
      key: 'no-program',
      title: 'Set up a program',
      subtitle: 'Create your training program to get started',
      borderClass: 'border-green-500',
      action: {
        label: 'Setup',
        class: 'bg-green-500 text-slate-900',
        handler: () => router.push('/fitness')
      }
    })
  } else if (workout.value?.is_rest_day) {
    rows.push({
      key: 'rest-day',
      title: 'Rest Day — Recovery',
      subtitle: 'Let your body rebuild',
      borderClass: 'border-green-500/50'
    })
  }
  return rows
})

const totalItems = computed(() => incompleteItems.value.length + completedItems.value.length)
const doneCount = computed(() => completedItems.value.length)
const allDone = computed(() => totalItems.value > 0 && doneCount.value === totalItems.value)
```

- [ ] **Step 8: Write the template**

```vue
<template>
  <div class="bg-slate-800 rounded-xl overflow-hidden">
    <!-- Header with progress -->
    <div class="px-3.5 pt-3 pb-2">
      <div class="flex justify-between items-center mb-2">
        <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Today</div>
        <div class="text-xs text-slate-400 font-semibold">{{ doneCount }}/{{ totalItems }}</div>
      </div>
      <div class="bg-slate-700 rounded h-1.5">
        <div
          class="bg-green-500 rounded h-full transition-all duration-500"
          :style="{ width: totalItems > 0 ? `${(doneCount / totalItems) * 100}%` : '0%' }"
        ></div>
      </div>
    </div>

    <!-- Context rows (rest day, no program) -->
    <div v-for="row in contextRows" :key="row.key" class="px-3.5 py-3 border-t border-slate-700/50">
      <div class="flex justify-between items-center" :class="`border-l-[3px] ${row.borderClass} pl-3`">
        <div class="min-w-0 pr-3">
          <div class="text-sm font-semibold text-slate-400">{{ row.title }}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">{{ row.subtitle }}</div>
        </div>
        <button
          v-if="row.action"
          @click="row.action.handler"
          class="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold"
          :class="row.action.class"
        >
          {{ row.action.label }}
        </button>
      </div>
    </div>

    <!-- Incomplete items -->
    <div v-if="!allDone">
      <div
        v-for="item in incompleteItems"
        :key="item.key"
        class="px-3.5 py-3 border-t border-slate-700/50"
      >
        <div class="flex justify-between items-center" :class="`border-l-[3px] ${item.borderClass} pl-3`">
          <div class="min-w-0 pr-3">
            <div class="text-sm font-semibold">{{ item.title }}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">{{ item.subtitle }}</div>
          </div>
          <!-- Expand toggle for supplements -->
          <button
            v-if="item.expandable"
            @click="showSupplements = !showSupplements"
            class="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
          >
            <ChevronUp v-if="showSupplements" class="w-4 h-4" />
            <ChevronDown v-else class="w-4 h-4" />
          </button>
          <!-- Action button -->
          <button
            v-else-if="item.action"
            @click="item.action.handler"
            class="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold"
            :class="item.action.class"
          >
            {{ item.action.label }}
          </button>
        </div>

        <!-- Supplement checklist (expanded) -->
        <div v-if="item.key === 'supplements' && showSupplements" class="pl-3 mt-2 flex flex-col gap-1.5">
          <div
            v-for="supp in supplementStore.todaysSupplements"
            :key="supp.id"
            class="flex items-center justify-between"
          >
            <span class="text-xs" :class="supplementStore.isTaken(supp.id) ? 'text-slate-500 line-through' : ''">
              {{ supp.name }}
            </span>
            <button
              @click.stop="supplementStore.toggleSupplement(supp.id)"
              class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0"
              :class="supplementStore.isTaken(supp.id) ? 'border-teal-400 bg-teal-400' : 'border-slate-500 hover:border-teal-400'"
            >
              <Check v-if="supplementStore.isTaken(supp.id)" class="w-3 h-3 text-slate-900" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- All done state -->
    <div v-if="allDone" class="px-3.5 py-4 border-t border-slate-700/50 text-center">
      <div class="flex items-center justify-center gap-2">
        <span class="text-sm text-slate-300">All done for today</span>
        <Check class="w-4 h-4 text-green-500" />
      </div>
    </div>

    <!-- Collapsed completed counter -->
    <button
      v-if="completedItems.length > 0"
      @click="showCompleted = !showCompleted"
      class="w-full px-3.5 py-2.5 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-500 hover:text-slate-400 transition-colors"
    >
      <span>{{ completedItems.length }} completed</span>
      <ChevronUp v-if="showCompleted" class="w-3.5 h-3.5" />
      <ChevronDown v-else class="w-3.5 h-3.5" />
    </button>

    <!-- Expanded completed items -->
    <div v-if="showCompleted">
      <div
        v-for="item in completedItems"
        :key="item.key"
        class="px-3.5 py-2.5 border-t border-slate-700/50"
      >
        <div class="flex justify-between items-center" :class="`border-l-[3px] ${item.borderClass} pl-3`">
          <div class="min-w-0">
            <div class="text-sm text-slate-500">{{ item.title }}</div>
            <div class="text-[10px] text-slate-600 mt-0.5">{{ item.subtitle }}</div>
          </div>
          <Check class="w-4 h-4 text-green-500 shrink-0" />
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 9: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

Note: Build may warn about unused TodayChecklist/UpNextCards imports in DashboardView — that's expected, Task 2 fixes it.

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard/ActionChecklist.vue
git commit -m "feat: ActionChecklist — merged today checklist + up next with progress bar"
```

---

## Task 2: Update DashboardView — Swap Components

**Files:**
- Modify: `src/views/DashboardView.vue`

- [ ] **Step 1: Update imports**

Replace:
```javascript
import TodayChecklist from '@/components/dashboard/TodayChecklist.vue'
```
With:
```javascript
import ActionChecklist from '@/components/dashboard/ActionChecklist.vue'
```

Remove:
```javascript
import UpNextCards from '@/components/dashboard/UpNextCards.vue'
```

- [ ] **Step 2: Replace the grid layout and UpNextCards in the template**

Replace:
```html
<!-- 5. This Week | Today Split -->
<div class="grid grid-cols-2 gap-2.5">
  <WeeklyProgress />
  <TodayChecklist />
</div>
```
With:
```html
<!-- 5. This Week -->
<WeeklyProgress />

<!-- 6. Action Checklist -->
<ActionChecklist @open-checkin="openCheckinModal" />
```

Remove:
```html
<!-- 7. Up Next -->
<UpNextCards @open-checkin="openCheckinModal" />
```

- [ ] **Step 3: Update remaining comment numbers**

After the changes, the section order in comments should be:
1. Greeting + Avatar
2. XP Progress Bar
3. Destination Strip
4. Brief Me
5. This Week
6. Action Checklist
7. Macro Tracker
8. Insights

- [ ] **Step 4: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/views/DashboardView.vue
git commit -m "feat: wire ActionChecklist — replace TodayChecklist + UpNextCards"
```

---

## Task 3: Delete Old Components

**Files:**
- Delete: `src/components/dashboard/TodayChecklist.vue`
- Delete: `src/components/dashboard/UpNextCards.vue`

- [ ] **Step 1: Verify no remaining imports**

Search for `TodayChecklist` and `UpNextCards` in all `.vue` and `.js` files. DashboardView should already be updated.

- [ ] **Step 2: Delete the files**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2"
git rm src/components/dashboard/TodayChecklist.vue
git rm src/components/dashboard/UpNextCards.vue
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove TodayChecklist + UpNextCards — replaced by ActionChecklist"
```

---

## Task 4: Final Verification + Push

- [ ] **Step 1: Full build check**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 2: Push**

```bash
git push origin master
```

- [ ] **Step 3: Verify deployment**

Check at https://lamsimon86-create.github.io/life-os-v2/

---

## Parallelization Notes

1. Task 1 (ActionChecklist component) — do first
2. Task 2 (DashboardView wiring) — after Task 1
3. Task 3 (delete old components) — after Task 2
4. Task 4 (push) — last

Tasks are sequential — each depends on the previous.
