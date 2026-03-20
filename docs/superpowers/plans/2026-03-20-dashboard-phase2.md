# Dashboard Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add supplement tracking, AI-estimated macro tracking with saved meals, configurable water goals with weekly totals, and an insights carousel with body weight + progress photos to the Life OS v2 dashboard.

**Architecture:** Four independent features layered onto the existing Phase 1 dashboard. New Pinia stores for supplements and body logs. Existing stores (meals, user) extended with new computed properties. New dashboard components slot into the existing section layout. MealSlot.vue gains AI macro estimation with a "save for reuse" flow.

**Tech Stack:** Vue 3.5 (Composition API), Pinia stores, Supabase (PostgreSQL + Edge Functions + Storage), Tailwind CSS 4, Lucide Vue Next icons.

**Spec:** `docs/superpowers/specs/2026-03-20-dashboard-phase2-design.md`

**Supabase CLI:** All Supabase commands must be prefixed with `SUPABASE_ACCESS_TOKEN` env var from `.claude/settings.local.json` since the Life OS project is in a separate org.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/005_dashboard_phase2.sql` | Supplements tables, body logs table, meal columns |
| `src/stores/supplement.js` | Supplement list + daily check-off logs |
| `src/stores/body.js` | Body weight logs + progress photos |
| `src/components/dashboard/MacroTracker.vue` | Daily protein + calorie progress bars |
| `src/components/dashboard/InsightsCarousel.vue` | Swipeable horizontal card container |
| `src/components/dashboard/BodyCompositionCard.vue` | Weight + photos card in carousel |
| `src/components/dashboard/BodyLogModal.vue` | Full timeline + add weigh-in entry |
| `src/components/settings/SupplementSettings.vue` | Add/remove/reorder supplements |

### Modified Files
| File | Changes |
|------|---------|
| `src/stores/user.js` | Add `waterGoal`, `weeklyWater` |
| `src/stores/meals.js` | Add `dailyProtein`, `dailyCalories`, targets, `estimateMacros()`, `saveAsMeal()` |
| `src/components/dashboard/WeeklyProgress.vue` | Add water weekly total row |
| `src/components/dashboard/TodayChecklist.vue` | Add supplements status, use configurable water goal |
| `src/components/dashboard/UpNextCards.vue` | Add supplement checklist card, use configurable water goal |
| `src/components/meals/MealSlot.vue` | Add description input, AI estimation, "eat again?" prompt |
| `src/views/DashboardView.vue` | Wire MacroTracker, InsightsCarousel, hydrate new stores |
| `src/views/SettingsView.vue` | Add water goal, macro targets, supplements management |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/005_dashboard_phase2.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Supplement list
CREATE TABLE v2_supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  frequency text DEFAULT 'daily',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE v2_supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own supplements" ON v2_supplements FOR ALL USING (auth.uid() = user_id);

-- Supplement daily logs
CREATE TABLE v2_supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  supplement_id uuid REFERENCES v2_supplements(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  taken_at timestamptz DEFAULT now(),
  UNIQUE(supplement_id, date)
);

ALTER TABLE v2_supplement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own supplement logs" ON v2_supplement_logs FOR ALL USING (auth.uid() = user_id);

-- Body weight + progress photos
CREATE TABLE v2_body_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight_lbs numeric(5,1) NOT NULL,
  photo_front_url text,
  photo_side_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE v2_body_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own body logs" ON v2_body_logs FOR ALL USING (auth.uid() = user_id);

-- Macro tracking columns on meals
ALTER TABLE v2_meals ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE v2_meals ADD COLUMN IF NOT EXISTS confidence text;

-- Macro data on saved recipes
ALTER TABLE v2_recipes ADD COLUMN IF NOT EXISTS calories_est integer;
ALTER TABLE v2_recipes ADD COLUMN IF NOT EXISTS protein_est integer;
```

- [ ] **Step 2: Push migration**

Run: `SUPABASE_ACCESS_TOKEN=$(cat .claude/settings.local.json 2>/dev/null | grep -o '"sbp_[^"]*"' | tr -d '"') && cd "/c/Users/lamsi/Life OS/life-os-v2" && echo "Y" | npx supabase db push --linked`

If the env var approach doesn't work, read the token from `Life OS/.claude/settings.local.json` and prefix manually.

- [ ] **Step 3: Create Supabase Storage bucket**

Create the `progress-photos` bucket (private) via Supabase dashboard or CLI. Set RLS so users can only access their own `{user_id}/` prefix.

- [ ] **Step 4: Verify and commit**

Run: `SUPABASE_ACCESS_TOKEN=<token> npx supabase migration list`

```bash
git add supabase/migrations/005_dashboard_phase2.sql
git commit -m "feat: phase 2 migration — supplements, body logs, meal macro columns"
```

---

## Task 2: Supplement Store

**Files:**
- Create: `src/stores/supplement.js`

- [ ] **Step 1: Create the store**

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useSupplementStore = defineStore('supplement', () => {
  const supplements = ref([])
  const todaysLogs = ref([])
  const loading = ref(false)

  const todaysSupplements = computed(() => {
    const today = new Date().getDay() // 0=Sun, 1=Mon, ...
    return supplements.value
      .filter(s => {
        if (!s.is_active) return false
        if (s.frequency === 'daily') return true
        try {
          const days = JSON.parse(s.frequency)
          return Array.isArray(days) && days.includes(today)
        } catch { return true }
      })
      .sort((a, b) => a.sort_order - b.sort_order)
  })

  const supplementStatus = computed(() => {
    const due = todaysSupplements.value.length
    const takenIds = new Set(todaysLogs.value.map(l => l.supplement_id))
    const taken = todaysSupplements.value.filter(s => takenIds.has(s.id)).length
    return { taken, due }
  })

  function isTaken(supplementId) {
    return todaysLogs.value.some(l => l.supplement_id === supplementId)
  }

  async function hydrate() {
    loading.value = true
    try {
      const { data: supps } = await supabase
        .from('v2_supplements')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      supplements.value = supps || []

      const today = new Date().toISOString().split('T')[0]
      const { data: logs } = await supabase
        .from('v2_supplement_logs')
        .select('*')
        .eq('date', today)

      todaysLogs.value = logs || []
    } finally {
      loading.value = false
    }
  }

  async function toggleSupplement(supplementId) {
    const today = new Date().toISOString().split('T')[0]
    const existing = todaysLogs.value.find(l => l.supplement_id === supplementId)

    if (existing) {
      // Undo — delete the log
      await supabase.from('v2_supplement_logs').delete().eq('id', existing.id)
      todaysLogs.value = todaysLogs.value.filter(l => l.id !== existing.id)
    } else {
      // Mark as taken
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('v2_supplement_logs')
        .insert({ user_id: user.id, supplement_id: supplementId, date: today })
        .select()
        .single()

      if (data) todaysLogs.value.push(data)
    }
  }

  async function addSupplement(name, frequency = 'daily') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const maxOrder = supplements.value.reduce((max, s) => Math.max(max, s.sort_order || 0), 0)
    const { data } = await supabase
      .from('v2_supplements')
      .insert({ user_id: user.id, name, frequency, sort_order: maxOrder + 1 })
      .select()
      .single()

    if (data) supplements.value.push(data)
  }

  async function removeSupplement(id) {
    await supabase.from('v2_supplements').update({ is_active: false }).eq('id', id)
    supplements.value = supplements.value.filter(s => s.id !== id)
  }

  return {
    supplements, todaysLogs, loading,
    todaysSupplements, supplementStatus, isTaken,
    hydrate, toggleSupplement, addSupplement, removeSupplement
  }
})
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/stores/supplement.js
git commit -m "feat: supplement store — list, daily logs, toggle, add/remove"
```

---

## Task 3: Body Store

**Files:**
- Create: `src/stores/body.js`

- [ ] **Step 1: Create the store**

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useBodyStore = defineStore('body', () => {
  const logs = ref([])
  const loading = ref(false)

  const latestLog = computed(() => logs.value[0] || null)
  const previousLog = computed(() => logs.value[1] || null)

  const weightChange = computed(() => {
    if (!latestLog.value || !previousLog.value) return null
    const diff = latestLog.value.weight_lbs - previousLog.value.weight_lbs
    return {
      value: Math.abs(diff).toFixed(1),
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
    }
  })

  const needsMonthlyLog = computed(() => {
    if (!latestLog.value) return true
    const lastDate = new Date(latestLog.value.date)
    const now = new Date()
    // More than 28 days since last log
    return (now - lastDate) / (1000 * 60 * 60 * 24) >= 28
  })

  async function hydrate() {
    loading.value = true
    try {
      const { data } = await supabase
        .from('v2_body_logs')
        .select('*')
        .order('date', { ascending: false })
        .limit(20)

      logs.value = data || []
    } finally {
      loading.value = false
    }
  }

  async function addLog(weightLbs, photoFrontFile, photoSideFile, notes) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let photoFrontUrl = null
    let photoSideUrl = null
    const timestamp = Date.now()

    // Upload photos if provided
    if (photoFrontFile) {
      const path = `${user.id}/${timestamp}-front.jpg`
      const { error } = await supabase.storage.from('progress-photos').upload(path, photoFrontFile)
      if (!error) photoFrontUrl = path
    }

    if (photoSideFile) {
      const path = `${user.id}/${timestamp}-side.jpg`
      const { error } = await supabase.storage.from('progress-photos').upload(path, photoSideFile)
      if (!error) photoSideUrl = path
    }

    const { data } = await supabase
      .from('v2_body_logs')
      .insert({
        user_id: user.id,
        weight_lbs: weightLbs,
        photo_front_url: photoFrontUrl,
        photo_side_url: photoSideUrl,
        notes
      })
      .select()
      .single()

    if (data) {
      logs.value.unshift(data)
    }
  }

  async function getSignedUrl(path) {
    if (!path) return null
    const { data } = await supabase.storage
      .from('progress-photos')
      .createSignedUrl(path, 3600) // 1 hour
    return data?.signedUrl || null
  }

  async function deleteLog(id) {
    const log = logs.value.find(l => l.id === id)
    if (!log) return

    // Delete photos from storage
    const paths = [log.photo_front_url, log.photo_side_url].filter(Boolean)
    if (paths.length > 0) {
      await supabase.storage.from('progress-photos').remove(paths)
    }

    await supabase.from('v2_body_logs').delete().eq('id', id)
    logs.value = logs.value.filter(l => l.id !== id)
  }

  return {
    logs, loading,
    latestLog, previousLog, weightChange, needsMonthlyLog,
    hydrate, addLog, getSignedUrl, deleteLog
  }
})
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/stores/body.js
git commit -m "feat: body store — weight logs, progress photos, signed URLs"
```

---

## Task 4: Update userStore — Water Goal + Weekly Water

**Files:**
- Modify: `src/stores/user.js`

- [ ] **Step 1: Add imports**

Add to existing imports:
```javascript
import { getMondayWeekStart } from '@/lib/constants'
```

- [ ] **Step 2: Add state and computed**

Add after existing state:
```javascript
const weeklyWater = ref(0)
```

Add after existing computed:
```javascript
const waterGoal = computed(() => {
  const prefs = profile.value?.preferences
  return prefs?.daily_water_goal || 8
})
```

- [ ] **Step 3: Add weekly water fetch to hydrate()**

Inside `hydrate()`, after the daily log fetch, add:

```javascript
// Fetch weekly water total
const weekStart = getMondayWeekStart()
const { data: waterData } = await supabase
  .from('v2_daily_logs')
  .select('water_glasses')
  .eq('user_id', user.id)
  .gte('date', weekStart)

weeklyWater.value = (waterData || []).reduce((sum, d) => sum + (d.water_glasses || 0), 0)
```

- [ ] **Step 4: Update addWater() to refresh weekly total**

In the existing `addWater()` function, after incrementing `waterGlasses.value++`, also increment `weeklyWater.value++`.

- [ ] **Step 5: Add to return statement**

Add: `waterGoal, weeklyWater`

- [ ] **Step 6: Verify build and commit**

```bash
npm run build
git add src/stores/user.js
git commit -m "feat: configurable water goal + weekly water tracking"
```

---

## Task 5: Update mealsStore — Macro Tracking

**Files:**
- Modify: `src/stores/meals.js`

- [ ] **Step 1: Add computed properties for daily macros**

Add after existing computed:

```javascript
const dailyProtein = computed(() => {
  return (todaysMeals.value || []).reduce((sum, m) => sum + (m.protein_g || 0), 0)
})

const dailyCalories = computed(() => {
  return (todaysMeals.value || []).reduce((sum, m) => sum + (m.calories || 0), 0)
})

const proteinTarget = computed(() => {
  const userStore = useUserStore()
  return userStore.preferences?.daily_protein_target || 150
})

const calorieTarget = computed(() => {
  const userStore = useUserStore()
  return userStore.preferences?.daily_calorie_target || 2200
})

const savedMealsWithMacros = computed(() => {
  return recipes.value.filter(r => r.calories_est || r.protein_est)
})
```

- [ ] **Step 2: Add import for userStore**

Add at the top:
```javascript
import { useUserStore } from '@/stores/user'
```

- [ ] **Step 3: Add estimateMacros function**

```javascript
async function estimateMacros(description) {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      message: `Estimate the calories and protein (in grams) for this meal: "${description}"\n\nRespond with JSON only: { "calories": number, "protein": number, "confidence": "high" | "medium" | "low" }\n\nBase estimates on typical serving sizes. If the description is vague, use medium portions.`,
      context: { page: 'meals', task: 'macro_estimation' },
      conversationHistory: [],
      difficulty: 'medium'
    }
  })

  if (error) throw error

  // Parse JSON from AI response
  try {
    const match = data.message.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch {}

  return { calories: 0, protein: 0, confidence: 'low' }
}
```

- [ ] **Step 4: Add saveAsMeal function**

```javascript
async function saveAsMeal(mealData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data } = await supabase
    .from('v2_recipes')
    .insert({
      user_id: user.id,
      name: mealData.name,
      description: mealData.description || '',
      calories_est: mealData.calories,
      protein_est: mealData.protein,
      source: 'user',
      liked: true
    })
    .select()
    .single()

  if (data) recipes.value.unshift(data)
  return data
}
```

- [ ] **Step 5: Add to return statement**

Add: `dailyProtein, dailyCalories, proteinTarget, calorieTarget, savedMealsWithMacros, estimateMacros, saveAsMeal`

- [ ] **Step 6: Verify build and commit**

```bash
npm run build
git add src/stores/meals.js
git commit -m "feat: macro tracking — daily protein/calories, AI estimation, save meals"
```

---

## Task 6: MacroTracker Dashboard Component

**Files:**
- Create: `src/components/dashboard/MacroTracker.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div class="flex flex-col gap-2">
    <!-- Protein -->
    <div class="bg-slate-800 rounded-xl p-3">
      <div class="flex justify-between items-center mb-1.5">
        <div class="text-xs font-semibold">Protein</div>
        <div class="text-xs text-slate-400">
          <span :class="proteinOnTrack ? 'text-green-400' : 'text-amber-400'">~{{ dailyProtein }}g</span>
          / {{ proteinTarget }}g
        </div>
      </div>
      <div class="bg-slate-700 rounded h-2">
        <div
          class="rounded h-full transition-all duration-500"
          :class="proteinOnTrack ? 'bg-green-500' : 'bg-amber-500'"
          :style="{ width: `${Math.min(proteinProgress, 100)}%` }"
        ></div>
      </div>
    </div>

    <!-- Calories -->
    <div class="bg-slate-800 rounded-xl p-3">
      <div class="flex justify-between items-center mb-1.5">
        <div class="text-xs font-semibold">Calories</div>
        <div class="text-xs text-slate-400">
          <span :class="calorieOnTrack ? 'text-green-400' : 'text-amber-400'">~{{ dailyCalories }}</span>
          / {{ calorieTarget }} kcal
        </div>
      </div>
      <div class="bg-slate-700 rounded h-2">
        <div
          class="rounded h-full transition-all duration-500"
          :class="calorieOnTrack ? 'bg-green-500' : 'bg-amber-500'"
          :style="{ width: `${Math.min(calorieProgress, 100)}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMealsStore } from '@/stores/meals'

const mealsStore = useMealsStore()

const dailyProtein = computed(() => mealsStore.dailyProtein)
const dailyCalories = computed(() => mealsStore.dailyCalories)
const proteinTarget = computed(() => mealsStore.proteinTarget)
const calorieTarget = computed(() => mealsStore.calorieTarget)

const proteinProgress = computed(() => proteinTarget.value > 0 ? (dailyProtein.value / proteinTarget.value) * 100 : 0)
const calorieProgress = computed(() => calorieTarget.value > 0 ? (dailyCalories.value / calorieTarget.value) * 100 : 0)

// "On track" = within reasonable range based on time of day
const proteinOnTrack = computed(() => proteinProgress.value >= 40 || new Date().getHours() < 12)
const calorieOnTrack = computed(() => calorieProgress.value >= 40 || new Date().getHours() < 12)
</script>
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build
git add src/components/dashboard/MacroTracker.vue
git commit -m "feat: MacroTracker — daily protein and calorie progress bars"
```

---

## Task 7: Supplement Settings Component

**Files:**
- Create: `src/components/settings/SupplementSettings.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div>
    <h3 class="text-sm font-bold text-brand-400 mb-3">Supplements</h3>

    <!-- Existing supplements -->
    <div class="flex flex-col gap-2 mb-3">
      <div
        v-for="supp in supplements"
        :key="supp.id"
        class="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2"
      >
        <div>
          <div class="text-sm">{{ supp.name }}</div>
          <div class="text-[10px] text-slate-500 capitalize">{{ formatFrequency(supp.frequency) }}</div>
        </div>
        <button
          @click="remove(supp.id)"
          class="text-slate-500 hover:text-red-400 transition-colors"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
      <p v-if="supplements.length === 0" class="text-sm text-slate-500">No supplements added yet.</p>
    </div>

    <!-- Add form -->
    <div class="flex gap-2">
      <input
        v-model="newName"
        placeholder="Supplement name"
        class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        @keyup.enter="add"
      />
      <select
        v-model="newFrequency"
        class="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm"
      >
        <option value="daily">Daily</option>
        <option value="[1,3,5]">Mon/Wed/Fri</option>
        <option value="[2,4,6]">Tue/Thu/Sat</option>
      </select>
      <button
        @click="add"
        :disabled="!newName.trim()"
        class="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        Add
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { useSupplementStore } from '@/stores/supplement'

const supplementStore = useSupplementStore()
const supplements = computed(() => supplementStore.supplements)

const newName = ref('')
const newFrequency = ref('daily')

async function add() {
  if (!newName.value.trim()) return
  await supplementStore.addSupplement(newName.value.trim(), newFrequency.value)
  newName.value = ''
  newFrequency.value = 'daily'
}

async function remove(id) {
  await supplementStore.removeSupplement(id)
}

function formatFrequency(freq) {
  if (freq === 'daily') return 'Daily'
  try {
    const days = JSON.parse(freq)
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days.map(d => names[d]).join(', ')
  } catch { return freq }
}
</script>
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build
git add src/components/settings/SupplementSettings.vue
git commit -m "feat: supplement settings — add, remove, frequency selection"
```

---

## Task 8: Update SettingsView — Health Tracking Section

**Files:**
- Modify: `src/views/SettingsView.vue`

- [ ] **Step 1: Add imports**

Add to script setup:
```javascript
import SupplementSettings from '@/components/settings/SupplementSettings.vue'
import { useSupplementStore } from '@/stores/supplement'

const supplementStore = useSupplementStore()
```

- [ ] **Step 2: Add health tracking state**

Add after existing state refs:
```javascript
const waterGoal = ref(8)
const proteinTarget = ref(150)
const calorieTarget = ref(2200)
```

In the existing `onMounted` or profile load section, populate from preferences:
```javascript
waterGoal.value = user.preferences?.daily_water_goal || 8
proteinTarget.value = user.preferences?.daily_protein_target || 150
calorieTarget.value = user.preferences?.daily_calorie_target || 2200
```

- [ ] **Step 3: Add Health Tracking section to template**

Add before the Save/Logout section:

```html
<!-- Health Tracking -->
<div class="mt-6">
  <h2 class="text-lg font-bold text-brand-400 mb-4">Health Tracking</h2>

  <div class="grid grid-cols-3 gap-3 mb-4">
    <div>
      <label class="mb-1 block text-sm text-slate-300">Water Goal</label>
      <input v-model.number="waterGoal" type="number" min="1" max="20"
        class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" />
      <span class="text-[10px] text-slate-500">glasses/day</span>
    </div>
    <div>
      <label class="mb-1 block text-sm text-slate-300">Protein Target</label>
      <input v-model.number="proteinTarget" type="number" min="0"
        class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" />
      <span class="text-[10px] text-slate-500">grams/day</span>
    </div>
    <div>
      <label class="mb-1 block text-sm text-slate-300">Calorie Target</label>
      <input v-model.number="calorieTarget" type="number" min="0"
        class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" />
      <span class="text-[10px] text-slate-500">kcal/day</span>
    </div>
  </div>

  <SupplementSettings />
</div>
```

- [ ] **Step 4: Update save handler**

In the existing save function, include the health tracking fields in the preferences update:

```javascript
const preferences = {
  ...user.preferences,
  daily_water_goal: waterGoal.value,
  daily_protein_target: proteinTarget.value,
  daily_calorie_target: calorieTarget.value
}
await userStore.updateProfile({ preferences })
```

- [ ] **Step 5: Hydrate supplement store on mount**

Add to onMounted: `supplementStore.hydrate()`

- [ ] **Step 6: Verify build and commit**

```bash
npm run build
git add src/views/SettingsView.vue
git commit -m "feat: health tracking settings — water goal, macro targets, supplements"
```

---

## Task 9: Update TodayChecklist — Supplements + Configurable Water

**Files:**
- Modify: `src/components/dashboard/TodayChecklist.vue`

- [ ] **Step 1: Add supplement store import**

```javascript
import { useSupplementStore } from '@/stores/supplement'
const supplementStore = useSupplementStore()
```

- [ ] **Step 2: Add supplements status dot to template**

Add between the Goals item and the Schedule item:

```html
<!-- Supplements -->
<div v-if="supplementStore.todaysSupplements.length > 0" class="flex items-start gap-2">
  <div
    class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
    :class="suppStatus.class"
  >
    <Check v-if="suppStatus.done" class="w-2.5 h-2.5 text-slate-900" />
  </div>
  <div>
    <div class="text-xs font-semibold">Supplements</div>
    <div class="text-[10px] text-slate-500">{{ suppStatus.subtitle }}</div>
  </div>
</div>
```

- [ ] **Step 3: Add supplement computed**

```javascript
const suppStatus = computed(() => {
  const { taken, due } = supplementStore.supplementStatus
  if (due === 0) return { subtitle: 'None today', class: 'border-slate-500', done: false }
  if (taken >= due) return { subtitle: `${taken}/${due} taken`, class: 'border-green-500 bg-green-500', done: true }
  if (taken > 0) return { subtitle: `${taken}/${due} taken`, class: 'border-amber-500', done: false }
  return { subtitle: `0/${due} taken`, class: 'border-slate-500', done: false }
})
```

- [ ] **Step 4: Replace hardcoded water goal**

Change the hydration status computed — replace any hardcoded `8` with `userStore.waterGoal`:

```javascript
const hydrationStatus = computed(() => {
  const glasses = userStore.waterGlasses || 0
  const goal = userStore.waterGoal
  if (glasses >= goal) return { class: 'border-green-500 bg-green-500', done: true }
  if (glasses > 0) return { class: 'border-amber-500', done: false }
  return { class: 'border-slate-500', done: false }
})
```

Update the template water display from `{{ userStore.waterGlasses }}/8 glasses` to `{{ userStore.waterGlasses }}/{{ userStore.waterGoal }} glasses`.

- [ ] **Step 5: Verify build and commit**

```bash
npm run build
git add src/components/dashboard/TodayChecklist.vue
git commit -m "feat: supplements status dot + configurable water goal in Today checklist"
```

---

## Task 10: Update UpNextCards — Supplement Card + Configurable Water

**Files:**
- Modify: `src/components/dashboard/UpNextCards.vue`

- [ ] **Step 1: Add imports**

```javascript
import { useSupplementStore } from '@/stores/supplement'
const supplementStore = useSupplementStore()
```

- [ ] **Step 2: Replace hardcoded water goal**

Change `const waterGoal = 8` to:
```javascript
const waterGoal = userStore.waterGoal
```

- [ ] **Step 3: Add supplement card to the cards computed**

Add after the water card logic, before the daily check-in card:

```javascript
// Supplement checklist card
const suppStatus = supplementStore.supplementStatus
if (suppStatus.due > 0) {
  if (suppStatus.taken < suppStatus.due) {
    incomplete.push({
      key: 'supplements',
      title: `Supplements — ${suppStatus.taken}/${suppStatus.due}`,
      subtitle: `${suppStatus.due - suppStatus.taken} remaining`,
      borderClass: 'border-teal-400',
      supplements: supplementStore.todaysSupplements.map(s => ({
        id: s.id,
        name: s.name,
        taken: supplementStore.isTaken(s.id)
      }))
    })
  } else {
    completed.push({
      key: 'supplements-done',
      title: `Supplements — ${suppStatus.taken}/${suppStatus.due}`,
      subtitle: 'All taken',
      borderClass: 'border-teal-400/50',
      muted: true
    })
  }
}
```

- [ ] **Step 4: Update the template to handle supplement card layout**

The supplement card needs a different layout than other cards (list of checkable items instead of single button). Update the template's card rendering to handle the `supplements` property:

```html
<!-- Inside the v-for card div, after the existing button/check rendering -->
<div v-if="card.supplements" class="w-full mt-2 flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
  <div
    v-for="supp in card.supplements"
    :key="supp.id"
    class="flex items-center justify-between"
  >
    <span class="text-xs" :class="supp.taken ? 'text-slate-500 line-through' : ''">{{ supp.name }}</span>
    <button
      @click.stop="supplementStore.toggleSupplement(supp.id)"
      class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0"
      :class="supp.taken ? 'border-teal-400 bg-teal-400' : 'border-slate-500 hover:border-teal-400'"
    >
      <Check v-if="supp.taken" class="w-3 h-3 text-slate-900" />
    </button>
  </div>
</div>
```

Restructure the card template so the supplement list renders below the title/subtitle row, not beside the action button. The existing layout has title+subtitle on left, button on right — for supplement cards, keep the title row but add the checklist below it spanning full width.

- [ ] **Step 5: Verify build and commit**

```bash
npm run build
git add src/components/dashboard/UpNextCards.vue
git commit -m "feat: supplement checklist card + configurable water goal in Up Next"
```

---

## Task 11: Update WeeklyProgress — Water Weekly Total

**Files:**
- Modify: `src/components/dashboard/WeeklyProgress.vue`

- [ ] **Step 1: Add import**

```javascript
import { useUserStore } from '@/stores/user'
const userStore = useUserStore()
```

- [ ] **Step 2: Add water row to template**

Add after the Goals ring section, before the "Last Workout" section:

```html
<!-- Water Weekly -->
<div class="flex items-center gap-2 mt-1 pt-2 border-t border-slate-700">
  <Droplets class="w-4 h-4 text-sky-400 shrink-0" />
  <div>
    <div class="text-xs font-semibold">Water</div>
    <div class="text-[10px] text-slate-500">{{ userStore.weeklyWater }}/{{ weeklyWaterGoal }} glasses</div>
  </div>
</div>
```

- [ ] **Step 3: Add import and computed**

Add icon import:
```javascript
import { Droplets } from 'lucide-vue-next'
```

Add computed:
```javascript
const weeklyWaterGoal = computed(() => {
  // Daily goal × days elapsed this week (Mon through today)
  const now = new Date()
  const day = now.getDay()
  const daysElapsed = day === 0 ? 7 : day // Sunday = 7 days elapsed
  return userStore.waterGoal * daysElapsed
})
```

- [ ] **Step 4: Verify build and commit**

```bash
npm run build
git add src/components/dashboard/WeeklyProgress.vue
git commit -m "feat: weekly water total in This Week panel"
```

---

## Task 12: Insights Carousel + Body Composition Card

**Files:**
- Create: `src/components/dashboard/InsightsCarousel.vue`
- Create: `src/components/dashboard/BodyCompositionCard.vue`
- Create: `src/components/dashboard/BodyLogModal.vue`

- [ ] **Step 1: Create InsightsCarousel.vue**

```vue
<template>
  <div>
    <div class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Insights</div>
    <div
      ref="scrollContainer"
      class="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
      @scroll="updateActiveDot"
    >
      <slot />
    </div>
    <!-- Dot indicators -->
    <div v-if="totalCards > 1" class="flex justify-center gap-1.5 mt-2">
      <div
        v-for="i in totalCards"
        :key="i"
        class="w-1.5 h-1.5 rounded-full transition-colors"
        :class="activeIndex === i - 1 ? 'bg-slate-300' : 'bg-slate-600'"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, useSlots } from 'vue'

const props = defineProps({
  totalCards: { type: Number, default: 1 }
})

const scrollContainer = ref(null)
const activeIndex = ref(0)

function updateActiveDot() {
  if (!scrollContainer.value) return
  const el = scrollContainer.value
  const cardWidth = el.firstElementChild?.offsetWidth || el.offsetWidth
  activeIndex.value = Math.round(el.scrollLeft / cardWidth)
}
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
```

- [ ] **Step 2: Create BodyCompositionCard.vue**

```vue
<template>
  <div class="bg-slate-800 rounded-xl p-4 min-w-[85vw] max-w-[85vw] snap-center shrink-0 sm:min-w-[300px] sm:max-w-[350px]">
    <!-- Empty state -->
    <div v-if="!latestLog" class="text-center py-4">
      <p class="text-sm text-slate-400 mb-2">Track your body composition</p>
      <button @click="showModal = true" class="text-xs text-blue-400 hover:text-blue-300">
        Log your first weigh-in
      </button>
    </div>

    <!-- Has data -->
    <div v-else>
      <div class="flex items-start justify-between mb-2">
        <div>
          <div class="text-2xl font-bold">{{ latestLog.weight_lbs }} lbs</div>
          <div v-if="change" class="text-xs mt-0.5" :class="change.direction === 'down' ? 'text-green-400' : change.direction === 'up' ? 'text-red-400' : 'text-slate-400'">
            {{ change.direction === 'down' ? '↓' : change.direction === 'up' ? '↑' : '→' }}
            {{ change.value }} lbs since {{ formatDate(previousLog?.date) }}
          </div>
          <div v-else class="text-xs text-slate-500 mt-0.5">First entry — {{ formatDate(latestLog.date) }}</div>
        </div>
        <!-- Photo thumbnail -->
        <div v-if="photoUrl" class="w-12 h-12 rounded-lg overflow-hidden bg-slate-700">
          <img :src="photoUrl" class="w-full h-full object-cover" />
        </div>
      </div>

      <div class="flex gap-2 mt-3">
        <button
          v-if="bodyStore.needsMonthlyLog"
          @click="showModal = true"
          class="flex-1 text-xs bg-blue-500 text-white py-2 rounded-lg font-semibold"
        >
          Log weigh-in
        </button>
        <button
          @click="showModal = true"
          class="flex-1 text-xs bg-slate-700 text-slate-300 py-2 rounded-lg"
        >
          View history
        </button>
      </div>
    </div>

    <!-- Modal -->
    <BodyLogModal v-if="showModal" @close="showModal = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useBodyStore } from '@/stores/body'
import BodyLogModal from './BodyLogModal.vue'

const bodyStore = useBodyStore()

const showModal = ref(false)
const photoUrl = ref(null)

const latestLog = computed(() => bodyStore.latestLog)
const previousLog = computed(() => bodyStore.previousLog)
const change = computed(() => bodyStore.weightChange)

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

onMounted(async () => {
  if (latestLog.value?.photo_front_url) {
    photoUrl.value = await bodyStore.getSignedUrl(latestLog.value.photo_front_url)
  }
})
</script>
```

- [ ] **Step 3: Create BodyLogModal.vue**

```vue
<template>
  <div class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" @click.self="$emit('close')">
    <div class="bg-slate-800 rounded-xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-bold">Body Composition</h3>
        <button @click="$emit('close')" class="text-slate-500 hover:text-slate-300">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Add entry form -->
      <div class="mb-6 p-3 bg-slate-750 rounded-lg border border-slate-700">
        <div class="text-xs font-semibold text-slate-400 mb-3">New Entry</div>
        <div class="flex gap-3 mb-3">
          <div class="flex-1">
            <label class="text-xs text-slate-400 mb-1 block">Weight (lbs)</label>
            <input
              v-model.number="form.weight"
              type="number"
              step="0.1"
              :placeholder="bodyStore.latestLog?.weight_lbs || ''"
              class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Front photo</label>
            <input type="file" accept="image/*" capture="environment" @change="e => form.photoFront = e.target.files[0]"
              class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-700 file:text-slate-300" />
          </div>
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Side photo</label>
            <input type="file" accept="image/*" capture="environment" @change="e => form.photoSide = e.target.files[0]"
              class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-700 file:text-slate-300" />
          </div>
        </div>

        <input v-model="form.notes" placeholder="Notes (optional)" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mb-3" />

        <button
          @click="submit"
          :disabled="!form.weight || saving"
          class="w-full bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save Entry' }}
        </button>
      </div>

      <!-- History -->
      <div class="text-xs font-semibold text-slate-400 mb-2">History</div>
      <div v-if="bodyStore.logs.length === 0" class="text-sm text-slate-500 text-center py-4">No entries yet</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="log in bodyStore.logs" :key="log.id" class="bg-slate-750 rounded-lg p-3">
          <div class="flex justify-between items-center">
            <div>
              <div class="text-sm font-semibold">{{ log.weight_lbs }} lbs</div>
              <div class="text-[10px] text-slate-500">{{ formatDate(log.date) }}</div>
            </div>
            <div class="text-[10px] text-slate-500">{{ log.notes || '' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { X } from 'lucide-vue-next'
import { useBodyStore } from '@/stores/body'

const emit = defineEmits(['close'])
const bodyStore = useBodyStore()

const saving = ref(false)
const form = reactive({
  weight: null,
  photoFront: null,
  photoSide: null,
  notes: ''
})

async function submit() {
  if (!form.weight) return
  saving.value = true
  try {
    await bodyStore.addLog(form.weight, form.photoFront, form.photoSide, form.notes)
    form.weight = null
    form.photoFront = null
    form.photoSide = null
    form.notes = ''
  } finally {
    saving.value = false
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
</script>
```

- [ ] **Step 4: Verify build and commit**

```bash
npm run build
git add src/components/dashboard/InsightsCarousel.vue src/components/dashboard/BodyCompositionCard.vue src/components/dashboard/BodyLogModal.vue
git commit -m "feat: insights carousel with body composition card and weigh-in modal"
```

---

## Task 13: Update MealSlot — AI Estimation + Save Flow

**Files:**
- Modify: `src/components/meals/MealSlot.vue`

- [ ] **Step 1: Add description field to the log form**

In the template's log form section (where name, calories, protein inputs are), add a description textarea:

```html
<div class="mb-2">
  <textarea
    v-model="form.description"
    placeholder="Describe what you ate (AI estimates macros)..."
    rows="2"
    class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none"
  ></textarea>
  <button
    v-if="form.description && !estimating"
    @click="estimateFromDescription"
    class="text-xs text-blue-400 hover:text-blue-300 mt-1"
  >
    Estimate macros with AI
  </button>
  <span v-if="estimating" class="text-xs text-slate-500 mt-1 block">Estimating...</span>
</div>
```

- [ ] **Step 2: Add script state for AI estimation**

```javascript
const estimating = ref(false)
const showSavePrompt = ref(false)

// Add description to existing form reactive
// In the existing form object, add: description: '', confidence: null

async function estimateFromDescription() {
  if (!form.description) return
  estimating.value = true
  try {
    const result = await mealsStore.estimateMacros(form.description)
    form.calories = result.calories
    form.protein = result.protein
    form.confidence = result.confidence
    if (!form.name) form.name = form.description.slice(0, 50)
  } catch (e) {
    // Show error inline
  } finally {
    estimating.value = false
  }
}
```

- [ ] **Step 3: Update the submit handler**

After successfully logging the meal, show the "eat again?" prompt:

```javascript
// After successful logMeal call:
if (form.description && (form.calories || form.protein)) {
  showSavePrompt.value = true
}
```

- [ ] **Step 4: Add "eat again?" prompt to template**

```html
<div v-if="showSavePrompt" class="mt-2 p-2 bg-slate-700/50 rounded-lg flex items-center justify-between">
  <span class="text-xs text-slate-300">Will you eat this again?</span>
  <div class="flex gap-2">
    <button @click="saveForReuse" class="text-xs text-blue-400 hover:text-blue-300">Yes, save it</button>
    <button @click="showSavePrompt = false" class="text-xs text-slate-500 hover:text-slate-300">No</button>
  </div>
</div>
```

- [ ] **Step 5: Add saveForReuse function**

```javascript
async function saveForReuse() {
  await mealsStore.saveAsMeal({
    name: form.name || form.description?.slice(0, 50),
    description: form.description,
    calories: form.calories,
    protein: form.protein
  })
  showSavePrompt.value = false
}
```

- [ ] **Step 6: Update logMeal call to include description and confidence**

In the existing submit handler, add `description` and `confidence` to the data passed to `mealsStore.logMeal()`.

- [ ] **Step 7: Verify build and commit**

```bash
npm run build
git add src/components/meals/MealSlot.vue
git commit -m "feat: AI macro estimation in meal logging with save-for-reuse flow"
```

---

## Task 14: Update DashboardView — Wire Phase 2 Components

**Files:**
- Modify: `src/views/DashboardView.vue`

- [ ] **Step 1: Add imports**

```javascript
import MacroTracker from '@/components/dashboard/MacroTracker.vue'
import InsightsCarousel from '@/components/dashboard/InsightsCarousel.vue'
import BodyCompositionCard from '@/components/dashboard/BodyCompositionCard.vue'
import { useSupplementStore } from '@/stores/supplement'
import { useBodyStore } from '@/stores/body'

const supplementStore = useSupplementStore()
const bodyStore = useBodyStore()
```

- [ ] **Step 2: Add new components to template**

After the GoalProgress section and before UpNextCards, add:

```html
<!-- 5. Macro Tracker -->
<MacroTracker />
```

After the UpNextCards section, add:

```html
<!-- 8. Insights Carousel -->
<InsightsCarousel :total-cards="1">
  <BodyCompositionCard />
</InsightsCarousel>
```

- [ ] **Step 3: Hydrate new stores on mount**

Update the `onMounted` Promise.all to include:

```javascript
supplementStore.hydrate(),
bodyStore.hydrate()
```

- [ ] **Step 4: Verify build and commit**

```bash
npm run build
git add src/views/DashboardView.vue
git commit -m "feat: wire MacroTracker and InsightsCarousel into dashboard"
```

---

## Task 15: Final Verification + Push

- [ ] **Step 1: Full build check**

Run: `npm run build`

Expected: Build succeeds, no errors.

- [ ] **Step 2: Push to remote**

```bash
git push origin master
```

- [ ] **Step 3: Verify deployment**

Check GitHub Actions completes, then verify at https://lamsimon86-create.github.io/life-os-v2/

---

## Parallelization Notes

Tasks that can run in parallel:
- **Tasks 2-5** (all store work) — independent stores and store modifications
- **Tasks 6-7** (MacroTracker + SupplementSettings) — independent components
- **Tasks 9-11** (dashboard component updates) — depend on Tasks 2+4 being done
- **Task 12** (carousel + body card) — depends on Task 3
- **Task 13** (MealSlot) — depends on Task 5
- **Task 14** (DashboardView) — depends on all components

Recommended parallel groups:
1. Task 1 (migration) — do first
2. Tasks 2-5 — all in parallel
3. Tasks 6-7 + Tasks 9-12 — all in parallel
4. Task 13 — after Task 5
5. Task 14 — after all components
6. Task 15 — last
