# GPS Goal System — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Replace the current goal system with a GPS-inspired model where long-term goals drive the entire dashboard. AI refines goals, prescribes daily trackers, and the dashboard configures itself around what the user needs to hit their targets.
**Depends on:** Dashboard Phase 1 + Phase 2 (complete)

## Overview

The dashboard currently has independent sections (macro tracker, water, supplements, goals) that the user configures manually. This redesign connects them: the user sets a long-term goal, AI breaks it down into daily targets, and the dashboard becomes a GPS — showing the destination at the top and turn-by-turn daily actions below.

## Goal Categories

3 categories, 1 goal per category max. User can skip categories.

| Category | What it covers | Example goals |
|----------|---------------|---------------|
| **Body** | Aesthetic, composition, physique | "Get 6 pack abs", "Lose 15 lbs", "Build bigger arms" |
| **Nutrition** | Eating habits, dietary consistency | "Hit 180g protein daily", "Eat clean 5 days/week", "Meal prep consistently" |
| **Performance** | Strength, cardio, athletic milestones | "Bench 225 lbs", "Run 5K under 25 min", "Do 10 pull-ups" |

## Goal Creation Flow

### Step 1: User states goal in plain language
User types what they want: "I want to get shredded by summer"

### Step 2: AI refines into SMART goal
AI uses the user's current stats (weight, body fat if available, fitness level, dietary preferences) and their difficulty setting (Easy/Medium/Hard) to generate:

- **Measurable target:** "Body fat 20% → 12%"
- **Realistic deadline:** Based on difficulty:
  - Easy: conservative timeline, gentler daily targets
  - Medium: balanced timeline and intensity
  - Hard: aggressive timeline, demanding daily targets
- **Key results:** 2-4 trackable milestones (e.g., "Body fat to 16% by month 2", "Maintain workout 5x/week")

### Step 3: AI prescribes daily trackers
Based on the goal, AI recommends which dashboard trackers the user needs:

Example for "get shredded":
> "To hit this goal, I recommend tracking:
> - Protein: 180g/day (builds muscle while cutting)
> - Calories: 2,200/day (500 cal deficit)
> - Water: 10 glasses/day (supports fat metabolism)
> - Supplements: Creatine, Vitamin D, Fish Oil
> - Workout frequency: 5x/week
>
> Want to adjust anything?"

Each prescribed tracker includes:
- **What to track** (protein, calories, water, specific supplements, workout frequency)
- **Daily target** (180g, 2200 cal, 10 glasses)
- **Why** (brief AI reasoning connecting it to the goal)

### Step 4: User reviews and approves
User can:
- Accept all recommendations
- Adjust targets (change 180g protein to 160g)
- Remove trackers they don't want
- Add trackers AI didn't suggest

### Step 5: Dashboard configures
Approved trackers appear on the dashboard. The goal appears in the Destination Strip with its countdown.

### AI Prompt for Goal Refinement

Sent to `ai-assistant` Edge Function:

```
The user wants to set a fitness goal. Here's their context:

Goal (their words): "{user_input}"
Category: {body|nutrition|performance}
Current stats: Weight {weight}, Age {age}, Difficulty: {easy|medium|hard}
Fitness experience: {preferences.fitness_experience}
Current program: {active program name and frequency, or "none"}
Dietary preferences: {preferences.food_preferences}

Respond with JSON:
{
  "refined_title": "Short measurable title",
  "target_description": "What success looks like",
  "deadline_days": number (realistic based on difficulty),
  "key_results": [
    { "title": "...", "target_value": number, "unit": "...", "current_value": number }
  ],
  "prescribed_trackers": [
    { "type": "protein", "daily_target": 180, "unit": "g", "reason": "..." },
    { "type": "calories", "daily_target": 2200, "unit": "kcal", "reason": "..." },
    { "type": "water", "daily_target": 10, "unit": "glasses", "reason": "..." },
    { "type": "supplement", "name": "Creatine", "frequency": "daily", "reason": "..." },
    { "type": "workout_frequency", "daily_target": 5, "unit": "days/week", "reason": "..." }
  ]
}
```

### Tracker types
| Type | What it controls on dashboard |
|------|-------------------------------|
| `protein` | MacroTracker protein bar + target |
| `calories` | MacroTracker calorie bar + target |
| `water` | Water daily goal + Up Next card |
| `supplement` | Adds supplement to checklist |
| `workout_frequency` | Weekly workout target in This Week ring |
| `body_weight` | Monthly weigh-in prompt in Insights carousel |
| `body_fat` | Body fat tracking (future, manual entry) |

## Dashboard Layout (GPS Model)

### Destination Strip (NEW — replaces Goal Progress)

Compact, always-visible bar at the top of the dashboard (below XP bar, above Brief Me). Shows 1-3 long-term goal cards in a horizontal row.

Each card:
- Category icon (body/nutrition/performance)
- Goal title (truncated): "Get shredded"
- Progress: "35%"
- Countdown: "67 days"
- Thin progress bar

The strip is NOT interactive beyond tapping to view goal details. It's glanceable — you see your destinations at all times.

**Empty state:** "Set your first goal" CTA that navigates to goal creation.

### Updated Section Order

1. Header + avatar
2. XP bar
3. **Destination Strip** (long-term goals with countdowns)
4. Brief Me
5. This Week | Today split
6. Macro tracker (if prescribed)
7. Up Next (prescribed daily actions)
8. Insights carousel

### What shows vs. what doesn't

Dashboard sections appear/disappear based on prescribed trackers:
- **MacroTracker:** only shows if protein or calories are prescribed
- **Water card in Up Next:** only if water is prescribed
- **Supplement card in Up Next:** only if supplements are prescribed
- **Workout card in Up Next:** always shows if user has an active program
- **Body composition in Insights:** only if body_weight tracker is prescribed
- **This Week rings:** workouts ring always shows, meals ring shows if nutrition trackers prescribed, goals ring shows active goal count

If no goals are set and no trackers prescribed, the dashboard shows:
- Header + avatar + XP bar
- Destination Strip with "Set your first goal" CTA
- Brief Me button
- Basic This Week | Today split (workout only)

### Brief Me Integration

The Brief Me prompt is enhanced with goal context:
```
"You're 67 days from your 'Get Shredded' goal. This week: 3/5 workouts done, averaging 175g protein (target 180g), calorie average 2,150 (target 2,200). You're on track. Today: Push Day, hit your protein target, drink 10 glasses."
```

## Goal Completion

When a goal's target is hit OR deadline arrives:

1. **Target hit before deadline:** Celebration screen (confetti, XP bonus, level-up check). AI generates a congratulatory message with stats summary.
2. **Deadline arrives, target not hit:** AI checks in — "You're at 14% body fat, goal was 12%. Want to extend 30 days or adjust the target?"
3. **After completion/resolution:** AI suggests a new goal for that category. Dashboard reconfigures — old trackers removed, new ones prescribed if user sets a new goal.

### XP Awards
- Goal completed on time: 500 XP × streak multiplier
- Goal completed early: 750 XP × streak multiplier
- Key result milestone hit: 100 XP × streak multiplier

## Onboarding Update

The existing 6-step onboarding gets a goal-setting step (can be step 4 or 5, after profile basics):

1. User picks a category (or all 3)
2. Types their goal in plain language
3. AI refines and presents the SMART version + prescribed trackers
4. User approves
5. Dashboard is ready with everything configured

Users can skip goal-setting during onboarding and do it later.

## Data Model

### Modify `v2_goals` table

Add columns:
```sql
ALTER TABLE v2_goals ADD COLUMN category text;  -- 'body', 'nutrition', 'performance'
ALTER TABLE v2_goals ADD COLUMN original_text text;  -- user's raw input
ALTER TABLE v2_goals ADD COLUMN difficulty text;  -- 'easy', 'medium', 'hard' (snapshot at creation)
ALTER TABLE v2_goals ADD COLUMN ai_refined boolean DEFAULT false;
```

### New `v2_goal_trackers` table

Links goals to prescribed dashboard trackers:
```sql
CREATE TABLE v2_goal_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id uuid REFERENCES v2_goals(id) ON DELETE CASCADE NOT NULL,
  tracker_type text NOT NULL,  -- 'protein', 'calories', 'water', 'supplement', 'workout_frequency', 'body_weight'
  daily_target numeric,
  unit text,
  supplement_name text,  -- only for type='supplement'
  reason text,  -- AI's reasoning
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE v2_goal_trackers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goal trackers" ON v2_goal_trackers FOR ALL USING (auth.uid() = user_id);
```

### Unique constraint
One active goal per category per user:
```sql
CREATE UNIQUE INDEX idx_v2_goals_active_category
  ON v2_goals (user_id, category)
  WHERE status = 'active';
```

## Store Changes

### goalsStore (modify)
- Add `goalsByCategory` computed: `{ body: goal|null, nutrition: goal|null, performance: goal|null }`
- Add `destinationGoals` computed: active goals for the Destination Strip
- Add `createGoalWithAI(category, userText)`: sends to AI, gets refinement, returns for user approval
- Add `approveGoal(refinedGoal, prescribedTrackers)`: saves goal + key results + trackers, triggers dashboard reconfiguration
- Add `completeGoal(goalId)`: mark complete, award XP, prompt for next goal
- Add `goalCountdown(goal)` computed helper: returns `{ days, label }` ("67 days" or "2 months")

### New: trackerStore (or extend goalsStore)
- `activeTrackers` computed: all active trackers from `v2_goal_trackers` for current user
- `getTarget(type)`: returns the daily target for a tracker type (e.g., protein → 180)
- Used by MacroTracker, UpNextCards, TodayChecklist, WeeklyProgress to determine what to show and what targets to use

### mealsStore (modify)
- `proteinTarget` and `calorieTarget` now read from `trackerStore.getTarget('protein')` and `trackerStore.getTarget('calories')` instead of hardcoded preferences. Falls back to preferences if no tracker prescribed.

### userStore (modify)
- `waterGoal` now reads from `trackerStore.getTarget('water')` first, falls back to preferences.

### supplementStore (modify)
- On goal approval, if trackers include supplements, auto-add them to the user's supplement list.

## Components

### New
| Component | Responsibility |
|-----------|---------------|
| `src/components/dashboard/DestinationStrip.vue` | Compact goal cards with countdown timers |
| `src/components/goals/GoalCreationFlow.vue` | Multi-step: category → input → AI refine → approve trackers |
| `src/components/goals/GoalCompletionModal.vue` | Celebration + suggest next goal |

### Modified
| Component | Changes |
|-----------|---------|
| `DashboardView.vue` | Replace GoalProgress with DestinationStrip, conditionally render sections based on active trackers |
| `MacroTracker.vue` | Read targets from trackerStore, hide if no macro trackers prescribed |
| `UpNextCards.vue` | Conditionally show water/supplement cards based on active trackers |
| `WeeklyProgress.vue` | Workout ring target from tracker if prescribed |
| `TodayChecklist.vue` | Items appear/disappear based on active trackers |
| `GoalsView.vue` | Integrate GoalCreationFlow, show goals by category |
| `OnboardingView.vue` | Add goal-setting step |
| `BriefMeButton.vue` | Enhanced prompt with goal context and progress |

### Removed
| Component | Replaced by |
|-----------|------------|
| `GoalProgress.vue` | `DestinationStrip.vue` |

## Edge Cases

### No goals set
- Destination Strip shows "Set your first goal" CTA
- Dashboard shows minimal view: header, XP, Brief Me, workout card only
- No macro tracker, no supplement card, no water card

### Goal with no prescribed trackers
- Unlikely (AI always prescribes something), but if it happens: goal shows in Destination Strip, no daily trackers generated

### User removes all prescribed trackers manually
- Goal still shows in Destination Strip with countdown
- Dashboard reverts to minimal view for that goal's trackers
- User can re-add trackers in Settings

### Multiple goals prescribe the same tracker type
- e.g., Body goal prescribes protein 180g AND Nutrition goal prescribes protein 200g
- Use the HIGHER target (more demanding wins)
- Store tracks which goal each tracker belongs to

### Goal deadline extended
- User can extend via goal detail view
- AI recalculates daily targets for the new timeline
- Countdown resets

### Mid-goal difficulty change
- If user changes difficulty in Settings, offer to recalculate current goals' timelines and targets
