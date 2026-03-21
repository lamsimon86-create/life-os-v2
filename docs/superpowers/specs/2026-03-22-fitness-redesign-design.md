# Fitness Section Redesign — Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Scope:** Redesign the fitness section across 4 areas: workout experience, program management, analytics & progression, and bug fixes. Adds exercise substitution, optional RPE, adjustable rest timer, inline program editor, AI program builder, progression charts, PR tracking, and muscle group volume breakdown.
**Depends on:** Dashboard Phase 2 (complete), GPS Goal System (complete)

## Overview

The fitness section currently handles basic workout tracking — log weight and reps for programmed exercises. This redesign makes it flexible (swap exercises mid-workout), customizable (edit your program), intelligent (AI builds programs), and insightful (progression charts, PRs, volume analysis).

---

## Sub-project 1: Workout Experience

### Exercise Card Redesign

The ExerciseCard component gains three new features while keeping the core set-logging flow unchanged.

#### Swap Button

A "Swap" button appears in the exercise card header, next to the set counter badge.

**Flow:**
1. User taps "Swap" on any exercise card
2. Bottom sheet opens with searchable exercise library
3. Library auto-filters to the same muscle group as the original exercise
4. User can switch muscle group filter or search by name
5. Tapping an exercise replaces the card content
6. The swapped card shows: new exercise name, "Swapped for {original}" subtitle in blue, blue left border, and an "Undo" button
7. Sets/reps/rest carry over from the original exercise
8. Weight pre-fills from user's last session with the substitute exercise (via `fetchLastSessionSets` logic, queried by exercise name)
9. Undo reverts to the original exercise (only available before logging any sets)

**Data model:** The swap is session-only — it does NOT modify the program. The substitute exercise name is logged in `v2_workout_sets.exercise_name` (already the case). A new `substituted_for` column records the original exercise name for analytics context.

**Exercise library search component:** `ExerciseSearch.vue` — a reusable bottom sheet with:
- Text search input
- Muscle group filter chips (All, Chest, Back, Shoulders, Legs, Arms, Core)
- Results list showing: exercise name, muscle group, equipment, compound/isolation badge
- Reads from `v2_exercise_library` table

This component is shared between workout swaps and the program editor's "Add Exercise" flow.

#### Optional RPE

A small dropdown appears after the reps input in each set row. Options: empty (default), 6, 7, 8, 9, 10. When empty, no RPE is recorded. When filled, RPE shows in the logged set row as amber text (e.g., "RPE 8").

RPE is deliberately minimal — a dropdown, not a slider or stepper. It's there for sets that matter (heavy top sets), not forced on every set.

**Data model:** New `rpe` column (integer, nullable) on `v2_workout_sets`.

#### Adjustable Rest Timer

The rest timer moves from a floating widget to an inline element inside the exercise card. It appears after logging a set and shows:
- Countdown in large text (green when counting, stays green when done)
- -30s / +30s buttons to adjust duration mid-rest
- X button to dismiss

The timer starts automatically after logging a set. Default duration comes from the exercise's `rest_seconds`. Adjustments are session-only — they don't change the program's rest time.

**Changes to RestTimer.vue:**
- Remove fixed positioning
- Accept `onAdjust` callback for -30s/+30s
- Parent (ExerciseCard) manages timer visibility and passes adjusted duration
- Keep vibration on completion
- No audio cue (user confirmed not needed)

#### Skip Exercise

Long-press (or swipe left on mobile) on the exercise card header to skip an exercise. The card greys out (opacity 0.4) with a "Skipped" label and an "Undo Skip" button. Skipped exercises are not counted in the workout's exercise total or XP calculation.

No data is written for skipped exercises — they simply don't appear in `v2_workout_sets` for that session. The card stays visible (greyed out) so the user can undo the skip.

### Finish Workout

No changes to the finish flow. User taps "Finish Workout" and the workout completes immediately — no warnings about missing sets (user preference). XP calculation counts only exercises with logged sets.

---

## Sub-project 2: Program Management

### Program Editor

Tapping any day on the ProgramCard opens a day editor view. The ProgramCard is updated to show:
- Exercise count per day (e.g., "5 exercises")
- Chevron (›) indicating tappability
- Today highlighted with blue border

#### Day Editor Component

`DayEditor.vue` — a full-width panel (or bottom sheet on mobile) containing:

**Header:**
- Editable day name input (e.g., "Push — Chest & Tris")
- "Make Rest Day" button (red) — clears exercises and marks `is_rest_day = true`

**Exercise list:**
- Each exercise row shows: drag handle (☰), exercise name, inline editable fields for sets (number), reps (text, e.g., "8-10"), rest (number in seconds), and a delete (X) button
- Drag handle enables reorder via touch/mouse drag (updates `sort_order` in DB)
- Delete button removes the exercise from the day (confirms if it's the last exercise)

**Footer:**
- "+ Add Exercise" button — opens `ExerciseSearch.vue` (same component as workout swaps). Selected exercise is added with default sets (3), reps ("8-12"), and rest (90s)
- Cancel button — discards changes
- "Save Changes" button — persists all changes to `v2_program_days` and `v2_program_exercises`

**Rest day toggle:** "Make Rest Day" sets `is_rest_day = true` and removes all exercises for that day. This is reversible — tapping "Make Training Day" on a rest day lets the user add exercises back.

#### Navigation

The day editor is accessed by tapping a day on the ProgramCard. It can be implemented as:
- A route: `/fitness/edit/:dayId` (preferred — clean URL, back button works)
- Or a full-screen modal overlay

The route approach is recommended for clean navigation.

### AI Program Builder

Replaces the 3 hardcoded templates (PPL, Upper/Lower, Full Body) with an AI-generated program flow.

**Flow:**
1. User taps "Build My Program" on FitnessView (when no program is active)
2. A multi-step form collects: available training days (checkboxes, Mon-Sun), fitness goal (dropdown: build muscle / lose fat / strength / general fitness), experience level (beginner / intermediate / advanced), any injuries (text input, optional)
3. AI generates a full program via `ai-assistant` Edge Function
4. Program is displayed in a preview using the ProgramCard + DayEditor read-only view
5. User can edit anything in the preview before accepting
6. "Accept & Activate" saves the program to the database

**AI Prompt:**
```
Build a training program for the user:

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
      "day_of_week": 0-6 (0=Sunday),
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
- If injuries are noted, avoid exercises that stress those areas
```

**Fallback:** If the AI call fails, show an error toast and offer the 3 hardcoded templates as a backup. Templates are moved from FitnessView inline code to a constants file (`src/lib/program-templates.js`).

**Store changes:** Add `createProgramFromAI(days, goal, experience, injuries)` action to `fitnessStore`. This calls the AI, parses the response, and calls the existing `createProgramFromTemplate()` with the parsed data (same DB write path).

### Program History

When a user switches programs, the old program is archived instead of deactivated.

**Data model:** Add `archived_at` (timestamptz, nullable) column to `v2_fitness_programs`. When deactivating, set `archived_at = now()` and `is_active = false`.

**UI:** Add a "Previous Programs" section at the bottom of FitnessView (collapsed by default). Shows archived programs with name, date range, and a "Reactivate" button. Reactivating deactivates the current program and sets `is_active = true, archived_at = null` on the selected program.

---

## Sub-project 3: Analytics & Progression

### History Tab Redesign

The History tab on FitnessView is redesigned with 3 sections stacked vertically:

#### 1. Progression Chart (default/top section)

**Exercise selector:** Dropdown listing all exercises the user has logged (queried from distinct `exercise_name` in `v2_workout_sets`).

**Chart:** Chart.js line chart with two datasets:
- **Blue solid line:** Best set weight per session (max weight from `v2_workout_sets` for that exercise on each workout date, excluding warmup sets)
- **Purple dashed line:** Estimated 1RM per session using Epley formula: `weight * (1 + reps / 30)` — calculated from the best set's weight and reps

**Stats row** (below chart):
- Best weight (PR) in lbs
- Estimated 1RM in lbs
- Progress: weight gained over the chart period (e.g., "+20 lbs / 8 wks")
- Total sessions logged for that exercise

**Data source:** `fitnessStore.fetchExerciseHistory(exerciseName)` — already exists, returns all non-warmup sets. The chart component computes best-set and 1RM from this data.

#### 2. Personal Records

A list of the user's heaviest lift per exercise, showing:
- Exercise name
- Weight (lbs) in gold/amber accent
- Rep count
- Date achieved

**Computation:** Query `v2_workout_sets` grouped by `exercise_name`, take `MAX(weight)` with its corresponding `reps` and `created_at`. Filter `is_warmup = false`.

**Store:** Add `fetchPersonalRecords()` action to `fitnessStore`. Returns array of `{ exercise_name, weight, reps, date }`.

**PR detection:** When a user logs a set that exceeds their previous max weight for that exercise, show a brief inline celebration (gold flash on the set row, "NEW PR" badge). This is computed client-side by comparing the logged weight against the current PR for that exercise (fetched during workout setup).

#### 3. Weekly Volume by Muscle Group

Horizontal bar chart showing total sets per muscle group for the current week.

**Data flow:**
1. Fetch this week's `v2_workout_sets` (Monday to today)
2. Join exercise names with `v2_exercise_library.muscle_group`
3. Count sets per muscle group
4. Render as horizontal progress bars, each bar relative to the highest group

**Muscle groups:** Chest, Back, Shoulders, Legs, Arms, Core (from `v2_exercise_library.muscle_group`).

**Fallback:** If an exercise isn't in the library, it's excluded from the volume chart. A small note at the bottom: "Based on logged sets this week · Muscle groups from exercise library."

---

## Sub-project 4: Quick Fixes

### Duplicate Focus Display
FitnessView line ~125 renders the workout focus text twice. Remove the duplicate.

### Streak Logic
Current streak counts consecutive days with a logged workout. This breaks on programmed rest days.

**Fix:** Streak counts consecutive *training days* with a completed workout. A programmed rest day does not break the streak. Implementation:
1. Get the user's program days (which days are rest days)
2. When calculating streak, skip rest days in the sequence
3. Streak breaks only when a scheduled training day has no completed workout

### Exercise Library Seed
Seed `v2_exercise_library` with ~50 common exercises covering all muscle groups and equipment types. This table already exists but is empty.

Categories to cover:
- **Chest:** Bench Press, Incline Bench, Dumbbell Bench, Dumbbell Flyes, Cable Flyes, Incline Dumbbell Press, Chest Dips
- **Back:** Barbell Row, Dumbbell Row, Pull-ups, Lat Pulldown, Seated Cable Row, T-Bar Row, Face Pulls
- **Shoulders:** Overhead Press, Lateral Raises, Front Raises, Rear Delt Flyes, Arnold Press, Upright Row
- **Legs:** Squat, Leg Press, Romanian Deadlift, Leg Curl, Leg Extension, Calf Raises, Bulgarian Split Squat, Hip Thrust
- **Arms:** Barbell Curl, Dumbbell Curl, Hammer Curl, Tricep Pushdown, Skull Crushers, Overhead Tricep Extension, Preacher Curl
- **Core:** Planks, Cable Crunches, Hanging Leg Raises, Ab Wheel, Russian Twists
- **Compound:** Deadlift, Clean and Press, Farmer's Walk

Each entry: `name`, `muscle_group`, `equipment` (barbell/dumbbell/cable/machine/bodyweight), `is_compound` (boolean).

### Weight Ratios
Remove the hardcoded `WEIGHT_RATIOS` object from ExerciseCard. Instead, when pre-filling weight for a new exercise (no previous session data), leave the weight field empty. The user inputs their starting weight manually. Previous session data is the primary pre-fill mechanism and already works.

---

## Database Changes

### Migration: `007_fitness_redesign.sql`

```sql
-- RPE tracking on sets
ALTER TABLE v2_workout_sets ADD COLUMN rpe integer;
ALTER TABLE v2_workout_sets ADD COLUMN substituted_for text;

-- Program archival
ALTER TABLE v2_fitness_programs ADD COLUMN archived_at timestamptz;

-- Seed exercise library (~50 exercises)
INSERT INTO v2_exercise_library (name, muscle_group, equipment, is_compound) VALUES
  -- Chest
  ('Bench Press', 'Chest', 'barbell', true),
  ('Incline Bench Press', 'Chest', 'barbell', true),
  ('Dumbbell Bench Press', 'Chest', 'dumbbell', true),
  ('Incline Dumbbell Press', 'Chest', 'dumbbell', true),
  ('Dumbbell Flyes', 'Chest', 'dumbbell', false),
  ('Cable Flyes', 'Chest', 'cable', false),
  ('Chest Dips', 'Chest', 'bodyweight', true),
  -- Back
  ('Barbell Row', 'Back', 'barbell', true),
  ('Dumbbell Row', 'Back', 'dumbbell', true),
  ('Pull-ups', 'Back', 'bodyweight', true),
  ('Lat Pulldown', 'Back', 'cable', true),
  ('Seated Cable Row', 'Back', 'cable', true),
  ('T-Bar Row', 'Back', 'barbell', true),
  ('Face Pulls', 'Back', 'cable', false),
  -- Shoulders
  ('Overhead Press', 'Shoulders', 'barbell', true),
  ('Dumbbell Shoulder Press', 'Shoulders', 'dumbbell', true),
  ('Lateral Raises', 'Shoulders', 'dumbbell', false),
  ('Front Raises', 'Shoulders', 'dumbbell', false),
  ('Rear Delt Flyes', 'Shoulders', 'dumbbell', false),
  ('Arnold Press', 'Shoulders', 'dumbbell', true),
  ('Upright Row', 'Shoulders', 'barbell', false),
  -- Legs
  ('Squat', 'Legs', 'barbell', true),
  ('Front Squat', 'Legs', 'barbell', true),
  ('Leg Press', 'Legs', 'machine', true),
  ('Romanian Deadlift', 'Legs', 'barbell', true),
  ('Leg Curl', 'Legs', 'machine', false),
  ('Leg Extension', 'Legs', 'machine', false),
  ('Calf Raises', 'Legs', 'machine', false),
  ('Bulgarian Split Squat', 'Legs', 'dumbbell', true),
  ('Hip Thrust', 'Legs', 'barbell', true),
  ('Goblet Squat', 'Legs', 'dumbbell', true),
  -- Arms
  ('Barbell Curl', 'Arms', 'barbell', false),
  ('Dumbbell Curl', 'Arms', 'dumbbell', false),
  ('Hammer Curl', 'Arms', 'dumbbell', false),
  ('Preacher Curl', 'Arms', 'barbell', false),
  ('Tricep Pushdown', 'Arms', 'cable', false),
  ('Skull Crushers', 'Arms', 'barbell', false),
  ('Overhead Tricep Extension', 'Arms', 'dumbbell', false),
  ('Cable Curl', 'Arms', 'cable', false),
  ('Tricep Dips', 'Arms', 'bodyweight', true),
  -- Core
  ('Planks', 'Core', 'bodyweight', false),
  ('Cable Crunches', 'Core', 'cable', false),
  ('Hanging Leg Raises', 'Core', 'bodyweight', false),
  ('Ab Wheel', 'Core', 'bodyweight', false),
  ('Russian Twists', 'Core', 'bodyweight', false),
  -- Compound / Full Body
  ('Deadlift', 'Back', 'barbell', true),
  ('Clean and Press', 'Shoulders', 'barbell', true),
  ('Farmer''s Walk', 'Core', 'dumbbell', true)
ON CONFLICT (name) DO NOTHING;

-- Index for exercise history queries
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise_history
  ON v2_workout_sets (user_id, exercise_name, created_at DESC)
  WHERE is_warmup = false;
```

---

## Components

### New
| Component | Responsibility |
|-----------|---------------|
| `src/components/fitness/ExerciseSearch.vue` | Reusable exercise library search with muscle group filters |
| `src/components/fitness/DayEditor.vue` | Program day editor with drag-to-reorder exercises |
| `src/components/fitness/AIBuilder.vue` | Multi-step AI program generation form |
| `src/components/fitness/PersonalRecords.vue` | PR list display |
| `src/components/fitness/VolumeChart.vue` | Weekly muscle group volume bars |

### Modified
| Component | Changes |
|-----------|---------|
| `ExerciseCard.vue` | Add Swap button, optional RPE dropdown, inline rest timer, skip mechanic. Remove hardcoded WEIGHT_RATIOS. |
| `RestTimer.vue` | Remove fixed positioning, add -30s/+30s adjust buttons, accept onAdjust callback |
| `ProgramCard.vue` | Make days tappable with exercise count + chevron, navigate to DayEditor |
| `FitnessView.vue` | Replace hardcoded templates with AIBuilder, add program history section, fix duplicate focus bug, redesign History tab with 3 sections |
| `WorkoutView.vue` | Pass RPE to logSet, handle exercise swap state, handle skip state |
| `HistoryChart.vue` | Redesign with dual-line chart (weight + est 1RM), stats row underneath |

### Deleted
None — all changes are modifications to existing components or new additions.

## Store Changes

### fitnessStore (modify)

**New state:**
- `archivedPrograms` — array of archived programs (for program history UI)
- `personalRecords` — array of `{ exercise_name, weight, reps, date }` (fetched on History tab mount)
- `exerciseLibrary` — array of all exercises from `v2_exercise_library` (fetched once, cached)

**New actions:**
- `fetchExerciseLibrary()` — fetch all from `v2_exercise_library`, cache in state
- `searchExercises(query, muscleGroup)` — client-side filter on cached `exerciseLibrary`
- `fetchPersonalRecords()` — query max weight per exercise from `v2_workout_sets`
- `fetchWeeklyVolume()` — query this week's sets joined with exercise library for muscle groups
- `createProgramFromAI(days, goal, experience, injuries)` — call AI, parse, create program
- `archiveProgram(programId)` — set `archived_at = now()`, `is_active = false`
- `reactivateProgram(programId)` — deactivate current, reactivate selected
- `fetchArchivedPrograms()` — query programs with `archived_at IS NOT NULL`
- `updateProgramDay(dayId, { name, is_rest_day })` — update day metadata
- `addExerciseToDay(dayId, exercise)` — insert to `v2_program_exercises`
- `removeExerciseFromDay(exerciseId)` — delete from `v2_program_exercises`
- `reorderExercises(dayId, exerciseIds)` — update `sort_order` for all exercises in day
- `updateExercise(exerciseId, { target_sets, target_reps_min, target_reps_max, rest_seconds })` — update exercise programming

**Modified actions:**
- `logSet(setData)` — accept optional `rpe` and `substituted_for` fields
- `hydrate()` — also fetch `exerciseLibrary` (single additional query, cached)

**New computeds:**
- `exerciseNames` — distinct exercise names from exercise library (for dropdowns)

### Streak Calculation Fix

Replace current streak logic in `hydrate()`:

Current: counts consecutive dates with a workout log.

New: counts consecutive *scheduled training days* with a completed workout log. Rest days in the program are skipped (don't break or extend streak). If no program is active, falls back to current behavior (consecutive days).

---

## Router Changes

Add route for program day editor:
```javascript
{
  path: '/fitness/edit/:dayId',
  name: 'EditProgramDay',
  component: () => import('@/components/fitness/DayEditor.vue'),
  meta: { requiresAuth: true }
}
```

---

## Edge Cases

### Exercise not in library
If a user swaps to an exercise not in `v2_exercise_library` (shouldn't happen since search is library-only), the set logs normally with whatever exercise name. Volume chart excludes it with a note.

### AI program generation fails
Show error toast: "Couldn't generate program. Try again or pick a template." Offer hardcoded templates as fallback.

### Empty exercise library
If `v2_exercise_library` is empty (migration not run), ExerciseSearch shows an empty state: "No exercises available. Contact support." This should not happen in practice.

### Swap then swap again
User can swap an already-swapped exercise. The `substituted_for` field always references the *original* programmed exercise, not the intermediate swap.

### Program with no exercises on a day
If user removes all exercises from a day via editor and doesn't mark as rest day, show a warning: "This day has no exercises. Mark as rest day?" but allow saving empty.

### Reactivating archived program
If the archived program's exercises reference exercises that no longer exist in the library, they still work — exercise names are stored as text, not foreign keys to the library.
