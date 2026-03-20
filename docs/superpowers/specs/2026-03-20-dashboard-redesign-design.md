# Dashboard Redesign — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Redesign of DashboardView.vue and related dashboard components

## Overview

Redesign the Life OS v2 dashboard from a simple card stack into a structured daily briefing that answers three questions in order: **Who am I? Where do I stand? What should I do?**

The current dashboard has a greeting, gamification pills, XP bar, workout card, meals card, goals card, and a static AI insight. The redesign replaces this with a split-panel layout, on-demand AI briefing, weekly progress rings, goal focus system, smart action cards, and a gamified avatar companion.

## Layout (Top to Bottom)

### 1. Greeting + Gamification Header + Avatar

- Time-based greeting: template combines "Good " + `getGreeting()` (which returns "Morning"/"Afternoon"/"Evening") + ", {name}". The `getGreeting()` utility is NOT modified — the "Good" prefix is added in the template.
- Date display: "Thursday, March 20"
- Streak pill (gradient orange/red): "{N}-day streak"
- Level pill (gradient purple): "Lv {N} - {title}"
- **Avatar:** Small (40-48px) companion creature in the top-right corner, next to or above the pills. Shows current evolution stage + mood state. Tapping the avatar opens a detail popover/modal showing mood breakdown and evolution progress.
- Uses existing `getGreeting()` from constants and `userStore` data

### 2. XP Progress Bar

- Shows current XP / next level threshold
- Label: "{current level title} -> {next level title}"
- Gradient purple bar
- Uses existing `userStore.xpProgress` computed

### 3. Brief Me Button

- Positioned as the first actionable element on the page
- Subtle gradient background (slate to dark blue) with a gradient icon (blue to purple)
- Primary text: "Brief me on my day"
- Secondary text: "AI summary of your schedule, progress & priorities"
- Tap opens the AI panel (`aiStore.openWithMessage()`) with a pre-built prompt requesting a contextual day briefing
- The briefing prompt should include: today's workout, meals planned, goal status, calendar events, energy/sleep if logged, weekly progress summary
- On-demand only — no auto-generated content on page load

### 4. This Week | Today Split Panel

Two-column grid layout, equal width.

#### Left Column: "This Week"

Three progress rings, each with label and subtext. Rings are rendered inline as SVG within `WeeklyProgress.vue` (not using the shared `ProgressRing.vue` component, which is styled for fitness-specific use). Each ring uses its pillar color directly.

**Workouts Ring (green #22c55e)**
- Display: "{completed}/{planned}" (e.g., 3/5)
- Subtext: "{remaining} remaining"
- Below ring row: "Last: {workout name}, {duration} min, +{xp} XP" — the most recent completed workout summary
- Additional: small trend arrow showing weekly volume change vs last week (e.g., "12% vs last week" with up/down arrow, green for increase, red for decrease)
- Data source: `fitnessStore.weeklyWorkoutCount` (new computed), `fitnessStore.lastCompletedWorkout` (new computed), `fitnessStore.volumeTrend` (new computed)

**Meals Ring (blue #3b82f6)**
- Display: "{percentage}%" of meals logged this week
- Subtext: "{logged}/{total} logged"
- Data source: `mealsStore.weeklyMealProgress` (new computed)
- Calculation: The `weekPlan.plan_data` structure is `{ "monday": { "breakfast": "...", "lunch": "...", "dinner": "...", "snack": "..." }, "tuesday": {...}, ... }`. Count planned meal slots for days from Monday through today (inclusive), divide logged meals count by planned slots count. Example: Wednesday = 3 days elapsed, if each day has 4 meals planned = 12 planned slots.

**Goals Ring (purple #a78bfa)**
- Display: "{average progress}%"
- Subtext: "{count} active"
- Data source: `goalsStore.activeGoals`, `goalsStore.goalProgress()`
- Calculation: average progress across all active goals' key results

#### Right Column: "Today"

Checklist-style items with status indicator dots:

**Status dot colors:**
- Green (#22c55e) outline: ready / available to do
- Green filled: completed
- Amber (#f59e0b) outline: needs attention / partially done
- Grey (#64748b) outline: not started / not yet relevant

**Items:**

1. **Workout** — "{workout name}" / "Rest Day" / "Completed: {name}"
   - Subtext: "{focus} - {exercise count} exercises" or "Duration: {min} min, +{xp} XP"
   - Status: green outline (ready), green filled (done), or special rest day state
   - Data: `fitnessStore.todaysWorkout`, `fitnessStore.recentLogs`

2. **Meals** — "Meals"
   - Subtext: "{logged}/{planned} logged today" — planned count comes from the day's `plan_data` (not hardcoded to 4), matching how `MealsCard.vue` already works
   - Status: green filled (all logged), amber (partial), grey (none)
   - Data: `mealsStore.todaysMeals`, `mealsStore.weekPlan` (for today's planned count)

3. **Goals** — "Goals"
   - Subtext: "{count} key results due" or "All on track"
   - Status: amber (KRs due), green (all on track)
   - Data: `goalsStore.activeGoals`, filter KRs with approaching deadlines

4. **Schedule** — "Schedule"
   - Subtext: "{count} events today, next at {time}" or "No events today"
   - Status: grey (informational)
   - Data: `calendarStore.todaysEvents` (new store — see Calendar Integration Notes)
   - If calendar not connected: show "Connect calendar" link instead of the checklist item

5. **Daily Check-in** — "Daily Check-in"
   - Subtext: "Energy & sleep not logged" or "Energy: {level}, Sleep: {quality}"
   - Status: grey (not done), green filled (done)
   - Data: `userStore.energy`, `userStore.sleepQuality`, `userStore.sleepHours` — check-in is considered done when `energy` is not null for today's date
   - Note: `userStore` does NOT have a `dailyLog` property. The individual refs (`energy`, `sleepQuality`, `sleepHours`) are populated by `hydrate()` from the `v2_daily_logs` table.

6. **Hydration** — "Water"
   - Subtext: "{count}/8 glasses" (or user-configured goal)
   - Status: green filled (goal met), amber (in progress, >0), grey (0 logged)
   - Data: `userStore.waterGlasses` — integer from `v2_daily_logs.water_glasses` column
   - Always visible (not gated by check-in status)

### 5. Goal Progress Section

Displays focused goals with progress bars and key result snapshots.

**Goal focus system:**
- Users can pin up to 3 goals as "focused" from the Goals page
- Focused goals appear on the dashboard
- Default behavior (no goals pinned): show 3 goals with nearest `target_date`
- Each goal card shows: title, progress %, progress bar, and 1-2 key result values inline
- "View all {count} goals" link at bottom navigates to Goals page

**Goal card structure:**
- Header row: goal title (left), progress % (right, purple)
- Progress bar: purple gradient
- KR summary row: up to 2 key results shown as "{label}: {current} / {target}" in small text
- Tap card: navigates to Goals page via `router.push({ path: '/goals', query: { expand: goalId } })`. GoalsView reads `route.query.expand` on mount and auto-expands that goal.

**Data changes required:**
- Add `is_focused` boolean column to `v2_goals` table (default false)
- Add constraint: max 3 focused goals per user (enforced in application logic)
- Update `goalsStore` with:
  - `focusedGoals` computed: goals where `is_focused === true`, limited to 3
  - `dashboardGoals` computed: `focusedGoals` if any exist, else top 3 by nearest `target_date`
  - `toggleFocus(goalId)` action: toggle `is_focused`, enforce max 3

### 6. Up Next — Action Cards

Smart, context-aware action cards with direct action buttons. Cards appear/disappear based on current state.

**Card structure:**
- Left border color-coded by pillar
- Title + subtitle on left
- Action button on right

**Cards (in priority order):**

1. **Workout card** (border: green)
   - Shows when: active program exists AND today is a training day AND workout not completed
   - Title: "{workout name} — {focus}"
   - Subtitle: "{exercise count} exercises - ~{estimated duration} min - {xp} XP"
   - Button: "Start" (green, navigates to workout view)
   - When completed: flips to summary state: "Completed: {name}, {duration} min, +{xp} XP" with green checkmark instead of button
   - Rest day: shows "Rest Day — Recovery" with a subtle rest icon, no action button
   - No program: shows "Set up a program" with link to fitness page

2. **Meal card** (border: blue)
   - Shows when: meal plan exists AND not all meals logged
   - Title: "Log {next meal type}" (breakfast/lunch/dinner/snack based on time of day)
   - Subtitle: "Planned: {meal description from plan}" or "No plan for this meal"
   - Button: "Log" (blue, navigates to meals page)
   - When all logged: card disappears

3. **Daily Check-in card** (border: grey)
   - Shows when: today's daily log not yet submitted (i.e., `userStore.energy` is null)
   - Title: "Daily Check-in"
   - Subtitle: "How's your energy? How'd you sleep?"
   - Button: "Log" (grey, opens inline quick form or navigates to a modal)
   - When done: card disappears

4. **Hydration card** (border: cyan/sky)
   - Always visible (persistent throughout the day)
   - Title: "Water — {count}/8 glasses"
   - Subtitle: "{remaining} more to hit your goal" or "Goal reached!"
   - Button: "+1" (sky blue, inline action — does NOT navigate, just increments counter)
   - Tapping "+1" immediately increments `userStore.waterGlasses` and upserts to `v2_daily_logs`
   - When goal met: card stays but button changes to a checkmark, title shows "Goal reached"

**Ordering logic:**
- Time-of-day thresholds follow `getGreeting()` boundaries: before 12:00 = morning, 12:00-17:00 = afternoon, after 17:00 = evening
- Morning: breakfast meal card first, then workout, then check-in
- Afternoon: workout first (if not done), then lunch/dinner meal card
- Evening: dinner meal card, then check-in
- Completed summaries appear at the bottom in muted style
- All-done state: show a simple "You're all caught up" message

## Avatar Companion System

A Tamagotchi-style companion creature that lives in the dashboard header. Its evolution stage is tied to the user's level, and its mood reflects daily activity — making the gamification loop visible and emotionally engaging.

### Evolution Stages (5)

| Stage | Levels | Name | Visual Description |
|-------|--------|------|--------------------|
| 1 | 1-2 (Beginner, Focused) | Hatchling | Small, simple creature — just hatched |
| 2 | 3-4 (Disciplined, Relentless) | Juvenile | Bigger, more defined features |
| 3 | 5-6 (Machine, Legend) | Warrior | Strong, battle-ready appearance |
| 4 | 7-8 (Transcendent, Architect) | Champion | Powerful, armored/glowing |
| 5 | 9-11 (Sovereign, Ascended, Eternal) | Mythic | Final form, legendary appearance |

Evolution stage is derived from `userStore.level` — no separate tracking needed.

### Mood States (4)

| Mood | Condition | Visual |
|------|-----------|--------|
| Happy | All daily tasks done (workout + meals + check-in) | Energetic, glowing, bouncing |
| Neutral | Some tasks done | Calm, standing normally |
| Tired | Skipped workout or most meals not logged | Droopy, yawning |
| Sad | Streak broken (streak = 0 after being > 0) | Dejected, grey tint |

**Mood calculation logic:**
- Start with mood = "neutral"
- If streak === 0 AND user had a streak before (check `v2_profiles.streak`): mood = "sad"
- Else count today's completions:
  - Workout done (or rest day): +1
  - Meals: all planned meals logged: +1
  - Daily check-in done: +1
  - If 3/3: mood = "happy"
  - If 0/3: mood = "tired"
  - Else: mood = "neutral"
- Streak broken overrides all other moods to "sad"

### Avatar Display

- **Dashboard header:** 40-48px avatar in top-right corner, next to streak/level pills
- **Tap interaction:** Opens a small popover or bottom sheet showing:
  - Larger avatar view (120px)
  - Current stage name and level
  - Mood status with breakdown (what's done/not done today)
  - XP to next evolution stage
- **Animation:** Subtle idle animation (breathing/bobbing). Mood-specific micro-animations (happy = bounce, tired = sway, sad = droop)

### Art Assets

- 5 stages x 4 moods = 20 SVG variations
- Initial implementation: use simple geometric SVG illustrations (circles, shapes) as placeholders
- Each avatar state is a standalone SVG component or sprite reference
- File structure: `src/assets/avatar/stage-{1-5}-{happy|neutral|tired|sad}.svg`
- Alternative: single `Avatar.vue` component that renders procedurally based on stage + mood using SVG primitives (avoids 20 separate files)

### Data Model

No new database tables needed. Avatar state is fully derived:
- **Evolution stage:** computed from `userStore.level` (pure function, no storage)
- **Mood:** computed from today's activity state (workout done, meals logged, check-in done, streak status)

Add to `userStore`:
- `avatarStage` computed: maps level to stage 1-5
- `avatarMood` computed: calculates mood from daily state

## Components to Create/Modify

### New Components
- `src/components/dashboard/WeeklyProgress.vue` — This Week panel with 3 inline SVG progress rings + last workout + volume trend
- `src/components/dashboard/TodayChecklist.vue` — Today panel with status dot items
- `src/components/dashboard/GoalProgress.vue` — Focused goals section (replaces existing GoalsCard.vue)
- `src/components/dashboard/UpNextCards.vue` — Smart action cards section
- `src/components/dashboard/BriefMeButton.vue` — AI briefing trigger button
- `src/components/dashboard/AvatarCompanion.vue` — Avatar display in header + tap interaction popover
- `src/components/dashboard/AvatarDetail.vue` — Expanded avatar view (popover/bottom sheet content)

### Modified Components
- `src/views/DashboardView.vue` — Complete restructure to new layout
- `src/views/GoalsView.vue` — Add focus/pin toggle UI for goals + read `route.query.expand` on mount

### Removed Components
- `src/components/dashboard/WorkoutCard.vue` — replaced by UpNextCards
- `src/components/dashboard/MealsCard.vue` — replaced by UpNextCards
- `src/components/dashboard/GoalsCard.vue` — replaced by GoalProgress
- `src/components/dashboard/AiInsight.vue` — replaced by BriefMeButton

## Store Changes

### userStore (modify)
- Add `waterGlasses` ref: integer, populated from `v2_daily_logs.water_glasses` during `hydrate()`
- Add `addWater()` action: increments `waterGlasses` by 1 and upserts to `v2_daily_logs`
- Add `avatarStage` computed: maps `level` to stage 1-5 using thresholds [1-2, 3-4, 5-6, 7-8, 9-11]
- Add `avatarMood` computed: derives mood from daily activity state (workout done, meals logged, check-in done, streak). Needs access to `fitnessStore` and `mealsStore` — use Pinia's `useStore()` within the computed or accept params.
- Add `dailyCheckinDone` computed: returns `true` if `energy` is not null (indicates today's log exists)
- Note: `userStore` does NOT have a `dailyLog` property. Individual refs `energy`, `sleepQuality`, `sleepHours`, `waterGlasses` are populated by `hydrate()`.

### goalsStore (modify)
- Add `focusedGoals` computed
- Add `dashboardGoals` computed (focused or nearest-deadline fallback)
- Add `toggleFocus(goalId)` action
- Add `focusedCount` computed for enforcing max 3

### fitnessStore (modify)
- Add `weeklyWorkoutCount` computed: `{ completed, planned }` for current week. `planned` = count of non-rest program days. `completed` = count of `recentLogs` entries with `finished_at` within this week (Monday-Sunday).
- Add `lastCompletedWorkout` computed: most recent entry in `recentLogs` with `finished_at` not null. Returns `{ name, duration, xp }`.
- Add `previousWeekVolume` state: fetched during `hydrate()` by querying `v2_workout_sets` joined with `v2_workout_logs` where `started_at` falls within the previous week (Monday-Sunday). Sum of `(weight * reps)` for all sets.
- Add `volumeTrend` computed: `{ percentage: number, direction: 'up' | 'down' | 'flat' }`. Calculated as `((weeklyVolume - previousWeekVolume) / previousWeekVolume) * 100`. If `previousWeekVolume` is 0, direction = 'flat'.

### mealsStore (modify)
- Add `weeklyMealProgress` computed: `{ logged: number, planned: number, percentage: number }` for current week. Iterates `weekPlan.plan_data` keys for days Monday through today, counts non-empty meal slots as planned. Counts meals in `recentMeals` for this week as logged.
- Add `nextMealToLog` computed: based on current hour and what's already in `todaysMeals`. Uses `getGreeting()` time boundaries (before 12 = breakfast, 12-17 = lunch, after 17 = dinner). Returns `{ type, planned }` where `planned` is the description from today's `plan_data`.

### calendarStore (new)
- New store: `src/stores/calendar.js`
- State: `events` (array), `connected` (boolean)
- `hydrate()`: check if user has Google Calendar connected (look for credentials in `v2_profiles.preferences` or a settings field). If connected, query `v2_calendar_events` filtered to today's date. If not connected, set `connected = false`.
- `todaysEvents` computed: sorted by start time
- `nextEvent` computed: first event with start time after now
- Note: if `v2_calendar_events` table doesn't exist yet, the migration section below covers creating it. If the table exists from v1 schema, verify column structure.

## Database Changes

### Migration: goal focus + calendar events
```sql
-- Add goal focus column
ALTER TABLE v2_goals ADD COLUMN is_focused boolean DEFAULT false;

-- Add hydration tracking to daily logs
ALTER TABLE v2_daily_logs ADD COLUMN water_glasses integer DEFAULT 0;

-- Calendar events table (if not already present)
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

## Brief Me — AI Prompt

When the user taps Brief Me, send to `ai-assistant` with a structured prompt:

```
Give me a concise morning briefing. Cover:
1. Today's schedule: {calendar events}
2. Workout: {today's workout or rest day}
3. Meals: {what's planned today}
4. Goals: {focused goals with progress}
5. Weekly progress: {workouts done/planned, meals %, goals %}
6. Energy/sleep: {if logged, factor it in}

Keep it to 3-4 sentences. Be direct, not motivational. Tell me what I need to know.
```

The `aiStore.buildContext()` already aggregates most of this data. The Brief Me button sends a specific prompt requesting a briefing format.

## Calendar Integration Notes

The Google Calendar sync Edge Functions already exist (`sync-google-calendar`, `google-calendar-auth`). The Today panel's Schedule item needs:
- `calendarStore.hydrate()` checks if the user has connected Google Calendar
- If connected: fetch today's events from `v2_calendar_events`
- If not connected: `calendarStore.connected = false`, TodayChecklist shows "Connect calendar" link
- This is a read-only display — no calendar CRUD from the dashboard

If calendar sync isn't configured for this user yet, the Schedule item gracefully degrades to not showing rather than erroring.

## Loading State

The dashboard calls `hydrate()` on mount for all stores in parallel. While loading:
- Show a skeleton/shimmer state for each section independently
- Sections render progressively as their data arrives (not all-or-nothing)
- The greeting header renders immediately (no data dependency beyond cached user name)
- Avatar renders with neutral mood during loading (safe default)
- Brief Me button renders immediately (no data dependency)
- Split panel, Goal Progress, and Up Next show skeleton placeholders until their respective stores resolve

Implementation: a `loading` ref in `DashboardView.vue` that tracks `Promise.all()`, but individual sections can use their store's own loading state for progressive rendering.

## States and Edge Cases

### Empty states
- No active program: Workout ring shows 0/0, Today shows "Set up a program" link
- No meal plan: Meals ring shows "No plan", Today shows "Create a plan" link
- No goals: Goal Progress section shows "Set your first goal" CTA
- No calendar: Schedule item hidden or shows "Connect calendar"
- No daily log: Check-in shows as grey/not started

### All-done state
- When all Up Next items are completed: show "You're all caught up" message
- Completed items can optionally show as muted summary cards below
- Avatar mood = "happy"

### Rest day
- Workout ring still shows weekly count (rest day doesn't count as incomplete)
- Today shows "Rest Day" with rest icon
- Up Next workout card shows rest day message, no action button
- Rest day counts as "workout done" for avatar mood calculation

### New user (just onboarded)
- Rings at 0, Today items mostly grey
- Goal Progress shows "Set your first goal"
- Up Next shows setup-oriented cards: "Set up a program", "Create a meal plan", "Set your first goal"
- Avatar: Stage 1 (Hatchling), Neutral mood

### Streak broken
- Avatar mood = "sad" (overrides all other mood calculations)
- Streak pill still shows "0-day streak" or hides if 0
