# Dashboard Redesign — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Redesign of DashboardView.vue and related dashboard components

## Overview

Redesign the Life OS v2 dashboard from a simple card stack into a structured daily briefing that answers three questions in order: **Who am I? Where do I stand? What should I do?**

The current dashboard has a greeting, gamification pills, XP bar, workout card, meals card, goals card, and a static AI insight. The redesign replaces this with a split-panel layout, on-demand AI briefing, weekly progress rings, goal focus system, and smart action cards.

## Layout (Top to Bottom)

### 1. Greeting + Gamification Header

- Time-based greeting: "Good morning/afternoon/evening, {name}"
- Date display: "Thursday, March 20"
- Streak pill (gradient orange/red): "{N}-day streak"
- Level pill (gradient purple): "Lv {N} - {title}"
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

Three progress rings, each with label and subtext:

**Workouts Ring (green #22c55e)**
- Display: "{completed}/{planned}" (e.g., 3/5)
- Subtext: "{remaining} remaining"
- Below ring row: "Last: {workout name}, {duration} min, +{xp} XP" — the most recent completed workout summary
- Additional: small trend arrow showing weekly volume change vs last week (e.g., "12% vs last week" with up/down arrow, green for increase, red for decrease)
- Data source: `fitnessStore.activeProgram` (count non-rest days for planned), `fitnessStore.recentLogs` (filter to this week for completed), `fitnessStore.weeklyVolume` (compare to previous week)

**Meals Ring (blue #3b82f6)**
- Display: "{percentage}%" of meals logged this week
- Subtext: "{logged}/{total} logged"
- Data source: `mealsStore.weekPlan` (count planned meal slots this week), query `v2_meals` for this week's logged meals
- Calculation: count all planned meal slots (breakfast/lunch/dinner/snack per day) for days elapsed so far, divide logged meals by planned

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
   - Subtext: "{logged}/4 logged today"
   - Status: green filled (all logged), amber (partial), grey (none)
   - Data: `mealsStore.todaysMeals`

3. **Goals** — "Goals"
   - Subtext: "{count} key results due" or "All on track"
   - Status: amber (KRs due), green (all on track)
   - Data: `goalsStore.activeGoals`, filter KRs with approaching deadlines

4. **Schedule** — "Schedule" (NEW)
   - Subtext: "{count} events today, next at {time}" or "No events today"
   - Status: grey (informational)
   - Data: Google Calendar events via `sync-google-calendar` Edge Function or local `v2_calendar_events` table if synced
   - Note: requires checking if calendar sync is set up. If not connected, show "Connect calendar" link instead.

5. **Daily Check-in** — "Daily Check-in"
   - Subtext: "Energy & sleep not logged" or "Energy: {level}, Sleep: {quality}"
   - Status: grey (not done), green filled (done)
   - Data: `userStore.dailyLog`

### 5. Goal Progress Section

Displays focused goals with progress bars and key result snapshots.

**Goal focus system:**
- Users can pin up to 3 goals as "focused" from the Goals page
- Focused goals appear on the dashboard
- Default behavior (no goals pinned): show 3 goals with nearest deadlines
- Each goal card shows: title, progress %, progress bar, and 1-2 key result values inline
- "View all {count} goals" link at bottom navigates to Goals page

**Goal card structure:**
- Header row: goal title (left), progress % (right, purple)
- Progress bar: purple gradient
- KR summary row: up to 2 key results shown as "{label}: {current} / {target}" in small text
- Tap card: navigates to Goals page with that goal expanded

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
   - Shows when: today's daily log not yet submitted
   - Title: "Daily Check-in"
   - Subtitle: "How's your energy? How'd you sleep?"
   - Button: "Log" (grey, opens inline quick form or navigates to a modal)
   - When done: card disappears

**Ordering logic:**
- Incomplete items appear first, ordered by time relevance (morning = breakfast first, afternoon = workout if not done)
- Completed summaries appear at the bottom in muted style
- All-done state: show a simple "You're all caught up" message

## Components to Create/Modify

### New Components
- `src/components/dashboard/WeeklyProgress.vue` — This Week panel with 3 progress rings + last workout + volume trend
- `src/components/dashboard/TodayChecklist.vue` — Today panel with status dot items
- `src/components/dashboard/GoalProgress.vue` — Focused goals section (replaces existing GoalsCard.vue)
- `src/components/dashboard/UpNextCards.vue` — Smart action cards section
- `src/components/dashboard/BriefMeButton.vue` — AI briefing trigger button

### Modified Components
- `src/views/DashboardView.vue` — Complete restructure to new layout
- `src/views/GoalsView.vue` — Add focus/pin toggle UI for goals

### Removed Components
- `src/components/dashboard/WorkoutCard.vue` — replaced by UpNextCards
- `src/components/dashboard/MealsCard.vue` — replaced by UpNextCards
- `src/components/dashboard/GoalsCard.vue` — replaced by GoalProgress
- `src/components/dashboard/AiInsight.vue` — replaced by BriefMeButton

## Store Changes

### goalsStore (modify)
- Add `focusedGoals` computed
- Add `dashboardGoals` computed (focused or nearest-deadline fallback)
- Add `toggleFocus(goalId)` action
- Add `focusedCount` computed for enforcing max 3

### fitnessStore (modify)
- Add `weeklyWorkoutCount` computed: { completed, planned } for current week
- Add `lastCompletedWorkout` computed: most recent finished log with name/duration/XP
- Add `volumeTrend` computed: percentage change vs previous week's volume
- May need `previousWeekVolume` — query `v2_workout_sets` for prior week

### mealsStore (modify)
- Add `weeklyMealProgress` computed: { logged, planned, percentage } for current week
- Add `nextMealToLog` computed: based on time of day and what's already logged today

### userStore (no changes)
- Already has `dailyLog`, `streak`, `level`, `xpProgress` — all needed

## Database Changes

### Migration: add goal focus column
```sql
ALTER TABLE v2_goals ADD COLUMN is_focused boolean DEFAULT false;
```

Single migration, no new tables needed.

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

The `aiStore.buildContext()` already aggregates all this data. The Brief Me button just sends a specific prompt requesting a briefing format.

## Calendar Integration Notes

The Google Calendar sync Edge Functions already exist (`sync-google-calendar`, `google-calendar-auth`). The Today panel's Schedule item needs:
- Check if user has connected Google Calendar (look for calendar credentials in settings or profile)
- If connected: fetch today's events from synced data
- If not connected: show "Connect calendar" as a subtle link
- This is a read-only display — no calendar CRUD from the dashboard

If calendar sync isn't configured for this user yet, the Schedule item gracefully degrades to not showing rather than erroring.

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

### Rest day
- Workout ring still shows weekly count (rest day doesn't count as incomplete)
- Today shows "Rest Day" with rest icon
- Up Next workout card shows rest day message, no action button

### New user (just onboarded)
- Rings at 0, Today items mostly grey
- Goal Progress shows "Set your first goal"
- Up Next shows setup-oriented cards: "Set up a program", "Create a meal plan", "Set your first goal"
