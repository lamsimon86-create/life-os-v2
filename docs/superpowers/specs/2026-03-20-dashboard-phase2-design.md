# Dashboard Phase 2 — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Add supplement tracking, AI-estimated macro tracking with saved meals, water improvements, and an insights carousel (body weight + progress photos) to the existing dashboard.
**Depends on:** Dashboard redesign (2026-03-20-dashboard-redesign-design.md) — completed.

## Overview

Four features that deepen the health tracking on the Life OS dashboard. Each is independent but shares the same store/component patterns established in Phase 1.

---

## Feature 1: Supplement Checklist

### What it does
Users maintain a list of supplements they take. Each day, they check off which ones they've taken. The dashboard shows status in the Today panel and a detailed checklist in Up Next.

### Supplement list management
- Users add/remove supplements in **Settings** (or a supplements sub-page)
- Each supplement has: `name`, `frequency` (daily, or specific days of the week)
- AI can suggest supplements via the AI panel based on user's goals, fitness program, and dietary preferences. Suggested supplements appear as a prompt the user can accept or dismiss.
- No limit on number of supplements

### Dashboard integration

**Today panel (TodayChecklist.vue):**
- New status dot item: "Supplements"
- Subtext: "{taken}/{due} taken"
- Status: green filled (all taken), amber (some taken), grey (none taken)
- Only shows supplements that are due today (based on frequency/day-of-week)

**Up Next cards (UpNextCards.vue):**
- New card with border color cyan/teal
- Title: "Supplements — {taken}/{due}"
- Instead of a single action button, the card body lists each due supplement with a tap-to-check button
- Each supplement: name on left, check button on right
- Tapping a supplement immediately marks it as taken (upsert to DB)
- When all taken: card flips to muted "All supplements taken" with checkmark
- Card is always visible (like the water card), not hidden when complete

### Data model

**`v2_supplements` table (new):**
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
name text NOT NULL,
frequency text DEFAULT 'daily',  -- 'daily' or JSON array of day numbers [1,3,5] for Mon/Wed/Fri
sort_order integer DEFAULT 0,
is_active boolean DEFAULT true,
created_at timestamptz DEFAULT now()
```

**`v2_supplement_logs` table (new):**
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
supplement_id uuid REFERENCES v2_supplements(id) ON DELETE CASCADE NOT NULL,
date date NOT NULL DEFAULT CURRENT_DATE,
taken_at timestamptz DEFAULT now(),
UNIQUE(supplement_id, date)
```

RLS on both tables: user can only access own data.

### Store: supplementStore (new)
- `src/stores/supplement.js`
- State: `supplements` (user's supplement list), `todaysLogs` (today's check-offs)
- `hydrate()`: fetch supplements + today's logs
- `todaysSupplements` computed: filter supplements due today based on frequency + current day of week
- `supplementStatus` computed: `{ taken, due }` counts
- `toggleSupplement(supplementId)`: if not taken, insert log. If taken, delete log (undo)
- `addSupplement(name, frequency)`: insert to v2_supplements
- `removeSupplement(id)`: set is_active = false (soft delete)
- `reorderSupplements(ids)`: update sort_order

---

## Feature 2: Protein / Calorie Tracker (AI-Estimated)

### What it does
When users log a meal, they describe what they ate in plain text. The AI estimates calories and protein. The dashboard shows running daily totals with progress bars toward configurable targets. Frequently eaten meals can be saved for quick re-logging.

### Meal logging flow (updated)
1. User navigates to meals page or taps "Log" on the meal card
2. **Option A — New meal:** User types a text description (e.g., "grilled chicken breast with brown rice and steamed broccoli")
3. AI estimates calories and protein via the `ai-assistant` Edge Function
4. Estimates are shown to the user for confirmation before saving
5. After saving, the app asks: **"Will you eat this again?"** — if yes, the meal is automatically saved to the user's saved meals library (updates existing `v2_recipes` table with macro data). If no, it just logs the meal.
6. **Option B — Saved meal:** User picks from their saved meals list. Macros auto-fill. One-tap log.

### AI estimation prompt
Sent to `ai-assistant` with context:
```
Estimate the calories and protein (in grams) for this meal: "{description}"

Respond with JSON only: { "calories": number, "protein": number, "confidence": "high" | "medium" | "low" }

Base estimates on typical serving sizes. If the description is vague, use medium portions.
```

The confidence level can be shown to the user as a subtle indicator (e.g., "~" prefix for medium/low confidence).

### Dashboard integration

**Up Next section or a new dedicated row:**
- Two inline progress bars below the Up Next section (or integrated into the Today panel):
  - Protein: "~140g / 180g protein" with a progress bar (green when on track, amber when behind)
  - Calories: "~1,850 / 2,400 cal" with a progress bar

**This Week panel (WeeklyProgress.vue):**
- No changes needed for phase 2. Can add weekly average protein in a future iteration.

### Data model changes

**Modify `v2_meals` table:**
```sql
ALTER TABLE v2_meals ADD COLUMN description text;
ALTER TABLE v2_meals ADD COLUMN calories_est integer;
ALTER TABLE v2_meals ADD COLUMN protein_est integer;
ALTER TABLE v2_meals ADD COLUMN confidence text DEFAULT 'medium';
```

**Modify `v2_recipes` table:**
```sql
ALTER TABLE v2_recipes ADD COLUMN calories_est integer;
ALTER TABLE v2_recipes ADD COLUMN protein_est integer;
```

**Targets in `v2_profiles.preferences` (JSONB):**
Add keys:
- `daily_protein_target` (integer, grams, default 150)
- `daily_calorie_target` (integer, kcal, default 2200)

### Store changes: mealsStore (modify)
- Add `dailyProtein` computed: sum of `protein_est` from today's meals
- Add `dailyCalories` computed: sum of `calories_est` from today's meals
- Add `proteinTarget` computed: from `userStore.preferences.daily_protein_target || 150`
- Add `calorieTarget` computed: from `userStore.preferences.daily_calorie_target || 2200`
- Add `savedMealsWithMacros` computed: recipes that have calories_est/protein_est populated
- Update `logMeal()` to accept description, calories_est, protein_est, confidence
- Add `estimateMacros(description)`: calls ai-assistant, returns { calories, protein, confidence }
- Add `saveAsMeal(mealData)`: upsert to v2_recipes with macro data

---

## Feature 3: Water Improvements

### Changes from Phase 1

**Weekly total in This Week panel (WeeklyProgress.vue):**
- Add a water row below the existing 3 rings (workouts, meals, goals)
- Display: "{weekTotal}/{weekGoal} glasses this week"
- No ring needed — just text with an icon
- `weekTotal`: sum of `water_glasses` from `v2_daily_logs` for Monday through today
- `weekGoal`: daily goal × days elapsed this week

**Configurable daily goal:**
- Add to Settings page: "Daily water goal" number input (default 8)
- Stored in `v2_profiles.preferences.daily_water_goal`
- The TodayChecklist, UpNextCards, and WeeklyProgress all read from this instead of hardcoded 8

### Store changes: userStore (modify)
- Add `waterGoal` computed: `preferences.daily_water_goal || 8`
- Add `weeklyWater` state: fetched during hydrate() — sum of water_glasses for this week from v2_daily_logs

### Data model changes
No new tables. Add `daily_water_goal` to preferences JSONB in v2_profiles (application-level, no migration needed).

For weekly water total, query `v2_daily_logs` during hydrate:
```sql
SELECT SUM(water_glasses) FROM v2_daily_logs
WHERE user_id = ? AND date >= monday_of_this_week
```

---

## Feature 4: Insights Carousel (Body Weight + Progress Photos)

### What it does
A horizontally swipeable section at the bottom of the dashboard. First card is body composition (weight + photos). Future cards (sleep trends, volume trends, PRs) are placeholders for now.

### Carousel structure
- Horizontal scroll container with snap points
- Dot indicators showing which card is active
- Each card is a fixed-width panel (~90% of viewport width)
- Cards: Body Composition (first), then placeholder "Coming soon" cards

### Body Composition Card
**Display:**
- Current weight: "187 lbs"
- Change since last entry: "↓ 3 lbs since Feb 15"
- Latest progress photo thumbnail (if exists)
- "Log weigh-in" button (if no entry this month)

**Tap to expand:** Opens a modal/bottom sheet with:
- Full timeline: monthly entries listed chronologically (newest first)
- Each entry: date, weight, change from previous, front/side photos
- Swipeable photo comparison between any two entries
- "Add entry" button

### Monthly weigh-in flow
1. Tap "Log weigh-in" (from card or expanded view)
2. Enter weight (number input, pre-filled with last entry)
3. Optional: take or upload front photo
4. Optional: take or upload side photo
5. Optional: notes field
6. Save — uploads photos to Supabase Storage, inserts row

### Data model

**`v2_body_logs` table (new):**
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
date date NOT NULL DEFAULT CURRENT_DATE,
weight_lbs numeric(5,1) NOT NULL,
photo_front_url text,
photo_side_url text,
notes text,
created_at timestamptz DEFAULT now()
```

RLS: user can only access own data.

**Supabase Storage bucket:** `progress-photos`
- Public read (user can view own photos via signed URLs or public bucket)
- Upload via client with user_id path prefix: `progress-photos/{user_id}/{timestamp}-front.jpg`

### Store: bodyStore (new)
- `src/stores/body.js`
- State: `logs` (all body log entries), `loading`
- `hydrate()`: fetch all v2_body_logs ordered by date desc
- `latestLog` computed: most recent entry
- `previousLog` computed: second most recent (for comparison)
- `weightChange` computed: difference between latest and previous
- `addLog(weight, photoFront, photoSide, notes)`: upload photos to Storage, insert row
- `deleteLog(id)`: remove entry + associated photos

### Dashboard component: InsightsCarousel.vue (new)
- Horizontal scroll container with CSS scroll-snap
- Renders `BodyCompositionCard.vue` as first child
- Future: additional card components added as children

### BodyCompositionCard.vue (new)
- Compact card showing latest weight, change, photo thumbnail
- "Log weigh-in" button if no entry this month
- Tap expands to full timeline modal

---

## Updated Dashboard Section Order

1. Header + avatar + streak/level pills
2. XP bar
3. Brief Me (inline AI briefing)
4. This Week | Today split
   - This Week: workouts ring, meals ring, goals ring, **water weekly total**
   - Today: workout, meals, goals, **supplements status**, daily check-in, water
5. **Macro tracker** (protein + calorie progress bars)
6. Goal Progress (top 3 focused goals)
7. Up Next (workout, meals, water +1, **supplement checklist**, daily check-in)
8. **Insights carousel** (body composition card, future KPI cards)

---

## Components to Create

| Component | Responsibility |
|-----------|---------------|
| `src/components/dashboard/InsightsCarousel.vue` | Swipeable horizontal container |
| `src/components/dashboard/BodyCompositionCard.vue` | Weight + photos card |
| `src/components/dashboard/BodyLogModal.vue` | Expanded timeline + add entry |
| `src/components/dashboard/MacroTracker.vue` | Daily protein + calorie progress bars |
| `src/components/settings/SupplementSettings.vue` | Add/remove/reorder supplements |

## Components to Modify

| Component | Changes |
|-----------|---------|
| `DashboardView.vue` | Add MacroTracker, InsightsCarousel, hydrate new stores |
| `WeeklyProgress.vue` | Add water weekly total row |
| `TodayChecklist.vue` | Add supplements status dot |
| `UpNextCards.vue` | Add supplement checklist card, use configurable water goal |
| `SettingsView.vue` | Add water goal, protein/calorie targets, supplements management |
| `MealsView.vue` | Add meal description input, AI estimation, "eat again?" prompt, saved meals |

## New Stores

| Store | Responsibility |
|-------|---------------|
| `src/stores/supplement.js` | Supplement list + daily logs |
| `src/stores/body.js` | Body weight logs + progress photos |

## Modified Stores

| Store | Changes |
|-------|---------|
| `mealsStore` | dailyProtein, dailyCalories, targets, estimateMacros(), saveAsMeal() |
| `userStore` | waterGoal, weeklyWater |

## Database Changes (Single Migration)

```sql
-- Supplements
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

-- Body logs
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

-- Macro tracking on meals
ALTER TABLE v2_meals ADD COLUMN description text;
ALTER TABLE v2_meals ADD COLUMN calories_est integer;
ALTER TABLE v2_meals ADD COLUMN protein_est integer;
ALTER TABLE v2_meals ADD COLUMN confidence text DEFAULT 'medium';

-- Macro data on saved recipes
ALTER TABLE v2_recipes ADD COLUMN calories_est integer;
ALTER TABLE v2_recipes ADD COLUMN protein_est integer;
```

## Settings Page Additions

Add a "Health Tracking" section to SettingsView.vue:
- **Daily water goal:** number input (default 8)
- **Daily protein target:** number input in grams (default 150)
- **Daily calorie target:** number input in kcal (default 2200)
- **Supplements:** list with add/remove/reorder. Each item has name + frequency selector (daily or specific days)

All stored in `v2_profiles.preferences` JSONB except supplements which have their own table.
