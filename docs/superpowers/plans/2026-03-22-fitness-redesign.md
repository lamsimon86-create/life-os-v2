# Fitness Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the fitness section with exercise substitution, optional RPE, adjustable rest timer, program editor, AI program builder, progression charts, PR tracking, and muscle group volume.

**Architecture:** 4 sub-projects executed sequentially: (1) database migration + store foundation, (2) workout experience (ExerciseCard, RestTimer, swap flow), (3) program management (editor, AI builder, history), (4) analytics (progression chart, PRs, volume). Each sub-project produces a working build.

**Tech Stack:** Vue 3.5 (Composition API), Pinia, Supabase (PostgreSQL + Edge Functions), Chart.js 4.4, Tailwind CSS 4, Lucide Vue Next icons.

**Spec:** `docs/superpowers/specs/2026-03-22-fitness-redesign-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/<timestamp>_fitness_redesign.sql` | Schema changes: rpe, substituted_for, archived_at, new exercises, index |
| `src/components/fitness/ExerciseSearch.vue` | Reusable exercise library search bottom sheet with muscle group filters |
| `src/views/DayEditorView.vue` | Program day editor: reorder/add/remove exercises, edit sets/reps/rest |
| `src/components/fitness/AIBuilder.vue` | Multi-step AI program generation form |
| `src/components/fitness/PersonalRecords.vue` | PR list display for History tab |
| `src/components/fitness/VolumeChart.vue` | Weekly muscle group volume bars for History tab |
| `src/lib/program-templates.js` | Hardcoded program templates (moved from FitnessView) |

### Modified Files
| File | Changes |
|------|---------|
| `src/stores/fitness.js` | New state (exerciseLibrary, archivedPrograms, personalRecords), ~15 new actions, modified logSet/hydrate, streak fix |
| `src/components/fitness/ExerciseCard.vue` | Swap button, RPE dropdown, inline rest timer, skip mechanic, remove WEIGHT_RATIOS |
| `src/components/fitness/RestTimer.vue` | Remove fixed positioning, add ±30s adjust buttons, accept onAdjust callback |
| `src/components/fitness/ProgramCard.vue` | Tappable days with exercise count + chevron, navigate to DayEditor |
| `src/components/fitness/HistoryChart.vue` | Dual-line chart (weight + est 1RM), stats row, internal data fetching |
| `src/views/FitnessView.vue` | Replace templates with AIBuilder, add program history, fix duplicate focus, restructure History tab |
| `src/views/WorkoutView.vue` | Pass RPE/substituted_for to logSet, exercise swap state, skip state |
| `src/router/index.js` | Add `/fitness/edit/:dayId` route |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/<timestamp>_fitness_redesign.sql`

- [ ] **Step 1: Create migration file**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npx supabase migration new fitness_redesign
```

- [ ] **Step 2: Write migration SQL**

Write to the generated file:

```sql
-- RPE tracking on workout sets
ALTER TABLE v2_workout_sets ADD COLUMN rpe integer;

-- Track exercise substitutions
ALTER TABLE v2_workout_sets ADD COLUMN substituted_for text;

-- Program archival
ALTER TABLE v2_fitness_programs ADD COLUMN archived_at timestamptz;

-- Add exercises not in existing seed (002_v2_seed.sql has ~40)
INSERT INTO v2_exercise_library (name, muscle_group, equipment, is_compound) VALUES
  ('Incline Dumbbell Press', 'chest', 'dumbbell', true),
  ('Cable Flyes', 'chest', 'cable', false),
  ('Chest Dips', 'chest', 'bodyweight', true),
  ('T-Bar Row', 'back', 'barbell', true),
  ('Dumbbell Shoulder Press', 'shoulders', 'dumbbell', true),
  ('Front Squat', 'legs', 'barbell', true),
  ('Goblet Squat', 'legs', 'dumbbell', true),
  ('Cable Curl', 'arms', 'cable', false),
  ('Tricep Dips', 'arms', 'bodyweight', true),
  ('Clean and Press', 'shoulders', 'barbell', true),
  ('Farmer''s Walk', 'core', 'dumbbell', true)
ON CONFLICT (name) DO NOTHING;

-- Index for exercise history queries (progression charts, PRs)
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise_history
  ON v2_workout_sets (user_id, exercise_name, created_at DESC)
  WHERE is_warmup = false;
```

- [ ] **Step 3: Push migration**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && echo "Y" | SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN npx supabase db push --linked
```

- [ ] **Step 4: Verify build still passes**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2"
git add supabase/migrations/
git commit -m "feat: fitness redesign migration — rpe, substituted_for, archived_at, new exercises"
```

---

## Task 2: Fitness Store — Foundation Actions

**Files:**
- Modify: `src/stores/fitness.js`

This task adds all new state, actions, and computeds needed by later tasks. No UI changes yet.

- [ ] **Step 1: Add new state refs**

After existing state refs (line ~17, after `previousWeekVolume`), add:

```javascript
const exerciseLibrary = ref([])
const archivedPrograms = ref([])
const personalRecords = ref([])
```

- [ ] **Step 2: Add `fetchExerciseLibrary` action**

After `deactivateProgram()` (line ~457), add:

```javascript
async function fetchExerciseLibrary() {
  const { data } = await supabase
    .from('v2_exercise_library')
    .select('*')
    .order('muscle_group')
    .order('name')
  exerciseLibrary.value = data || []
}

function searchExercises(query, muscleGroup) {
  let results = exerciseLibrary.value
  if (muscleGroup && muscleGroup !== 'all') {
    results = results.filter(e => e.muscle_group === muscleGroup)
  }
  if (query) {
    const q = query.toLowerCase()
    results = results.filter(e => e.name.toLowerCase().includes(q))
  }
  return results
}
```

- [ ] **Step 3: Add `fetchLastWeightForExercise` action**

```javascript
async function fetchLastWeightForExercise(exerciseName) {
  const user = useAuthStore().user
  const { data } = await supabase
    .from('v2_workout_sets')
    .select('weight, reps')
    .eq('user_id', user.id)
    .eq('exercise_name', exerciseName)
    .eq('is_warmup', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
```

- [ ] **Step 4: Add `fetchPersonalRecords` action**

```javascript
async function fetchPersonalRecords() {
  const user = useAuthStore().user
  const { data } = await supabase
    .from('v2_workout_sets')
    .select('exercise_name, weight, reps, created_at')
    .eq('user_id', user.id)
    .eq('is_warmup', false)
    .order('weight', { ascending: false })

  if (!data) { personalRecords.value = []; return }

  // Group by exercise, keep max weight
  const prMap = new Map()
  for (const set of data) {
    if (!prMap.has(set.exercise_name) || set.weight > prMap.get(set.exercise_name).weight) {
      prMap.set(set.exercise_name, {
        exercise_name: set.exercise_name,
        weight: set.weight,
        reps: set.reps,
        date: set.created_at
      })
    }
  }
  personalRecords.value = Array.from(prMap.values()).sort((a, b) => b.weight - a.weight)
}
```

- [ ] **Step 5: Add `fetchWeeklyVolume` action (muscle group breakdown)**

```javascript
async function fetchWeeklyMuscleVolume() {
  const user = useAuthStore().user
  const weekStart = getMondayWeekStart()
  const { data } = await supabase
    .from('v2_workout_sets')
    .select('exercise_name')
    .eq('user_id', user.id)
    .eq('is_warmup', false)
    .gte('created_at', weekStart)

  if (!data || exerciseLibrary.value.length === 0) return {}

  const libMap = new Map()
  for (const ex of exerciseLibrary.value) {
    libMap.set(ex.name.toLowerCase(), ex.muscle_group)
  }

  const volume = {}
  for (const set of data) {
    const group = libMap.get(set.exercise_name.toLowerCase())
    if (group) {
      volume[group] = (volume[group] || 0) + 1
    }
  }
  return volume
}
```

- [ ] **Step 6: Add program management actions**

```javascript
async function archiveProgram(programId) {
  const user = useAuthStore().user
  await supabase
    .from('v2_fitness_programs')
    .update({ is_active: false, archived_at: new Date().toISOString() })
    .eq('id', programId)
    .eq('user_id', user.id)
  activeProgram.value = null
  todaysWorkout.value = null
}

async function reactivateProgram(programId) {
  const user = useAuthStore().user
  // Deactivate current
  if (activeProgram.value) {
    await archiveProgram(activeProgram.value.id)
  }
  // Reactivate selected
  await supabase
    .from('v2_fitness_programs')
    .update({ is_active: true, archived_at: null })
    .eq('id', programId)
    .eq('user_id', user.id)
  await hydrate()
}

async function fetchArchivedPrograms() {
  const user = useAuthStore().user
  const { data } = await supabase
    .from('v2_fitness_programs')
    .select('id, name, source, created_at, archived_at')
    .eq('user_id', user.id)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
  archivedPrograms.value = data || []
}
```

- [ ] **Step 7: Add program editor actions**

```javascript
async function updateProgramDay(dayId, updates) {
  const user = useAuthStore().user
  await supabase
    .from('v2_program_days')
    .update(updates)
    .eq('id', dayId)
    .eq('user_id', user.id)
  await hydrate()
}

async function addExerciseToDay(dayId, exercise) {
  const user = useAuthStore().user
  const { data: existing } = await supabase
    .from('v2_program_exercises')
    .select('sort_order')
    .eq('program_day_id', dayId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (existing?.sort_order || 0) + 1

  await supabase.from('v2_program_exercises').insert({
    program_day_id: dayId,
    user_id: user.id,
    exercise_name: exercise.name,
    target_sets: exercise.sets || 3,
    target_reps_min: exercise.reps_min || 8,
    target_reps_max: exercise.reps_max || 12,
    rest_seconds: exercise.rest_seconds || 90,
    sort_order: nextOrder
  })
}

async function removeExerciseFromDay(exerciseId) {
  const user = useAuthStore().user
  await supabase
    .from('v2_program_exercises')
    .delete()
    .eq('id', exerciseId)
    .eq('user_id', user.id)
}

async function reorderExercises(dayId, exerciseIds) {
  const user = useAuthStore().user
  for (let i = 0; i < exerciseIds.length; i++) {
    await supabase
      .from('v2_program_exercises')
      .update({ sort_order: i })
      .eq('id', exerciseIds[i])
      .eq('user_id', user.id)
  }
}

async function updateExercise(exerciseId, updates) {
  const user = useAuthStore().user
  await supabase
    .from('v2_program_exercises')
    .update(updates)
    .eq('id', exerciseId)
    .eq('user_id', user.id)
}
```

- [ ] **Step 8: Add AI program builder action**

```javascript
async function createProgramFromAI(selectedDays, goal, experience, injuries) {
  const userStore = useUserStore()

  const prompt = `Build a training program for the user:

Available days: ${selectedDays.join(', ')}
Goal: ${goal}
Experience: ${experience}
Injuries/limitations: ${injuries || 'none'}
Current weight: ${userStore.profile?.weight_kg || 'unknown'} lbs

Respond with JSON only:
{
  "name": "Program Name",
  "days": [
    {
      "day_of_week": 0-6,
      "name": "Day Name",
      "focus": "Muscle focus",
      "is_rest_day": false,
      "exercises": [
        { "name": "Exercise Name", "sets": 3, "reps_min": 8, "reps_max": 10, "rest_seconds": 90 }
      ]
    }
  ]
}

Rules:
- Only schedule training on the available days
- All other days are rest days
- Use standard exercise names
- Weight exercises use lbs
- Compound movements first, isolation last
- If injuries are noted, avoid exercises that stress those areas`

  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      message: prompt,
      context: { page: 'fitness', task: 'program_generation' },
      conversationHistory: [],
      difficulty: userStore.difficulty || 'medium'
    }
  })

  if (error) throw error

  const match = data.message.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI did not return valid JSON')

  const parsed = JSON.parse(match[0])
  // Feed into existing createProgramFromTemplate
  await createProgramFromTemplate({
    name: parsed.name,
    days: parsed.days.map(d => ({
      ...d,
      exercises: (d.exercises || []).map(e => ({
        name: e.name,
        sets: e.sets,
        reps_min: e.reps_min,
        reps_max: e.reps_max,
        rest: e.rest_seconds
      }))
    }))
  })
}
```

- [ ] **Step 9: Modify `logSet` to accept rpe and substituted_for**

In `logSet()` (line ~221), the current implementation inserts `setData` directly. Update to include rpe and substituted_for:

```javascript
async function logSet(setData) {
  const { error } = await supabase
    .from('v2_workout_sets')
    .insert({
      ...setData,
      rpe: setData.rpe || null,
      substituted_for: setData.substituted_for || null
    })
  if (error) throw error
}
```

- [ ] **Step 10: Add `fetchExerciseLibrary` to `hydrate()`**

At the end of `hydrate()` (line ~165, inside the try block), add:

```javascript
if (exerciseLibrary.value.length === 0) {
  await fetchExerciseLibrary()
}
```

- [ ] **Step 11: Fix streak calculation**

Replace `calculateStreak()` (lines ~167-200) with rest-day-aware version:

```javascript
function calculateStreak(logs) {
  if (!logs || logs.length === 0) return 0

  // Get rest day numbers from active program
  const restDays = new Set()
  if (activeProgram.value?.days) {
    for (const day of activeProgram.value.days) {
      if (day.is_rest_day) restDays.add(day.day_of_week)
    }
  }

  const logDates = new Set(
    logs
      .filter(l => l.finished_at)
      .map(l => l.started_at.split('T')[0])
  )

  let streak = 0
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Start from today or yesterday
  let checkDate = new Date(today)
  if (!logDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0]
    const dayOfWeek = checkDate.getDay()

    if (restDays.has(dayOfWeek)) {
      // Programmed rest day — skip, don't break streak
      checkDate.setDate(checkDate.getDate() - 1)
      continue
    }

    if (logDates.has(dateStr)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}
```

- [ ] **Step 12: Add `exerciseNames` computed and update return statement**

Add computed for exercise name dropdown:

```javascript
const exerciseNames = computed(() => exerciseLibrary.value.map(e => e.name))
```

Add all new state, computeds, and actions to the store's return object:

```javascript
return {
  // ... existing returns ...
  exerciseLibrary,
  exerciseNames,
  archivedPrograms,
  personalRecords,
  fetchExerciseLibrary,
  searchExercises,
  fetchLastWeightForExercise,
  fetchPersonalRecords,
  fetchWeeklyMuscleVolume,
  archiveProgram,
  reactivateProgram,
  fetchArchivedPrograms,
  updateProgramDay,
  addExerciseToDay,
  removeExerciseFromDay,
  reorderExercises,
  updateExercise,
  createProgramFromAI
}
```

- [ ] **Step 13: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 14: Commit**

```bash
git add src/stores/fitness.js
git commit -m "feat: fitness store — exercise library, PRs, volume, program editor, AI builder, streak fix"
```

---

## Task 3: ExerciseSearch Component

**Files:**
- Create: `src/components/fitness/ExerciseSearch.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div v-if="visible" class="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" @click.self="close">
    <div class="bg-slate-800 rounded-t-xl w-full max-w-md max-h-[80vh] flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-slate-700">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-sm font-bold">{{ title }}</h3>
          <button @click="close" class="text-slate-400 hover:text-slate-200">
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            placeholder="Search exercises..."
            class="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <!-- Muscle group filters -->
      <div class="px-4 py-2 flex gap-2 overflow-x-auto border-b border-slate-700/50">
        <button
          v-for="group in groups"
          :key="group"
          @click="selectedGroup = group"
          class="shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors"
          :class="selectedGroup === group
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
            : 'bg-slate-700 text-slate-400'"
        >
          {{ group === 'all' ? 'All' : group.charAt(0).toUpperCase() + group.slice(1) }}
        </button>
      </div>

      <!-- Results -->
      <div class="flex-1 overflow-y-auto">
        <div
          v-for="exercise in results"
          :key="exercise.id"
          @click="select(exercise)"
          class="px-4 py-3 border-b border-slate-700/30 hover:bg-slate-700/50 cursor-pointer flex justify-between items-center"
        >
          <div>
            <div class="text-sm font-semibold">{{ exercise.name }}</div>
            <div class="text-[10px] text-slate-500">
              {{ exercise.muscle_group }} · {{ exercise.equipment }} · {{ exercise.is_compound ? 'Compound' : 'Isolation' }}
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-slate-500" />
        </div>
        <div v-if="results.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
          No exercises found
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { X, Search, ChevronRight } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'
import { MUSCLE_GROUPS } from '@/lib/constants'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: 'Select Exercise' },
  initialGroup: { type: String, default: 'all' }
})

const emit = defineEmits(['select', 'close'])

const fitnessStore = useFitnessStore()
const query = ref('')
const selectedGroup = ref(props.initialGroup)
const searchInput = ref(null)

const groups = computed(() => ['all', ...MUSCLE_GROUPS])

const results = computed(() => fitnessStore.searchExercises(query.value, selectedGroup.value))

watch(() => props.visible, async (v) => {
  if (v) {
    selectedGroup.value = props.initialGroup
    query.value = ''
    await nextTick()
    searchInput.value?.focus()
  }
})

function select(exercise) {
  emit('select', exercise)
  emit('close')
}

function close() {
  emit('close')
}
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/fitness/ExerciseSearch.vue
git commit -m "feat: ExerciseSearch — reusable exercise library search with muscle group filters"
```

---

## Task 4: ExerciseCard Redesign

**Files:**
- Modify: `src/components/fitness/ExerciseCard.vue`

- [ ] **Step 1: Update props and emits**

Replace existing props/emits (lines ~101-124) to add swap and skip support:

Add to props:
```javascript
exerciseLibrary: { type: Array, default: () => [] }
```

Update emits:
```javascript
const emit = defineEmits(['log-set', 'swap', 'start-rest'])
```

- [ ] **Step 2: Add swap/skip/RPE state and imports**

Add to imports (add `ExerciseSearch`):
```javascript
import ExerciseSearch from '@/components/fitness/ExerciseSearch.vue'
```

Add state after existing refs:
```javascript
const skipped = ref(false)
const swappedExercise = ref(null)
const showExerciseSearch = ref(false)
const rpeInputs = reactive({})

const displayExercise = computed(() => swappedExercise.value || props.exercise)
const isSwapped = computed(() => !!swappedExercise.value)
const originalName = computed(() => props.exercise.exercise_name)
```

- [ ] **Step 3: Remove WEIGHT_RATIOS and estimateWeight**

Delete the `WEIGHT_RATIOS` object (lines ~130-134) and `estimateWeight` function (lines ~136-144). Update `initInputs` (line ~146) to remove the weight estimation fallback — when no `previousSets` data exists, set weight to empty string:

```javascript
// In initInputs, replace the estimateWeight fallback:
// OLD: weight: estimateWeight(props.exercise.exercise_name) || ''
// NEW: weight: ''
```

- [ ] **Step 4: Add swap handler**

```javascript
async function handleSwap(exercise) {
  swappedExercise.value = {
    ...props.exercise,
    exercise_name: exercise.name,
    _muscle_group: exercise.muscle_group
  }
  showExerciseSearch.value = false

  // Pre-fill weight from last session with substitute exercise
  const fitnessStore = useFitnessStore()
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
```

- [ ] **Step 5: Update handleLogSet to include RPE and substituted_for**

In `handleLogSet` (line ~192), update the emitted data:

```javascript
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
}
```

- [ ] **Step 6: Update template — header with Swap button and skip**

Replace the header section (lines ~2-20) with:

```html
<!-- Skip overlay -->
<div v-if="skipped" class="bg-slate-800 rounded-xl p-4 opacity-40">
  <div class="flex justify-between items-center">
    <div>
      <div class="text-sm font-semibold line-through">{{ displayExercise.exercise_name }}</div>
      <div class="text-xs text-slate-500">Skipped</div>
    </div>
    <button @click="skipped = false" class="text-xs text-blue-400">Undo Skip</button>
  </div>
</div>

<!-- Normal card -->
<div v-else class="bg-slate-800 rounded-xl p-3.5" :class="isSwapped ? 'border-l-[3px] border-blue-500' : ''">
  <!-- Header -->
  <div class="flex justify-between items-center mb-2">
    <div class="min-w-0 flex-1" @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointerleave="onPointerUp">
      <div class="text-sm font-semibold">{{ displayExercise.exercise_name }}</div>
      <div v-if="isSwapped" class="text-[10px] text-blue-400">Swapped for {{ originalName }}</div>
      <div class="text-[11px] text-slate-500">
        {{ displayExercise.target_sets }} sets x {{ displayExercise.target_reps_min }}-{{ displayExercise.target_reps_max }} reps
      </div>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button v-if="isSwapped && completedSets === 0" @click="undoSwap"
        class="px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500">
        Undo
      </button>
      <button v-else @click="showExerciseSearch = true"
        class="px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500">
        Swap
      </button>
      <div class="bg-slate-700 px-2 py-0.5 rounded-lg text-[11px] font-semibold">
        {{ completedSets }}/{{ displayExercise.target_sets }}
      </div>
    </div>
  </div>
```

- [ ] **Step 7: Update template — set rows with RPE dropdown**

For each set row input section, add the RPE dropdown after the reps stepper:

```html
<!-- RPE (optional) -->
<select
  v-model="rpeInputs[setNum]"
  class="bg-slate-700 border-none text-slate-400 rounded-md text-[10px] w-[38px] py-1 px-0.5"
>
  <option value="">RPE</option>
  <option v-for="r in [6,7,8,9,10]" :key="r" :value="r">{{ r }}</option>
</select>
```

For logged set display rows, show RPE if present:

```html
<span v-if="getLoggedSet(setNum)?.rpe" class="text-[10px] text-amber-400">
  RPE {{ getLoggedSet(setNum).rpe }}
</span>
```

- [ ] **Step 8: Add ExerciseSearch, skip long-press handlers, and PR detection to template**

Add long-press skip handler (using pointer events, Vue has no native long-press):

```javascript
let skipTimer = null
function onPointerDown() {
  skipTimer = setTimeout(() => { skipped.value = true }, 600)
}
function onPointerUp() {
  clearTimeout(skipTimer)
}
```

Note: The header div already has `@pointerdown`/`@pointerup`/`@pointerleave` from Step 6.

Add PR detection — add prop and computed:

```javascript
// Add to props:
currentPRs: { type: Object, default: () => ({}) }  // { exerciseName: maxWeight }

// Add to handleLogSet, after the emit:
const prWeight = props.currentPRs[displayExercise.value.exercise_name]
if (prWeight && Number(input.weight) > prWeight) {
  newPR.value = true
  setTimeout(() => { newPR.value = false }, 3000)
}
```

Add state: `const newPR = ref(false)`

Add to template, after the Log button in the set row:
```html
<div v-if="newPR" class="absolute inset-0 bg-amber-500/10 rounded-lg pointer-events-none animate-pulse" />
```

Add after the completion badge in the header:
```html
<span v-if="newPR" class="text-[10px] font-bold text-amber-400 animate-pulse">NEW PR</span>
```

At the end of the template (before closing `</template>`), add ExerciseSearch:

```html
  <!-- Exercise Search bottom sheet -->
  <ExerciseSearch
    :visible="showExerciseSearch"
    :initial-group="displayExercise._muscle_group || 'all'"
    title="Swap Exercise"
    @select="handleSwap"
    @close="showExerciseSearch = false"
  />
</div>
```

- [ ] **Step 9: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 10: Commit**

```bash
git add src/components/fitness/ExerciseCard.vue
git commit -m "feat: ExerciseCard — swap, RPE, skip, remove weight ratios"
```

---

## Task 5: RestTimer Redesign

**Files:**
- Modify: `src/components/fitness/RestTimer.vue`

- [ ] **Step 1: Update props and emits**

Replace existing props/emits:

```javascript
const props = defineProps({
  seconds: { type: Number, default: 90 },
  active: { type: Boolean, default: false }
})

const emit = defineEmits(['dismiss', 'adjust'])
```

- [ ] **Step 2: Add adjust functionality**

Add adjust function:

```javascript
function adjust(delta) {
  const newDuration = Math.max(0, remaining.value + delta)
  remaining.value = newDuration
  emit('adjust', newDuration)
}
```

- [ ] **Step 3: Rewrite template — inline, not fixed**

Replace entire template with inline version:

```html
<template>
  <div v-if="active" class="mt-2 px-3 py-2 bg-slate-900 rounded-lg flex items-center justify-between">
    <div class="flex items-center gap-2">
      <Timer class="w-3.5 h-3.5 text-slate-500" />
      <span class="text-base font-bold" :class="remaining <= 0 ? 'text-green-400' : 'text-green-500'">
        {{ display }}
      </span>
    </div>
    <div class="flex gap-1.5">
      <button @click="adjust(-30)" class="bg-slate-700 text-slate-400 px-2 py-1 rounded-md text-[10px] hover:bg-slate-600">
        -30s
      </button>
      <button @click="adjust(30)" class="bg-slate-700 text-slate-400 px-2 py-1 rounded-md text-[10px] hover:bg-slate-600">
        +30s
      </button>
      <button @click="dismiss" class="bg-slate-700 text-slate-400 px-1.5 py-1 rounded-md text-[10px] hover:bg-slate-600">
        <X class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>
```

Update imports to add `Timer` and `X` from lucide-vue-next.

- [ ] **Step 4: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/fitness/RestTimer.vue
git commit -m "feat: RestTimer — inline layout, adjustable ±30s, no fixed positioning"
```

---

## Task 6: WorkoutView — Wire Swap, RPE, Rest Timer

**Files:**
- Modify: `src/views/WorkoutView.vue`

- [ ] **Step 1: Update ExerciseCard usage in template**

Replace ExerciseCard in the exercise loop (lines ~40-52):

```html
<ExerciseCard
  v-for="exercise in exercises"
  :key="exercise.id"
  :exercise="exercise"
  :logged-sets="getSetsForExercise(exercise.exercise_name)"
  :previous-sets="getPreviousSetsForExercise(exercise.exercise_name)"
  :user-weight="userStore.profile?.weight_kg || null"
  :experience="userStore.preferences?.fitness_experience || 'beginner'"
  @log-set="(setData) => handleLogSet(setData, exercise)"
  @swap="handleExerciseSwap"
  @start-rest="startRestTimer"
/>
```

- [ ] **Step 2: Move rest timer inline into ExerciseCard or manage state**

Replace the floating RestTimer with per-card state. Add to script:

```javascript
const activeRestExercise = ref(null)
const restDuration = ref(90)

function startRestTimer(seconds) {
  restDuration.value = seconds
  activeRestExercise.value = true
  showRestTimer.value = true
  currentRestSeconds.value = seconds
}
```

Update RestTimer in template to use new inline approach — render it below the exercise list as a single shared timer:

```html
<RestTimer
  :seconds="currentRestSeconds"
  :active="showRestTimer"
  @dismiss="showRestTimer = false"
  @adjust="(s) => currentRestSeconds = s"
/>
```

- [ ] **Step 3: Update handleLogSet to pass RPE and substituted_for**

In `handleLogSet` (line ~135), the setData now includes rpe and substituted_for from ExerciseCard. Just pass it through:

```javascript
async function handleLogSet(setData, exercise) {
  const fullSet = {
    workout_log_id: session.value.id,
    user_id: useAuthStore().user.id,
    exercise_name: setData.exercise_name,
    set_number: setData.set_number,
    weight: setData.weight,
    reps: setData.reps,
    is_warmup: setData.is_warmup || false,
    rpe: setData.rpe || null,
    substituted_for: setData.substituted_for || null
  }
  await fitnessStore.logSet(fullSet)
  loggedSets.value.push(fullSet)
  showRestTimer.value = true
  currentRestSeconds.value = exercise.rest_seconds || 90
}
```

- [ ] **Step 4: Add PR tracking and swap handler**

Add state for current PRs:

```javascript
const currentPRs = ref({})
```

In the `onMounted` function, after fetching exercises and previous sets, fetch PRs:

```javascript
// Fetch PRs for all exercises in this workout
await fitnessStore.fetchPersonalRecords()
const prMap = {}
for (const pr of fitnessStore.personalRecords) {
  prMap[pr.exercise_name] = pr.weight
}
currentPRs.value = prMap
```

Pass `currentPRs` to ExerciseCard in the template:

```html
:current-p-r-s="currentPRs"
```

Add swap handler (ExerciseCard handles weight prefill internally):

```javascript
function handleExerciseSwap({ original, substitute }) {
  // ExerciseCard handles weight prefill via fetchLastWeightForExercise
  // No action needed in parent — swap is session-only
}
```

- [ ] **Step 5: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/views/WorkoutView.vue
git commit -m "feat: WorkoutView — wire RPE, substituted_for, inline rest timer, swap handler"
```

---

## Task 7: Program Templates Extraction

**Files:**
- Create: `src/lib/program-templates.js`
- Modify: `src/views/FitnessView.vue`

- [ ] **Step 1: Create program-templates.js**

Move the 3 template arrays from FitnessView (lines ~380-511) into a new file:

```javascript
export const PROGRAM_TEMPLATES = [
  // ... copy the 3 template objects from FitnessView lines 380-511
]
```

- [ ] **Step 2: Update FitnessView imports**

Replace the inline templates array with:

```javascript
import { PROGRAM_TEMPLATES } from '@/lib/program-templates'
```

Remove the templates array from the script section. Update `filteredTemplates` computed to reference `PROGRAM_TEMPLATES`.

- [ ] **Step 3: Fix duplicate focus display**

In FitnessView, find the duplicate focus text (lines ~124-125 — two consecutive `<p>` tags showing `fitnessStore.todaysWorkout.focus`). Remove the second one.

- [ ] **Step 4: Update `changeProgram` to use `archiveProgram`**

Replace `fitnessStore.deactivateProgram()` with `fitnessStore.archiveProgram(fitnessStore.activeProgram.id)` in the `changeProgram` function.

- [ ] **Step 5: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/program-templates.js src/views/FitnessView.vue
git commit -m "feat: extract templates, fix duplicate focus, archive instead of deactivate"
```

---

## Task 8: ProgramCard — Tappable Days

**Files:**
- Modify: `src/components/fitness/ProgramCard.vue`

- [ ] **Step 1: Add router import and click handler**

```javascript
import { useRouter } from 'vue-router'
const router = useRouter()

function openDayEditor(day) {
  if (!shuffleMode.value) {
    router.push(`/fitness/edit/${day.id}`)
  }
}
```

- [ ] **Step 2: Update day rows in template**

Add click handler, exercise count, and chevron to each day row. In the days loop, add:

```html
@click="openDayEditor(day)"
class="cursor-pointer"
```

Add after the day label/focus text:

```html
<div class="flex items-center gap-1 shrink-0">
  <span v-if="!day.is_rest_day" class="text-[10px] text-slate-500">
    {{ day.exercises?.length || 0 }} exercises
  </span>
  <ChevronRight class="w-3 h-3 text-slate-500" />
</div>
```

Import `ChevronRight` from lucide-vue-next.

- [ ] **Step 3: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/fitness/ProgramCard.vue
git commit -m "feat: ProgramCard — tappable days with exercise count and chevron"
```

---

## Task 9: DayEditorView

**Files:**
- Create: `src/views/DayEditorView.vue`
- Modify: `src/router/index.js`

- [ ] **Step 1: Add route**

In `src/router/index.js`, add after the workout route (line ~30):

```javascript
{
  path: '/fitness/edit/:dayId',
  name: 'editProgramDay',
  component: () => import('@/views/DayEditorView.vue')
}
```

- [ ] **Step 2: Create DayEditorView.vue**

```vue
<template>
  <div class="min-h-screen bg-slate-950 px-4 py-6">
    <div class="mx-auto max-w-md">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="cancel" class="text-slate-400 hover:text-slate-200">
          <ArrowLeft class="w-5 h-5" />
        </button>
        <h1 class="text-lg font-bold">Edit Day</h1>
      </div>

      <div v-if="loading" class="text-center text-slate-500">Loading...</div>

      <div v-else class="space-y-4">
        <!-- Day name -->
        <div>
          <label class="text-xs text-slate-500 mb-1 block">Day Name</label>
          <input
            v-model="dayName"
            class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Rest day toggle -->
        <div class="flex justify-between items-center">
          <span class="text-sm text-slate-300">Rest Day</span>
          <button
            @click="toggleRestDay"
            class="px-3 py-1 rounded-lg text-xs font-semibold"
            :class="isRestDay ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'"
          >
            {{ isRestDay ? 'Make Training Day' : 'Make Rest Day' }}
          </button>
        </div>

        <!-- Exercise list -->
        <div v-if="!isRestDay" class="space-y-2">
          <div
            v-for="(ex, idx) in exercises"
            :key="ex.id"
            class="bg-slate-800 rounded-lg p-3"
          >
            <div class="flex items-center gap-2 mb-2">
              <!-- Reorder buttons -->
              <div class="flex flex-col gap-0.5">
                <button @click="moveUp(idx)" :disabled="idx === 0"
                  class="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-xs">&#9650;</button>
                <button @click="moveDown(idx)" :disabled="idx === exercises.length - 1"
                  class="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-xs">&#9660;</button>
              </div>
              <div class="flex-1 text-sm font-semibold">{{ ex.exercise_name }}</div>
              <button @click="removeExercise(ex.id, idx)" class="text-red-400 hover:text-red-300">
                <X class="w-4 h-4" />
              </button>
            </div>
            <div class="flex gap-3">
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-slate-500">Sets</span>
                <input v-model.number="ex.target_sets" type="number" min="1" max="10"
                  class="bg-slate-700 border-none text-slate-100 w-10 text-center rounded px-1 py-0.5 text-xs" />
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-slate-500">Reps</span>
                <input v-model.number="ex.target_reps_min" type="number" min="1"
                  class="bg-slate-700 border-none text-slate-100 w-10 text-center rounded px-1 py-0.5 text-xs" />
                <span class="text-[10px] text-slate-500">-</span>
                <input v-model.number="ex.target_reps_max" type="number" min="1"
                  class="bg-slate-700 border-none text-slate-100 w-10 text-center rounded px-1 py-0.5 text-xs" />
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-slate-500">Rest</span>
                <input v-model.number="ex.rest_seconds" type="number" min="0" step="15"
                  class="bg-slate-700 border-none text-slate-100 w-12 text-center rounded px-1 py-0.5 text-xs" />
                <span class="text-[9px] text-slate-500">s</span>
              </div>
            </div>
          </div>

          <!-- Add exercise -->
          <button @click="showSearch = true"
            class="w-full py-3 border border-dashed border-slate-600 rounded-lg text-blue-400 text-sm font-semibold hover:border-blue-500">
            + Add Exercise
          </button>
        </div>

        <!-- Save / Cancel -->
        <div class="flex gap-3 pt-4">
          <button @click="cancel" class="flex-1 py-2 bg-slate-700 rounded-lg text-sm text-slate-300">Cancel</button>
          <button @click="save" :disabled="saving"
            class="flex-1 py-2 bg-green-500 rounded-lg text-sm font-bold text-slate-900 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>

      <ExerciseSearch
        :visible="showSearch"
        title="Add Exercise"
        @select="addExercise"
        @close="showSearch = false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, X } from 'lucide-vue-next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useFitnessStore } from '@/stores/fitness'
import { useToast } from '@/composables/useToast'
import ExerciseSearch from '@/components/fitness/ExerciseSearch.vue'

const route = useRoute()
const router = useRouter()
const fitnessStore = useFitnessStore()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const showSearch = ref(false)
const dayName = ref('')
const isRestDay = ref(false)
const exercises = ref([])
const dayId = route.params.dayId

onMounted(async () => {
  const user = useAuthStore().user
  const { data: day } = await supabase
    .from('v2_program_days')
    .select('*, v2_program_exercises(*)')
    .eq('id', dayId)
    .eq('user_id', user.id)
    .single()

  if (!day) { router.push('/fitness'); return }

  dayName.value = day.name || ''
  isRestDay.value = day.is_rest_day || false
  exercises.value = (day.v2_program_exercises || [])
    .sort((a, b) => a.sort_order - b.sort_order)
  loading.value = false
})

function toggleRestDay() {
  isRestDay.value = !isRestDay.value
  if (isRestDay.value) exercises.value = []
}

function moveUp(idx) {
  if (idx === 0) return
  const temp = exercises.value[idx]
  exercises.value[idx] = exercises.value[idx - 1]
  exercises.value[idx - 1] = temp
  exercises.value = [...exercises.value]
}

function moveDown(idx) {
  if (idx === exercises.value.length - 1) return
  const temp = exercises.value[idx]
  exercises.value[idx] = exercises.value[idx + 1]
  exercises.value[idx + 1] = temp
  exercises.value = [...exercises.value]
}

async function addExercise(exercise) {
  await fitnessStore.addExerciseToDay(dayId, {
    name: exercise.name,
    sets: 3,
    reps_min: 8,
    reps_max: 12,
    rest_seconds: 90
  })
  // Refetch
  const user = useAuthStore().user
  const { data } = await supabase
    .from('v2_program_exercises')
    .select('*')
    .eq('program_day_id', dayId)
    .eq('user_id', user.id)
    .order('sort_order')
  exercises.value = data || []
  showSearch.value = false
}

async function removeExercise(exerciseId, idx) {
  if (exercises.value.length === 1) {
    if (!confirm('Remove the last exercise? Consider making this a rest day instead.')) return
  }
  await fitnessStore.removeExerciseFromDay(exerciseId)
  exercises.value.splice(idx, 1)
}

async function save() {
  saving.value = true
  try {
    await fitnessStore.updateProgramDay(dayId, {
      name: dayName.value,
      is_rest_day: isRestDay.value
    })

    if (!isRestDay.value) {
      // Update each exercise's programming
      const ids = exercises.value.map(e => e.id)
      await fitnessStore.reorderExercises(dayId, ids)
      for (const ex of exercises.value) {
        await fitnessStore.updateExercise(ex.id, {
          target_sets: ex.target_sets,
          target_reps_min: ex.target_reps_min,
          target_reps_max: ex.target_reps_max,
          rest_seconds: ex.rest_seconds
        })
      }
    }

    toast.show('Day updated')
    router.push('/fitness')
  } catch (err) {
    toast.show('Failed to save')
  } finally {
    saving.value = false
  }
}

function cancel() {
  router.push('/fitness')
}
</script>
```

- [ ] **Step 3: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/views/DayEditorView.vue src/router/index.js
git commit -m "feat: DayEditorView — program day editor with exercise CRUD and reorder"
```

---

## Task 10: AIBuilder Component

**Files:**
- Create: `src/components/fitness/AIBuilder.vue`
- Modify: `src/views/FitnessView.vue`

- [ ] **Step 1: Create AIBuilder.vue**

3-step form:
1. Select available days (Mon-Sun checkboxes)
2. Select goal (dropdown), experience (dropdown), injuries (text input)
3. Loading → preview generated program → accept/edit

Calls `fitnessStore.createProgramFromAI()`. On failure, shows error toast and offers template fallback via `PROGRAM_TEMPLATES`.

- [ ] **Step 2: Wire into FitnessView**

Replace the "no program" section (lines ~30-87) in FitnessView. Replace the template selection UI with:

```html
<AIBuilder v-if="!fitnessStore.activeProgram" @program-created="onProgramCreated" />
```

Keep template fallback accessible from AIBuilder's error state.

- [ ] **Step 3: Add program history section to FitnessView**

After the recent workouts list in the Dashboard tab, add a collapsed "Previous Programs" section:

```html
<div v-if="archivedPrograms.length > 0" class="mt-4">
  <button @click="showArchived = !showArchived" class="text-xs text-slate-500">
    {{ showArchived ? 'Hide' : 'Show' }} Previous Programs ({{ archivedPrograms.length }})
  </button>
  <div v-if="showArchived" class="mt-2 space-y-2">
    <div v-for="prog in archivedPrograms" :key="prog.id"
      class="bg-slate-800 rounded-lg p-3 flex justify-between items-center">
      <div>
        <div class="text-sm font-semibold">{{ prog.name }}</div>
        <div class="text-[10px] text-slate-500">Archived {{ formatLogDate(prog.archived_at) }}</div>
      </div>
      <button @click="reactivate(prog.id)" class="text-xs text-blue-400">Reactivate</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/fitness/AIBuilder.vue src/views/FitnessView.vue
git commit -m "feat: AIBuilder — AI program generation with preview, program history section"
```

---

## Task 11: Analytics — HistoryChart Redesign

**Files:**
- Modify: `src/components/fitness/HistoryChart.vue`

- [ ] **Step 1: Rewrite HistoryChart with dual-line chart + stats row**

Replace the entire component. Key changes:
- Fetch exercise names from store (distinct exercise names from workout sets, not from logs)
- Two Chart.js datasets: blue solid (best weight per session), purple dashed (est 1RM)
- Stats row below chart: PR weight, est 1RM, progress over period, session count
- Epley formula: `weight * (1 + reps / 30)`
- Component fetches data internally via `fitnessStore.fetchExerciseHistory()`

The builder agent should reference the spec's "Progression Chart" section and the analytics mockup for exact layout.

- [ ] **Step 2: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/fitness/HistoryChart.vue
git commit -m "feat: HistoryChart — dual-line progression chart with est 1RM and stats row"
```

---

## Task 12: Analytics — PersonalRecords + VolumeChart

**Files:**
- Create: `src/components/fitness/PersonalRecords.vue`
- Create: `src/components/fitness/VolumeChart.vue`
- Modify: `src/views/FitnessView.vue`

- [ ] **Step 1: Create PersonalRecords.vue**

```vue
<template>
  <div>
    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Personal Records</div>
    <div v-if="loading" class="text-sm text-slate-500">Loading...</div>
    <div v-else-if="records.length === 0" class="text-sm text-slate-500">No records yet. Start lifting!</div>
    <div v-else class="space-y-1">
      <div
        v-for="pr in records"
        :key="pr.exercise_name"
        class="flex justify-between items-center p-2 bg-slate-800 rounded-lg"
      >
        <div>
          <div class="text-xs font-semibold">{{ pr.exercise_name }}</div>
          <div class="text-[10px] text-slate-500">{{ formatDate(pr.date) }}</div>
        </div>
        <div class="text-right">
          <div class="text-sm font-bold text-amber-400">{{ pr.weight }} lbs</div>
          <div class="text-[10px] text-slate-500">x {{ pr.reps }} reps</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useFitnessStore } from '@/stores/fitness'

const fitnessStore = useFitnessStore()
const loading = ref(true)
const records = ref([])

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(async () => {
  await fitnessStore.fetchPersonalRecords()
  records.value = fitnessStore.personalRecords
  loading.value = false
})
</script>
```

- [ ] **Step 2: Create VolumeChart.vue**

```vue
<template>
  <div>
    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Weekly Volume by Muscle Group</div>
    <div v-if="Object.keys(volume).length === 0" class="text-sm text-slate-500">No data this week</div>
    <div v-else class="bg-slate-800 rounded-lg p-3 space-y-2">
      <div v-for="group in sortedGroups" :key="group.name">
        <div class="flex justify-between mb-0.5">
          <span class="text-[11px] capitalize">{{ group.name }}</span>
          <span class="text-[10px] text-slate-500">{{ group.sets }} sets</span>
        </div>
        <div class="bg-slate-700 h-1.5 rounded">
          <div
            class="h-full rounded transition-all"
            :class="barColor(group.name)"
            :style="{ width: `${(group.sets / maxSets) * 100}%` }"
          ></div>
        </div>
      </div>
    </div>
    <div class="text-[9px] text-slate-600 text-center mt-1">
      Based on logged sets this week · Muscle groups from exercise library
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFitnessStore } from '@/stores/fitness'

const fitnessStore = useFitnessStore()
const volume = ref({})

const COLORS = {
  chest: 'bg-blue-500',
  back: 'bg-green-500',
  shoulders: 'bg-purple-400',
  legs: 'bg-amber-500',
  arms: 'bg-cyan-500',
  core: 'bg-pink-500'
}

function barColor(group) {
  return COLORS[group] || 'bg-slate-400'
}

const sortedGroups = computed(() =>
  Object.entries(volume.value)
    .map(([name, sets]) => ({ name, sets }))
    .sort((a, b) => b.sets - a.sets)
)

const maxSets = computed(() => Math.max(...sortedGroups.value.map(g => g.sets), 1))

onMounted(async () => {
  volume.value = await fitnessStore.fetchWeeklyMuscleVolume()
})
</script>
```

- [ ] **Step 3: Wire into FitnessView History tab**

Replace the History tab content (lines ~192-195) with:

```html
<!-- HISTORY TAB -->
<div v-if="activeTab === 'history'" class="space-y-4">
  <HistoryChart />
  <PersonalRecords />
  <VolumeChart />
</div>
```

Add imports:
```javascript
import PersonalRecords from '@/components/fitness/PersonalRecords.vue'
import VolumeChart from '@/components/fitness/VolumeChart.vue'
```

Remove the `:logs="fitnessStore.recentLogs"` prop from HistoryChart (it now fetches data internally).

- [ ] **Step 4: Verify build**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/fitness/PersonalRecords.vue src/components/fitness/VolumeChart.vue src/views/FitnessView.vue
git commit -m "feat: analytics — PersonalRecords, VolumeChart, History tab redesign"
```

---

## Task 13: Final Verification + Push

- [ ] **Step 1: Full build check**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run build
```

- [ ] **Step 2: Manual smoke test**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && npm run dev
```

Open http://localhost:5173 and verify:
- Dashboard loads, weekly progress shows
- Fitness page loads with program or AI builder
- Can tap a day to open editor
- History tab shows progression chart, PRs, volume
- Start a workout, see swap button, RPE dropdown, inline rest timer

- [ ] **Step 3: Push**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2" && git push origin master
```

---

## Parallelization Notes

| Task | Dependencies | Can Parallel |
|------|-------------|--------------|
| 1 (Migration) | None | First |
| 2 (Store) | Task 1 | After 1 |
| 3 (ExerciseSearch) | Task 2 | After 2, parallel with 5, 7, 8, 11 |
| 4 (ExerciseCard) | Task 2, 3 | After 3 |
| 5 (RestTimer) | None | Parallel with 3-4 |
| 6 (WorkoutView) | Task 4, 5 | After 4+5 |
| 7 (Templates) | Task 2 | Parallel with 3-6 |
| 8 (ProgramCard) | Task 2 | Parallel with 3-7 |
| 9 (DayEditor) | Task 2, 3, 8 | After 3+8 |
| 10 (AIBuilder) | Task 2, 7 | After 7 |
| 11 (HistoryChart) | Task 2 | Parallel with 3-10 |
| 12 (Analytics) | Task 2, 11 | After 11 |
| 13 (Final) | All | Last |

**Safe parallel groups:**
- Group A: Tasks 3, 5, 7, 8, 11 (independent new files/simple modifications)
- Group B: Tasks 4, 9, 10 (depend on Group A outputs)
- Group C: Tasks 6, 12 (depend on Group B)
