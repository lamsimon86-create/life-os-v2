-- pg_cron jobs for Life OS v2
-- Job 1: evaluate_streaks — Daily at 5 AM ET (10 AM UTC)
SELECT cron.schedule(
  'v2_evaluate_streaks',
  '0 10 * * *',
  $$
  UPDATE v2_profiles p
  SET
    streak = CASE
      WHEN p.streak_last_date = CURRENT_DATE - INTERVAL '1 day' THEN p.streak + 1
      WHEN p.streak_last_date = CURRENT_DATE THEN p.streak
      ELSE 0
    END,
    streak_last_date = CASE
      WHEN EXISTS (
        SELECT 1 FROM v2_workout_logs wl
        WHERE wl.user_id = p.user_id
        AND wl.finished_at IS NOT NULL
        AND DATE(wl.finished_at) = CURRENT_DATE - INTERVAL '1 day'
      ) THEN CURRENT_DATE - INTERVAL '1 day'
      ELSE p.streak_last_date
    END
  WHERE p.onboarding_complete = true;
  $$
);

-- Job 2: generate_weekly_plan_reminder — Sunday 8 PM ET (Monday 1 AM UTC)
SELECT cron.schedule(
  'v2_weekly_plan_reminder',
  '0 1 * * 1',
  $$
  INSERT INTO v2_daily_logs (user_id, date, notes)
  SELECT p.user_id, CURRENT_DATE, 'Reminder: Generate your meal plan for this week'
  FROM v2_profiles p
  WHERE p.onboarding_complete = true
  AND NOT EXISTS (
    SELECT 1 FROM v2_meal_plans mp
    WHERE mp.user_id = p.user_id
    AND mp.week_start >= CURRENT_DATE
  )
  ON CONFLICT (user_id, date) DO UPDATE SET notes = EXCLUDED.notes;
  $$
);
