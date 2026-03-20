# GPS Goal System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current independent goal/tracker system with a GPS-inspired model where long-term goals drive the entire dashboard. AI refines goals into SMART targets, prescribes daily trackers, and the dashboard configures itself around what the user needs.

**Architecture:** Goal creation goes through AI refinement which generates key results + prescribed trackers. Trackers write targets to `v2_profiles.preferences` so existing store computeds (proteinTarget, waterGoal, etc.) pick them up without cross-store dependencies. A new Destination Strip replaces GoalProgress on the dashboard. GoalCreationFlow is a full-screen modal reusable from dashboard, goals page, and onboarding.

**Tech Stack:** Vue 3.5 (Composition API), Pinia stores, Supabase (PostgreSQL + Edge Functions), Tailwind CSS 4, Lucide Vue Next icons.

**Spec:** `docs/superpowers/specs/2026-03-20-gps-goal-system-design.md`

**Supabase CLI:** Use `SUPABASE_ACCESS_TOKEN` env var from `.claude/settings.local.json`.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/006_gps_goal_system.sql` | Goal columns, updated_at trigger, goal_trackers table |
| `src/components/dashboard/DestinationStrip.vue` | Compact goal cards with countdowns |
| `src/components/goals/GoalCreationFlow.vue` | Multi-step modal: category → input → AI refine → approve |
| `src/components/goals/GoalCompletionModal.vue` | Celebration + suggest next goal |
| `src/components/goals/GoalDetailSheet.vue` | Bottom sheet showing goal details from Destination Strip tap |

### Modified Files
| File | Changes |
|------|---------|
| `src/stores/goals.js` | Add AI creation flow, trackers, countdown, completion logic |
| `src/views/DashboardView.vue` | Replace GoalProgress with DestinationStrip, conditional sections |
| `src/views/GoalsView.vue` | Category-based layout, GoalCreationFlow integration |
| `src/views/OnboardingView.vue` | Replace Step 2 with GoalCreationFlow |
| `src/components/dashboard/MacroTracker.vue` | Conditional render based on active trackers |
| `src/components/dashboard/UpNextCards.vue` | Conditional water/supplement cards |
| `src/components/dashboard/TodayChecklist.vue` | Conditional items based on trackers |
| `src/components/dashboard/BriefMeButton.vue` | Enhanced prompt with goal context |

### Removed Files
| File | Replaced By |
|------|------------|
| `src/components/dashboard/GoalProgress.vue` | `DestinationStrip.vue` + `GoalDetailSheet.vue` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/006_gps_goal_system.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Goal system enhancements
ALTER TABLE v2_goals ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE v2_goals ADD COLUMN IF NOT EXISTS original_text text;
ALTER TABLE v2_goals ADD COLUMN IF NOT EXISTS difficulty text;
ALTER TABLE v2_goals ADD COLUMN IF NOT EXISTS ai_refined boolean DEFAULT false;
ALTER TABLE v2_goals ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_v2_goals_updated_at
  BEFORE UPDATE ON v2_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- One active goal per category per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_goals_active_category
  ON v2_goals (user_id, category)
  WHERE status = 'active';

-- Goal trackers
CREATE TABLE IF NOT EXISTS v2_goal_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id uuid REFERENCES v2_goals(id) ON DELETE CASCADE NOT NULL,
  tracker_type text NOT NULL,
  daily_target numeric,
  unit text,
  supplement_name text,
  reason text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE v2_goal_trackers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goal trackers" ON v2_goal_trackers FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_v2_goal_trackers_user_type ON v2_goal_trackers (user_id, tracker_type) WHERE is_active = true;
```

- [ ] **Step 2: Push migration**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_gps_goal_system.sql
git commit -m "feat: GPS goal migration — category, trackers, updated_at trigger"
```

---

## Task 2: Update goalsStore — AI Creation + Trackers + Completion

**Files:**
- Modify: `src/stores/goals.js`

This is the biggest task. Read the file first, then add:

- [ ] **Step 1: Add imports and state**

Add to imports:
```javascript
import { supabase } from '@/lib/supabase'
import { calcStreakMultiplier } from '@/lib/gamification'
```

Add new state:
```javascript
const trackers = ref([])
```

- [ ] **Step 2: Add tracker-related computed properties**

```javascript
const goalsByCategory = computed(() => ({
  body: activeGoals.value.find(g => g.category === 'body') || null,
  nutrition: activeGoals.value.find(g => g.category === 'nutrition') || null,
  performance: activeGoals.value.find(g => g.category === 'performance') || null
}))

const destinationGoals = computed(() =>
  activeGoals.value.filter(g => g.category).slice(0, 3)
)

const activeTrackers = computed(() =>
  trackers.value.filter(t => t.is_active)
)

function getTarget(type) {
  const matching = activeTrackers.value.filter(t => t.tracker_type === type)
  if (matching.length === 0) return null
  return Math.max(...matching.map(t => t.daily_target))
}

function hasTracker(type) {
  return activeTrackers.value.some(t => t.tracker_type === type)
}

function goalCountdown(goal) {
  if (!goal.target_date) return null
  const now = new Date()
  const target = new Date(goal.target_date)
  const days = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
  if (days <= 0) return { days: 0, label: 'Due' }
  if (days > 60) return { days, label: `${Math.round(days / 30)} months` }
  return { days, label: `${days} days` }
}
```

- [ ] **Step 3: Fetch trackers in hydrate()**

Add to the existing `hydrate()` function, after fetching goals:

```javascript
const { data: trackerData } = await supabase
  .from('v2_goal_trackers')
  .select('*')
  .eq('is_active', true)

trackers.value = trackerData || []
```

- [ ] **Step 4: Add createGoalWithAI()**

```javascript
async function createGoalWithAI(category, userText) {
  const userStore = useUserStore()
  const fitnessStore = useFitnessStore()

  const prompt = `The user wants to set a fitness goal. Here's their context:

Goal (their words): "${userText}"
Category: ${category}
Current stats: Weight ${userStore.profile?.weight || 'unknown'}kg, Age ${userStore.profile?.age || 'unknown'}, Difficulty: ${userStore.difficulty || 'medium'}
Fitness experience: ${userStore.preferences?.fitness_experience || 'unknown'}
Current program: ${fitnessStore.activeProgram?.name || 'none'}

Respond with JSON only:
{
  "refined_title": "Short measurable title",
  "description": "What success looks like in 1-2 sentences",
  "target_description": "The measurable outcome",
  "deadline_days": number,
  "key_results": [
    { "title": "...", "target_value": number, "unit": "...", "current_value": number }
  ],
  "prescribed_trackers": [
    { "type": "protein|calories|water|supplement|workout_frequency|body_weight", "daily_target": number, "unit": "...", "name": "optional supplement name", "reason": "why this helps" }
  ]
}`

  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      message: prompt,
      context: { page: 'goals', task: 'goal_refinement' },
      conversationHistory: [],
      difficulty: userStore.difficulty || 'medium'
    }
  })

  if (error) throw error

  try {
    const match = data.message.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch {}

  throw new Error('Could not parse AI response. Please try again.')
}
```

- [ ] **Step 5: Add approveGoal()**

```javascript
async function approveGoal(category, originalText, refined, prescribedTrackers) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Create the goal
  const { data: goal, error: goalError } = await supabase
    .from('v2_goals')
    .insert({
      user_id: user.id,
      title: refined.refined_title,
      description: refined.description,
      target_date: new Date(Date.now() + refined.deadline_days * 86400000).toISOString().split('T')[0],
      status: 'active',
      category,
      original_text: originalText,
      difficulty: refined.difficulty || 'medium',
      ai_refined: true
    })
    .select()
    .single()

  if (goalError) throw goalError

  // Create key results
  for (const kr of (refined.key_results || [])) {
    await supabase.from('v2_key_results').insert({
      goal_id: goal.id,
      user_id: user.id,
      title: kr.title,
      target_value: kr.target_value,
      current_value: kr.current_value || 0,
      unit: kr.unit,
      deadline: goal.target_date
    })
  }

  // Save trackers
  const trackerInserts = prescribedTrackers.map(t => ({
    user_id: user.id,
    goal_id: goal.id,
    tracker_type: t.type,
    daily_target: t.daily_target,
    unit: t.unit,
    supplement_name: t.name || null,
    reason: t.reason
  }))

  if (trackerInserts.length > 0) {
    const { data: newTrackers } = await supabase
      .from('v2_goal_trackers')
      .insert(trackerInserts)
      .select()

    if (newTrackers) trackers.value.push(...newTrackers)
  }

  // Write targets to preferences
  const userStore = useUserStore()
  const prefUpdates = {}
  for (const t of prescribedTrackers) {
    if (t.type === 'protein') prefUpdates.daily_protein_target = Math.max(t.daily_target, userStore.preferences?.daily_protein_target || 0)
    if (t.type === 'calories') prefUpdates.daily_calorie_target = Math.max(t.daily_target, userStore.preferences?.daily_calorie_target || 0)
    if (t.type === 'water') prefUpdates.daily_water_goal = Math.max(t.daily_target, userStore.preferences?.daily_water_goal || 0)
  }

  if (Object.keys(prefUpdates).length > 0) {
    await userStore.updateProfile({
      preferences: { ...userStore.preferences, ...prefUpdates }
    })
  }

  // Auto-add prescribed supplements (dedup by name)
  const supplementStore = useSupplementStore()
  for (const t of prescribedTrackers) {
    if (t.type === 'supplement' && t.name) {
      const exists = supplementStore.supplements.some(
        s => s.name.toLowerCase() === t.name.toLowerCase()
      )
      if (!exists) {
        await supplementStore.addSupplement(t.name, 'daily')
      }
    }
  }

  // Refresh goals
  await hydrate()
  return goal
}
```

- [ ] **Step 6: Add completeGoal()**

```javascript
async function completeGoal(goalId) {
  const goal = goals.value.find(g => g.id === goalId)
  if (!goal) return

  // Mark complete
  await supabase
    .from('v2_goals')
    .update({ status: 'completed' })
    .eq('id', goalId)

  // Deactivate trackers for this goal
  await supabase
    .from('v2_goal_trackers')
    .update({ is_active: false })
    .eq('goal_id', goalId)

  // Award XP
  const userStore = useUserStore()
  const streak = userStore.streak || 0
  const multiplier = calcStreakMultiplier(streak)
  const isEarly = goal.target_date && new Date(goal.target_date) > new Date()
  const baseXp = isEarly ? 750 : 500
  await userStore.addXp(Math.round(baseXp * multiplier))

  // Refresh
  await hydrate()
}
```

- [ ] **Step 7: Add imports for other stores**

At the top, add lazy imports used inside functions:
```javascript
import { useUserStore } from '@/stores/user'
import { useFitnessStore } from '@/stores/fitness'
import { useSupplementStore } from '@/stores/supplement'
```

- [ ] **Step 8: Update return statement**

Add: `goalsByCategory, destinationGoals, activeTrackers, trackers, getTarget, hasTracker, goalCountdown, createGoalWithAI, approveGoal, completeGoal`

- [ ] **Step 9: Verify build and commit**

```bash
npm run build
git add src/stores/goals.js
git commit -m "feat: GPS goal store — AI creation, tracker prescription, completion"
```

---

## Task 3: DestinationStrip Component

**Files:**
- Create: `src/components/dashboard/DestinationStrip.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div>
    <!-- Goals exist -->
    <div v-if="goals.length > 0" class="flex gap-2.5">
      <button
        v-for="goal in goals"
        :key="goal.id"
        @click="selectedGoal = goal"
        class="flex-1 bg-slate-800 rounded-xl p-3 text-left hover:bg-slate-750 transition-colors"
      >
        <div class="flex items-center gap-1.5 mb-1.5">
          <component :is="categoryIcon(goal.category)" class="w-3.5 h-3.5 text-slate-400" />
          <div class="text-xs font-semibold truncate">{{ goal.title }}</div>
        </div>
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-[10px] text-purple-400 font-bold">{{ goalsStore.goalProgress(goal) }}%</span>
          <span v-if="countdown(goal)" class="text-[10px] text-slate-500">{{ countdown(goal).label }}</span>
        </div>
        <div class="bg-slate-700 rounded h-1">
          <div
            class="bg-purple-500 rounded h-full transition-all duration-500"
            :style="{ width: `${goalsStore.goalProgress(goal)}%` }"
          ></div>
        </div>
      </button>
    </div>

    <!-- No goals -->
    <button
      v-else
      @click="$emit('createGoal')"
      class="w-full bg-slate-800 rounded-xl p-4 text-center hover:bg-slate-750 transition-colors"
    >
      <Target class="w-5 h-5 text-slate-500 mx-auto mb-1.5" />
      <div class="text-sm font-semibold text-slate-300">Set your first goal</div>
      <div class="text-xs text-slate-500 mt-0.5">AI will help you build a plan</div>
    </button>

    <!-- Goal detail sheet -->
    <GoalDetailSheet
      v-if="selectedGoal"
      :goal="selectedGoal"
      @close="selectedGoal = null"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Target, Dumbbell, UtensilsCrossed, Zap } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals'
import GoalDetailSheet from '@/components/goals/GoalDetailSheet.vue'

const emit = defineEmits(['createGoal'])
const goalsStore = useGoalsStore()

const goals = computed(() => goalsStore.destinationGoals)
const selectedGoal = ref(null)

function countdown(goal) {
  return goalsStore.goalCountdown(goal)
}

function categoryIcon(category) {
  if (category === 'body') return Dumbbell
  if (category === 'nutrition') return UtensilsCrossed
  if (category === 'performance') return Zap
  return Target
}
</script>
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build
git add src/components/dashboard/DestinationStrip.vue
git commit -m "feat: DestinationStrip — compact goal cards with countdown timers"
```

---

## Task 4: GoalDetailSheet Component

**Files:**
- Create: `src/components/goals/GoalDetailSheet.vue`

- [ ] **Step 1: Create the component**

A bottom sheet showing full goal details when tapping a Destination Strip card.

```vue
<template>
  <div class="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" @click.self="$emit('close')">
    <div class="bg-slate-800 rounded-t-2xl p-5 w-full max-w-md max-h-[70vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex justify-between items-start mb-4">
        <div>
          <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">{{ categoryLabel }}</div>
          <h3 class="text-lg font-bold">{{ goal.title }}</h3>
          <p v-if="goal.description" class="text-sm text-slate-400 mt-1">{{ goal.description }}</p>
        </div>
        <button @click="$emit('close')" class="text-slate-500 hover:text-slate-300">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Progress -->
      <div class="mb-4">
        <div class="flex justify-between text-sm mb-1.5">
          <span class="text-purple-400 font-bold">{{ progress }}%</span>
          <span v-if="countdown" class="text-slate-500">{{ countdown.label }} left</span>
        </div>
        <div class="bg-slate-700 rounded h-2">
          <div class="bg-purple-500 rounded h-full transition-all" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>

      <!-- Key Results -->
      <div v-if="goal.key_results?.length" class="mb-4">
        <div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Key Results</div>
        <div class="flex flex-col gap-2">
          <div v-for="kr in goal.key_results" :key="kr.id" class="bg-slate-750 rounded-lg p-3">
            <div class="flex justify-between text-sm mb-1">
              <span>{{ kr.title }}</span>
              <span class="text-slate-400">{{ kr.current_value }} / {{ kr.target_value }} {{ kr.unit }}</span>
            </div>
            <div class="bg-slate-600 rounded h-1">
              <div class="bg-purple-400 rounded h-full" :style="{ width: `${krProgress(kr)}%` }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Prescribed Trackers -->
      <div v-if="goalTrackers.length" class="mb-4">
        <div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Daily Targets</div>
        <div class="flex flex-col gap-1.5">
          <div v-for="t in goalTrackers" :key="t.id" class="flex justify-between text-sm bg-slate-750 rounded-lg px-3 py-2">
            <span>{{ trackerLabel(t) }}</span>
            <span class="text-slate-400">{{ t.daily_target }} {{ t.unit }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <router-link to="/goals" @click="$emit('close')" class="flex-1 text-center text-xs bg-slate-700 text-slate-300 py-2.5 rounded-lg">
          Edit Goal
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals'

const props = defineProps({
  goal: { type: Object, required: true }
})

const emit = defineEmits(['close'])
const goalsStore = useGoalsStore()

const progress = computed(() => goalsStore.goalProgress(props.goal))
const countdown = computed(() => goalsStore.goalCountdown(props.goal))

const categoryLabel = computed(() => {
  const labels = { body: 'Body', nutrition: 'Nutrition', performance: 'Performance' }
  return labels[props.goal.category] || 'Goal'
})

const goalTrackers = computed(() =>
  goalsStore.activeTrackers.filter(t => t.goal_id === props.goal.id)
)

function krProgress(kr) {
  if (!kr.target_value) return 0
  return Math.min(100, Math.round((kr.current_value / kr.target_value) * 100))
}

function trackerLabel(t) {
  if (t.tracker_type === 'supplement') return t.supplement_name
  const labels = { protein: 'Protein', calories: 'Calories', water: 'Water', workout_frequency: 'Workouts/week', body_weight: 'Monthly weigh-in' }
  return labels[t.tracker_type] || t.tracker_type
}
</script>
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build
git add src/components/goals/GoalDetailSheet.vue
git commit -m "feat: GoalDetailSheet — bottom sheet with KRs, trackers, progress"
```

---

## Task 5: GoalCreationFlow Component

**Files:**
- Create: `src/components/goals/GoalCreationFlow.vue`

- [ ] **Step 1: Create the component**

Multi-step modal: category selection → plain text input → AI refinement → review & approve trackers.

```vue
<template>
  <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
    <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">

      <!-- Step 1: Category -->
      <div v-if="step === 1">
        <h2 class="text-lg font-bold mb-1">What do you want to achieve?</h2>
        <p class="text-sm text-slate-400 mb-4">Pick a category</p>
        <div class="flex flex-col gap-2">
          <button
            v-for="cat in categories"
            :key="cat.value"
            @click="selectCategory(cat.value)"
            :disabled="isOccupied(cat.value)"
            class="flex items-center gap-3 p-4 rounded-xl text-left transition-colors"
            :class="isOccupied(cat.value) ? 'bg-slate-700/50 opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'"
          >
            <component :is="cat.icon" class="w-5 h-5 text-slate-300" />
            <div>
              <div class="text-sm font-semibold">{{ cat.label }}</div>
              <div class="text-xs text-slate-500">{{ cat.description }}</div>
              <div v-if="isOccupied(cat.value)" class="text-[10px] text-amber-400 mt-0.5">Already have an active goal</div>
            </div>
          </button>
        </div>
        <button @click="$emit('close')" class="w-full mt-4 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
      </div>

      <!-- Step 2: Input -->
      <div v-if="step === 2">
        <h2 class="text-lg font-bold mb-1">{{ categoryLabel }} Goal</h2>
        <p class="text-sm text-slate-400 mb-4">Describe what you want to achieve in your own words</p>
        <textarea
          v-model="userText"
          rows="3"
          placeholder="e.g., I want to get shredded by summer..."
          class="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-sm resize-none mb-4"
          autofocus
        ></textarea>
        <div class="flex gap-2">
          <button @click="step = 1" class="flex-1 py-2.5 rounded-lg bg-slate-700 text-sm text-slate-300">Back</button>
          <button
            @click="refineWithAI"
            :disabled="!userText.trim() || refining"
            class="flex-1 py-2.5 rounded-lg bg-blue-500 text-sm font-semibold text-white disabled:opacity-50"
          >
            {{ refining ? 'AI is thinking...' : 'Continue' }}
          </button>
        </div>
        <p v-if="error" class="text-xs text-red-400 mt-2">{{ error }}</p>
      </div>

      <!-- Step 3: Review -->
      <div v-if="step === 3 && refined">
        <h2 class="text-lg font-bold mb-1">Your Plan</h2>
        <p class="text-sm text-slate-400 mb-4">AI has refined your goal. Review and approve.</p>

        <!-- Refined goal -->
        <div class="bg-slate-700 rounded-xl p-4 mb-4">
          <div class="text-sm font-bold mb-1">{{ refined.refined_title }}</div>
          <div class="text-xs text-slate-400 mb-2">{{ refined.description }}</div>
          <div class="text-xs text-slate-500">
            Deadline: <span class="text-slate-300">{{ refined.deadline_days }} days</span>
          </div>
        </div>

        <!-- Key Results -->
        <div v-if="refined.key_results?.length" class="mb-4">
          <div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Milestones</div>
          <div class="flex flex-col gap-1.5">
            <div v-for="(kr, i) in refined.key_results" :key="i" class="bg-slate-700 rounded-lg px-3 py-2 text-sm">
              {{ kr.title }}: {{ kr.current_value || 0 }} → {{ kr.target_value }} {{ kr.unit }}
            </div>
          </div>
        </div>

        <!-- Prescribed Trackers -->
        <div v-if="refined.prescribed_trackers?.length" class="mb-4">
          <div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Daily Tracking Plan</div>
          <div class="flex flex-col gap-1.5">
            <div v-for="(t, i) in refined.prescribed_trackers" :key="i" class="bg-slate-700 rounded-lg px-3 py-2 flex justify-between items-start">
              <div>
                <div class="text-sm">{{ trackerLabel(t) }}: {{ t.daily_target }} {{ t.unit }}</div>
                <div class="text-[10px] text-slate-500">{{ t.reason }}</div>
              </div>
              <button @click="removeTracker(i)" class="text-slate-500 hover:text-red-400 ml-2 shrink-0">
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button @click="step = 2" class="flex-1 py-2.5 rounded-lg bg-slate-700 text-sm text-slate-300">Back</button>
          <button
            @click="approve"
            :disabled="approving"
            class="flex-1 py-2.5 rounded-lg bg-green-500 text-sm font-semibold text-white disabled:opacity-50"
          >
            {{ approving ? 'Setting up...' : 'Start This Goal' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { X, Dumbbell, UtensilsCrossed, Zap } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals'

const emit = defineEmits(['close', 'created'])
const goalsStore = useGoalsStore()

const step = ref(1)
const category = ref(null)
const userText = ref('')
const refined = ref(null)
const refining = ref(false)
const approving = ref(false)
const error = ref(null)

const categories = [
  { value: 'body', label: 'Body', description: 'Physique, weight, composition', icon: Dumbbell },
  { value: 'nutrition', label: 'Nutrition', description: 'Diet, eating habits, consistency', icon: UtensilsCrossed },
  { value: 'performance', label: 'Performance', description: 'Strength, speed, endurance', icon: Zap }
]

const categoryLabel = computed(() => {
  const cat = categories.find(c => c.value === category.value)
  return cat?.label || ''
})

function isOccupied(cat) {
  return goalsStore.goalsByCategory[cat] !== null
}

function selectCategory(cat) {
  if (isOccupied(cat)) return
  category.value = cat
  step.value = 2
}

async function refineWithAI() {
  if (!userText.value.trim()) return
  refining.value = true
  error.value = null
  try {
    refined.value = await goalsStore.createGoalWithAI(category.value, userText.value.trim())
    step.value = 3
  } catch (e) {
    error.value = e.message || 'Something went wrong. Try again.'
  } finally {
    refining.value = false
  }
}

function removeTracker(index) {
  refined.value.prescribed_trackers.splice(index, 1)
}

async function approve() {
  approving.value = true
  try {
    await goalsStore.approveGoal(
      category.value,
      userText.value.trim(),
      refined.value,
      refined.value.prescribed_trackers || []
    )
    emit('created')
    emit('close')
  } catch (e) {
    error.value = e.message || 'Failed to save goal.'
  } finally {
    approving.value = false
  }
}

function trackerLabel(t) {
  if (t.type === 'supplement') return t.name || 'Supplement'
  const labels = { protein: 'Protein', calories: 'Calories', water: 'Water', workout_frequency: 'Workouts/week', body_weight: 'Monthly weigh-in' }
  return labels[t.type] || t.type
}
</script>
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build
git add src/components/goals/GoalCreationFlow.vue
git commit -m "feat: GoalCreationFlow — 3-step modal with AI refinement"
```

---

## Task 6: GoalCompletionModal Component

**Files:**
- Create: `src/components/goals/GoalCompletionModal.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
    <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-sm text-center">
      <div class="text-4xl mb-3">&#127942;</div>
      <h2 class="text-xl font-bold mb-1">Goal Complete!</h2>
      <p class="text-sm text-slate-400 mb-4">{{ goal.title }}</p>

      <div class="bg-slate-700 rounded-xl p-4 mb-4">
        <div class="text-2xl font-bold text-purple-400">+{{ xpEarned }} XP</div>
        <div class="text-xs text-slate-500 mt-1">{{ isEarly ? 'Finished early!' : 'Right on time' }}</div>
      </div>

      <button
        @click="$emit('setNext', goal.category)"
        class="w-full py-3 rounded-lg bg-blue-500 text-sm font-semibold text-white mb-2"
      >
        Set Next {{ categoryLabel }} Goal
      </button>
      <button @click="$emit('close')" class="w-full py-2 text-sm text-slate-500 hover:text-slate-300">
        Maybe later
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  goal: { type: Object, required: true },
  xpEarned: { type: Number, default: 500 }
})

const emit = defineEmits(['close', 'setNext'])

const isEarly = computed(() => {
  if (!props.goal.target_date) return false
  return new Date(props.goal.target_date) > new Date()
})

const categoryLabel = computed(() => {
  const labels = { body: 'Body', nutrition: 'Nutrition', performance: 'Performance' }
  return labels[props.goal.category] || ''
})
</script>
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build
git add src/components/goals/GoalCompletionModal.vue
git commit -m "feat: GoalCompletionModal — celebration with XP and next goal prompt"
```

---

## Task 7: Update DashboardView — Wire GPS System

**Files:**
- Modify: `src/views/DashboardView.vue`

- [ ] **Step 1: Replace GoalProgress import with DestinationStrip**

Replace:
```javascript
import GoalProgress from '@/components/dashboard/GoalProgress.vue'
```
With:
```javascript
import DestinationStrip from '@/components/dashboard/DestinationStrip.vue'
import GoalCreationFlow from '@/components/goals/GoalCreationFlow.vue'
```

Add state:
```javascript
const showGoalCreation = ref(false)
```

- [ ] **Step 2: Replace GoalProgress in template**

Replace `<GoalProgress />` with:

```html
<!-- 3. Destination Strip -->
<DestinationStrip @create-goal="showGoalCreation = true" />
```

Move it to AFTER the XP bar and BEFORE BriefMeButton.

- [ ] **Step 3: Add GoalCreationFlow modal**

Add at the end of the template (inside the root div):

```html
<GoalCreationFlow
  v-if="showGoalCreation"
  @close="showGoalCreation = false"
  @created="showGoalCreation = false"
/>
```

- [ ] **Step 4: Add conditional rendering for tracker-driven sections**

Wrap MacroTracker:
```html
<MacroTracker v-if="goalsStore.hasTracker('protein') || goalsStore.hasTracker('calories') || goalsStore.destinationGoals.length === 0" />
```

The `destinationGoals.length === 0` fallback ensures MacroTracker still shows when no goals are set (backward compat).

- [ ] **Step 5: Verify build and commit**

```bash
npm run build
git add src/views/DashboardView.vue
git commit -m "feat: wire GPS system — DestinationStrip replaces GoalProgress"
```

---

## Task 8: Update GoalsView — Category Layout + Creation Flow

**Files:**
- Modify: `src/views/GoalsView.vue`

- [ ] **Step 1: Read the current file**

- [ ] **Step 2: Add GoalCreationFlow import and state**

```javascript
import GoalCreationFlow from '@/components/goals/GoalCreationFlow.vue'
const showCreationFlow = ref(false)
```

- [ ] **Step 3: Replace the existing new goal form**

Replace the inline form (title/description/targetDate inputs) with a button that opens GoalCreationFlow:

```html
<button
  @click="showCreationFlow = true"
  class="w-full py-3 rounded-xl bg-blue-500 text-sm font-semibold text-white"
>
  + New Goal
</button>

<GoalCreationFlow
  v-if="showCreationFlow"
  @close="showCreationFlow = false"
  @created="showCreationFlow = false"
/>
```

- [ ] **Step 4: Group goals by category**

Organize the goals list by category sections (Body, Nutrition, Performance, Uncategorized for legacy goals).

- [ ] **Step 5: Verify build and commit**

```bash
npm run build
git add src/views/GoalsView.vue
git commit -m "feat: goals page — category layout + AI creation flow"
```

---

## Task 9: Update OnboardingView — Replace Step 2

**Files:**
- Modify: `src/views/OnboardingView.vue`

- [ ] **Step 1: Read the current file**

- [ ] **Step 2: Replace the existing Step 2 ("Your Goal") with GoalCreationFlow**

Import GoalCreationFlow and embed it inline (not as a modal) in the onboarding step. The step should allow the user to create 1-3 goals (one per category) or skip.

Keep `totalSteps` at 6.

- [ ] **Step 3: Verify build and commit**

```bash
npm run build
git add src/views/OnboardingView.vue
git commit -m "feat: onboarding — replace goal step with AI-driven GoalCreationFlow"
```

---

## Task 10: Update BriefMeButton — Goal Context

**Files:**
- Modify: `src/components/dashboard/BriefMeButton.vue`

- [ ] **Step 1: Add goal context to the briefing prompt**

In the `briefMe()` function, add goal data to the prompt parts:

```javascript
// Goals with countdown
const destGoals = goalsStore.destinationGoals
if (destGoals.length > 0) {
  const goalSummaries = destGoals.map(g => {
    const cd = goalsStore.goalCountdown(g)
    return `${g.title} (${goalsStore.goalProgress(g)}% done, ${cd?.label || 'no deadline'})`
  }).join(', ')
  parts.push(`Long-term goals: ${goalSummaries}.`)
}
```

Replace the existing generic goals section with this.

- [ ] **Step 2: Verify build and commit**

```bash
npm run build
git add src/components/dashboard/BriefMeButton.vue
git commit -m "feat: Brief Me enhanced with goal countdown context"
```

---

## Task 11: Remove GoalProgress + Final Cleanup

**Files:**
- Delete: `src/components/dashboard/GoalProgress.vue`

- [ ] **Step 1: Verify no imports remain**

Search for `GoalProgress` in all `.vue` and `.js` files. DashboardView should already be updated to use DestinationStrip.

- [ ] **Step 2: Delete the file**

```bash
git rm src/components/dashboard/GoalProgress.vue
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build
git commit -m "chore: remove GoalProgress — replaced by DestinationStrip"
```

---

## Task 12: Final Verification + Push

- [ ] **Step 1: Full build check**

Run: `npm run build`

- [ ] **Step 2: Push**

```bash
git push origin master
```

- [ ] **Step 3: Verify deployment**

Check GitHub Actions completes, verify at https://lamsimon86-create.github.io/life-os-v2/

---

## Parallelization Notes

1. Task 1 (migration) — do first
2. Task 2 (goalsStore) — after Task 1
3. Tasks 3-6 (components) — all in parallel, after Task 2
4. Tasks 7-10 (integration) — after Tasks 3-6
5. Task 11 (cleanup) — after Task 7
6. Task 12 (push) — last
