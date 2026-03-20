# Action Checklist — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Replace TodayChecklist + UpNextCards with a single ActionChecklist component. Every item is actionable. Completed items collapse. Progress bar shows momentum.
**Depends on:** GPS Goal System (complete)

## Overview

The dashboard currently has two overlapping components showing today's status: TodayChecklist (passive status dots, no actions) and UpNextCards (action buttons, buried below MacroTracker). This creates duplication and friction — the user sees what they need to do but can't act on it without scrolling.

The fix: merge both into a single ActionChecklist that shows what's left to do with inline action buttons, collapses completed items into a counter, and puts a progress bar at the top for momentum.

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
│ ▌ Supplements — 1/3          ▼          │  ← expandable (teal border)
│   ☐ Creatine                            │
│   ☑ Vitamin D                           │
│   ☐ Fish Oil                            │
│ ▌ Daily Check-in             [Log]      │  ← incomplete item (slate border)
├─────────────────────────────────────────┤
│ 3 completed                      ▶      │  ← collapsed done counter
└─────────────────────────────────────────┘
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
| Workout (pending) | green-500 | "Start" button | Creates workout log via `fitnessStore.startWorkout()`, navigates to `/fitness/workout/:id` |
| Workout (no program) | green-500 | "Setup" button | Navigates to `/fitness` |
| Workout (rest day) | green-500/50 | None (shows "Rest Day") | Static display, not counted in progress |
| Meal (next to log) | blue-500 | "Log" button | Navigates to `/meals` |
| Water (incomplete) | sky-400 | "+1" button | Calls `userStore.addWater()` inline, stays on dashboard |
| Supplements (incomplete) | teal-400 | Expand toggle | Expands inline checklist with toggle circles per supplement |
| Daily check-in | slate-500 | "Log" button | Emits `openCheckin` event for parent to show check-in modal |

**Smart ordering by time of day** (carried over from current UpNextCards):
- Morning: meals first, then workout
- Afternoon: workout first
- Evening: meals first, then check-in

### Completed Items (Collapsed)

Completed items do NOT render as individual rows. Instead, a single collapsed counter row appears at the bottom:

- Text: "N completed" (e.g., "3 completed")
- Tappable to expand and see completed items (same row format but faded with checkmarks)
- When expanded, shows completed items with muted text, green checkmark, and faded border
- Tap again to collapse

### All-Done State

When all items are complete (progress = 6/6 or whatever the total is):

```
┌─────────────────────────────────────────┐
│ Today                        ██████ 6/6 │
├─────────────────────────────────────────┤
│ All done for today                  ✓   │
├─────────────────────────────────────────┤
│ 6 completed                      ▶      │
└─────────────────────────────────────────┘
```

The progress bar is full green. A single "All done for today" message replaces the item list. Completed counter still expandable to review.

### Rest Day Handling

Rest days are a special case — they're not really "completed" by the user, and they're not "incomplete" either. Display rest day as a static row (not counted in the progress total). This means the progress denominator adjusts: if it's a rest day and there are 5 other items, progress shows "X/5" not "X/6".

## Progress Calculation

Total items = count of actionable items (excludes rest day, excludes items that don't apply today like "no program" state).

For each item type:
- **Workout:** completed if `fitnessStore.recentLogs` has a finished log for today
- **Meal:** completed if `mealsStore.todaysMeals.length >= planned meals for today`
- **Water:** completed if `userStore.waterGlasses >= userStore.waterGoal`
- **Supplements:** completed if `supplementStore.supplementStatus.taken >= supplementStore.supplementStatus.due`
- **Check-in:** completed if `userStore.dailyCheckinDone`

## Data Flow

No new stores or database changes. The ActionChecklist reads from the same stores as the current TodayChecklist and UpNextCards:
- `fitnessStore` — workout data, logs
- `mealsStore` — today's meals, next meal to log, weekly plan
- `userStore` — water, check-in, energy, sleep
- `supplementStore` — supplement list, taken status
- `calendarStore` — today's events (not an action item, but could show as context)

## Events Emitted

- `openCheckin` — emitted when check-in "Log" button is tapped, handled by DashboardView to show the check-in modal (same as current UpNextCards behavior)

## DashboardView Changes

### Template Changes
1. Remove the `grid grid-cols-2 gap-2.5` wrapper
2. Place `<WeeklyProgress />` as a standalone full-width component
3. Replace `<TodayChecklist />` and `<UpNextCards />` with `<ActionChecklist @open-checkin="openCheckinModal" />`

### Import Changes
- Remove: `TodayChecklist`, `UpNextCards`
- Add: `ActionChecklist`

## WeeklyProgress Changes

WeeklyProgress currently renders in a half-width column. Moving to full-width means it has more horizontal space. The component itself doesn't need structural changes — the rings and text will just have more room to breathe. No code changes needed; it already uses flex layout that adapts.

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
