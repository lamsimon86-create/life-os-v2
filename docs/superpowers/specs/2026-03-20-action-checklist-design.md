# Action Checklist — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Replace TodayChecklist + UpNextCards with a single ActionChecklist component. Every item is actionable. Completed items collapse. Progress bar shows momentum.
**Depends on:** GPS Goal System (complete)

## Overview

The dashboard currently has two overlapping components showing today's status: TodayChecklist (passive status dots, no actions) and UpNextCards (action buttons, buried below MacroTracker). This creates duplication and friction — the user sees what they need to do but can't act on it without scrolling.

The fix: merge both into a single ActionChecklist that shows what's left to do with inline action buttons, collapses completed items into a counter, and puts a progress bar at the top for momentum.

## Intentionally Dropped Rows

Two rows from the old TodayChecklist are **not** carried into ActionChecklist:

- **Goals row:** Replaced by the Destination Strip (section 3 on the dashboard). The Destination Strip shows goal progress, countdown, and key results — richer than the old status dot. No need to duplicate.
- **Schedule row:** Calendar events are passive context, not actionable items. They don't belong in an action checklist. The Brief Me button already incorporates schedule data into its AI briefing, and WeeklyProgress could surface schedule context in a future iteration if needed.

## Dashboard Layout (Updated)

### Section Order
1. Greeting + Avatar
2. XP bar
3. Destination Strip
4. Brief Me
5. **WeeklyProgress** (full-width, standalone — no longer in a 2-col grid)
6. **ActionChecklist** (full-width — replaces TodayChecklist + UpNextCards)
7. MacroTracker (conditional on goal trackers)
8. Insights Carousel

### What Gets Removed
- `src/components/dashboard/TodayChecklist.vue` — deleted
- `src/components/dashboard/UpNextCards.vue` — deleted
- The `grid grid-cols-2 gap-2.5` wrapper in DashboardView that held WeeklyProgress + TodayChecklist

## ActionChecklist Component

### File
`src/components/dashboard/ActionChecklist.vue`

### Anatomy

```
┌─────────────────────────────────────────┐
│ Today                        ████░░ 4/6 │  ← header + progress bar
├─────────────────────────────────────────┤
│ ▌ Push Day — Chest & Tris    [Start]    │  ← incomplete item (green border)
│ ▌ Log Lunch                  [Log]      │  ← incomplete item (blue border)
│ ▌ Water — 6/10 glasses       [+1]       │  ← incomplete item (sky border)
│ ▌ Supplements — 1/3          [▼]        │  ← collapsed by default (teal border)
│ ▌ Daily Check-in             [Log]      │  ← incomplete item (slate border)
├─────────────────────────────────────────┤
│ 3 completed                      ▶      │  ← collapsed done counter
└─────────────────────────────────────────┘

When supplements row is tapped/expanded:
│ ▌ Supplements — 1/3          [▲]        │
│   ☐ Creatine                            │
│   ☑ Vitamin D                           │
│   ☐ Fish Oil                            │
```

### Header
- Label: "Today" (left-aligned, uppercase, small text — same style as existing section headers)
- Progress bar: thin horizontal bar showing completion fraction, colored gradient (slate-700 bg, green-500 fill)
- Fraction: "4/6" right-aligned next to the bar

### Incomplete Items

Each row:
- Colored left border (3px) matching the category
- Title + subtitle text
- Action button on the right

**Item types and their actions:**

| Item | Border Color | Action | Behavior |
|------|-------------|--------|----------|
| Workout (pending) | green-500 | "Start" button | Calls `fitnessStore.startWorkout(workout.id)` where `workout = fitnessStore.todaysWorkout`, then navigates to `/fitness/workout/${logId}` |
| Workout (no program) | green-500 | "Setup" button | Navigates to `/fitness`. Rendered as a context row (not counted in progress denominator). Appears at the top of the list regardless of time-of-day ordering. |
| Workout (rest day) | green-500/50 | None (shows "Rest Day — Recovery") | Static display row. Not counted in progress denominator. Appears at top. |
| Meal (next to log) | blue-500 | "Log" button | Navigates to `/meals`. Uses `mealsStore.nextMealToLog` to get the next unlogged meal. Title: "Log {MealType}" (e.g., "Log Lunch"). Subtitle: planned meal name if available, else "No plan for this meal". |
| Water (incomplete) | sky-400 | "+1" button | Calls `userStore.addWater()` inline, stays on dashboard |
| Supplements (incomplete) | teal-400 | Chevron toggle | **Default state: collapsed.** Shows "Supplements — 2/3" with a chevron. Tapping the row or chevron expands to reveal individual supplement toggles. Each toggle calls `supplementStore.toggleSupplement(supp.id)`. Supplement list comes from `supplementStore.todaysSupplements`. Taken status via `supplementStore.isTaken(supp.id)`. |
| Daily check-in | slate-500 | "Log" button | Emits `openCheckin` event for parent to show check-in modal |

**Meal completion logic:** A meal item appears when `mealsStore.nextMealToLog` returns a value (not null). When all planned meals are logged, `nextMealToLog` returns null, and the meal row moves to completed. Planned meal count for today is derived from `mealsStore.weekPlan?.plan_data?.[todayName]` (counting non-null entries), falling back to 4 if no plan exists. Use the `dayNames` array pattern from the existing TodayChecklist.

**Smart ordering by time of day** (uses `getGreeting()` from `@/lib/constants` which returns 'Morning', 'Afternoon', or 'Evening'):
- Morning: meals first, then workout
- Afternoon: workout first
- Evening: meals first, then check-in

Non-counted rows (rest day, no program) always render at the top, before the ordered actionable items.

### Completed Items (Collapsed)

Completed items do NOT render as individual rows. Instead, a single collapsed counter row appears at the bottom:

- Text: "N completed" (e.g., "3 completed")
- Tappable to expand and see completed items (same row format but faded with checkmarks)
- When expanded, shows completed items with muted text (`text-slate-500`), green checkmark icon, and faded border (`border-{color}/50`)
- Tap again to collapse

Completed item details:
- **Workout done:** Title: workout name. Subtitle: "{duration}min, +{xp} XP". Data from `fitnessStore.recentLogs` (today's finished log).
- **Meals done:** Title: "Meals". Subtitle: "{logged}/{planned} logged today".
- **Water done:** Title: "Water — {glasses}/{goal} glasses". Subtitle: "Goal reached!".
- **Supplements done:** Title: "Supplements — {taken}/{due}". Subtitle: "All taken".
- **Check-in done:** Title: "Daily Check-in". Subtitle: "Energy: {energy}, Sleep: {sleepQuality}".

### All-Done State

When all actionable items are complete:

```
┌─────────────────────────────────────────┐
│ Today                        ██████ 5/5 │
├─────────────────────────────────────────┤
│ ▌ Rest Day — Recovery                   │  ← non-counted row still shows
│ All done for today                  ✓   │
├─────────────────────────────────────────┤
│ 5 completed                      ▶      │
└─────────────────────────────────────────┘
```

Non-counted rows (rest day, no program) still render above the "All done" message. The progress bar is full green. Completed counter still expandable.

### Rest Day Handling

Rest days are not counted in the progress denominator. If it's a rest day with 5 other actionable items, progress shows "X/5". The rest day row renders at the top of the list as a static, non-actionable display row with faded green border.

## Progress Calculation

Total items = count of actionable items only. Excludes:
- Rest day row
- "No program" row
- Supplement row when `supplementStore.supplementStatus.due === 0`

Completed count:
- **Workout:** `fitnessStore.recentLogs.find(l => l.finished_at && l.started_at?.split('T')[0] === today)` exists
- **Meal:** `mealsStore.nextMealToLog` is null (all planned meals logged)
- **Water:** `userStore.waterGlasses >= userStore.waterGoal`
- **Supplements:** `supplementStore.supplementStatus.taken >= supplementStore.supplementStatus.due` (only when `due > 0`)
- **Check-in:** `userStore.dailyCheckinDone`

## Data Flow

No new stores or database changes. The ActionChecklist reads from existing stores:
- `fitnessStore` — `todaysWorkout`, `activeProgram`, `recentLogs`, `startWorkout(id)`
- `mealsStore` — `nextMealToLog`, `todaysMeals`, `weekPlan`, `weeklyMealProgress`
- `userStore` — `waterGlasses`, `waterGoal`, `addWater()`, `dailyCheckinDone`, `energy`, `sleepQuality`
- `supplementStore` — `todaysSupplements`, `supplementStatus`, `isTaken(id)`, `toggleSupplement(id)`

Note: `goalsStore` is NOT used by ActionChecklist. Goal status is handled by the Destination Strip. `calendarStore` is NOT used — schedule context is handled by Brief Me.

## Events Emitted

- `openCheckin` — emitted when check-in "Log" button is tapped, handled by DashboardView to show the check-in modal (same as current UpNextCards behavior)

## DashboardView Changes

### Template Changes
1. Remove the `grid grid-cols-2 gap-2.5` wrapper
2. Place `<WeeklyProgress />` as a standalone full-width component
3. Replace `<TodayChecklist />` and `<UpNextCards @open-checkin="openCheckinModal" />` with `<ActionChecklist @open-checkin="openCheckinModal" />`

### Import Changes
- Remove: `TodayChecklist`, `UpNextCards`
- Add: `ActionChecklist`

## WeeklyProgress Changes

WeeklyProgress moves from half-width to full-width. The component uses flex layout with fixed-size SVG rings (36x36px) and will adapt naturally. The developer should visually verify the layout at full width to ensure rings don't look oddly small — if so, consider making the rings layout horizontal (3 rings in a row) instead of the current vertical stack, to better use the wider space. This is a visual polish decision, not a structural change.

## Files

### New
| File | Responsibility |
|------|---------------|
| `src/components/dashboard/ActionChecklist.vue` | Merged today checklist + up next actions |

### Modified
| File | Changes |
|------|---------|
| `src/views/DashboardView.vue` | Remove grid, swap components, update imports |

### Deleted
| File | Replaced By |
|------|------------|
| `src/components/dashboard/TodayChecklist.vue` | ActionChecklist |
| `src/components/dashboard/UpNextCards.vue` | ActionChecklist |
