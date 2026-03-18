-- ============================================================
-- Life OS v2 Schema Migration
-- All tables prefixed with v2_ to coexist with v1 tables
-- Project: ezzhugoodmvfxaumpioo
-- ============================================================

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- v2_profiles
-- ============================================================
CREATE TABLE v2_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT,
  age             INT,
  height_cm       NUMERIC,
  weight_kg       NUMERIC,
  difficulty      TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  xp              INT NOT NULL DEFAULT 0,
  level           INT NOT NULL DEFAULT 1,
  streak          INT NOT NULL DEFAULT 0,
  streak_last_date DATE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  preferences     JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER v2_profiles_updated_at
  BEFORE UPDATE ON v2_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE v2_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_profiles_select" ON v2_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_profiles_insert" ON v2_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_profiles_update" ON v2_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_profiles_delete" ON v2_profiles FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- v2_goals
-- ============================================================
CREATE TABLE v2_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE v2_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_goals_select" ON v2_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_goals_insert" ON v2_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_goals_update" ON v2_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_goals_delete" ON v2_goals FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_goals_user_status ON v2_goals(user_id, status);

-- ============================================================
-- v2_key_results
-- ============================================================
CREATE TABLE v2_key_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id       UUID NOT NULL REFERENCES v2_goals(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  target_value  NUMERIC NOT NULL,
  unit          TEXT,
  deadline      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE v2_key_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_key_results_select" ON v2_key_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_key_results_insert" ON v2_key_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_key_results_update" ON v2_key_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_key_results_delete" ON v2_key_results FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_key_results_goal_id ON v2_key_results(goal_id);

-- ============================================================
-- v2_fitness_programs
-- ============================================================
CREATE TABLE v2_fitness_programs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('template', 'ai', 'custom')),
  is_active  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active program per user
CREATE UNIQUE INDEX v2_fitness_programs_one_active
  ON v2_fitness_programs(user_id)
  WHERE is_active = true;

ALTER TABLE v2_fitness_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_fitness_programs_select" ON v2_fitness_programs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_fitness_programs_insert" ON v2_fitness_programs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_fitness_programs_update" ON v2_fitness_programs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_fitness_programs_delete" ON v2_fitness_programs FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- v2_program_days
-- ============================================================
CREATE TABLE v2_program_days (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID NOT NULL REFERENCES v2_fitness_programs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  name        TEXT NOT NULL,
  focus       TEXT,
  is_rest_day BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE v2_program_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_program_days_select" ON v2_program_days FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_program_days_insert" ON v2_program_days FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_program_days_update" ON v2_program_days FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_program_days_delete" ON v2_program_days FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_program_days_program_id ON v2_program_days(program_id);

-- ============================================================
-- v2_program_exercises
-- ============================================================
CREATE TABLE v2_program_exercises (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_day_id   UUID NOT NULL REFERENCES v2_program_days(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name    TEXT NOT NULL,
  target_sets      INT NOT NULL DEFAULT 3,
  target_reps_min  INT,
  target_reps_max  INT,
  rest_seconds     INT NOT NULL DEFAULT 90,
  sort_order       INT NOT NULL DEFAULT 0
);

ALTER TABLE v2_program_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_program_exercises_select" ON v2_program_exercises FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_program_exercises_insert" ON v2_program_exercises FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_program_exercises_update" ON v2_program_exercises FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_program_exercises_delete" ON v2_program_exercises FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_program_exercises_day_id ON v2_program_exercises(program_day_id);

-- ============================================================
-- v2_exercise_library
-- Public read, admin-only write (no user_id)
-- ============================================================
CREATE TABLE v2_exercise_library (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  muscle_group TEXT NOT NULL,
  equipment   TEXT,
  is_compound BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE v2_exercise_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_exercise_library_select" ON v2_exercise_library FOR SELECT USING (true);
-- Write policies restricted to service role (no INSERT/UPDATE/DELETE for anon/authenticated)

-- ============================================================
-- v2_workout_logs
-- ============================================================
CREATE TABLE v2_workout_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_day_id UUID REFERENCES v2_program_days(id) ON DELETE SET NULL,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at    TIMESTAMPTZ,
  duration_min   INT,
  xp_earned      INT NOT NULL DEFAULT 0,
  notes          TEXT
);

ALTER TABLE v2_workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_workout_logs_select" ON v2_workout_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_workout_logs_insert" ON v2_workout_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_workout_logs_update" ON v2_workout_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_workout_logs_delete" ON v2_workout_logs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_workout_logs_user_started ON v2_workout_logs(user_id, started_at DESC);

-- ============================================================
-- v2_workout_sets
-- ============================================================
CREATE TABLE v2_workout_sets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id UUID NOT NULL REFERENCES v2_workout_logs(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name  TEXT NOT NULL,
  set_number     INT NOT NULL,
  weight         NUMERIC,
  reps           INT,
  is_warmup      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE v2_workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_workout_sets_select" ON v2_workout_sets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_workout_sets_insert" ON v2_workout_sets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_workout_sets_update" ON v2_workout_sets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_workout_sets_delete" ON v2_workout_sets FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_workout_sets_log_id ON v2_workout_sets(workout_log_id);
CREATE INDEX v2_workout_sets_user_exercise ON v2_workout_sets(user_id, exercise_name, created_at DESC);

-- ============================================================
-- v2_recipes
-- ============================================================
CREATE TABLE v2_recipes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  ingredients   JSONB NOT NULL DEFAULT '[]',
  instructions  JSONB NOT NULL DEFAULT '[]',
  prep_time_min INT,
  cook_time_min INT,
  calories      INT,
  protein_g     NUMERIC,
  carbs_g       NUMERIC,
  fat_g         NUMERIC,
  tags          TEXT[],
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  liked         BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE v2_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_recipes_select" ON v2_recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_recipes_insert" ON v2_recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_recipes_update" ON v2_recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_recipes_delete" ON v2_recipes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_recipes_user_id ON v2_recipes(user_id);

-- ============================================================
-- v2_meal_plans
-- ============================================================
CREATE TABLE v2_meal_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  plan_data    JSONB NOT NULL DEFAULT '{}',
  grocery_list JSONB NOT NULL DEFAULT '{}',
  source       TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE v2_meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_meal_plans_select" ON v2_meal_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_meal_plans_insert" ON v2_meal_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_meal_plans_update" ON v2_meal_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_meal_plans_delete" ON v2_meal_plans FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_meal_plans_user_week ON v2_meal_plans(user_id, week_start DESC);

-- ============================================================
-- v2_meals
-- ============================================================
CREATE TABLE v2_meals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  meal_type  TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  name       TEXT NOT NULL,
  recipe_id  UUID REFERENCES v2_recipes(id) ON DELETE SET NULL,
  calories   INT,
  protein_g  NUMERIC,
  carbs_g    NUMERIC,
  fat_g      NUMERIC,
  rating     INT CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE v2_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_meals_select" ON v2_meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_meals_insert" ON v2_meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_meals_update" ON v2_meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_meals_delete" ON v2_meals FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_meals_user_date ON v2_meals(user_id, date DESC);

-- ============================================================
-- v2_daily_logs
-- ============================================================
CREATE TABLE v2_daily_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  energy        TEXT CHECK (energy IN ('high', 'medium', 'low')),
  sleep_hours   NUMERIC,
  sleep_quality TEXT CHECK (sleep_quality IN ('great', 'ok', 'rough')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE v2_daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_daily_logs_select" ON v2_daily_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_daily_logs_insert" ON v2_daily_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_daily_logs_update" ON v2_daily_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_daily_logs_delete" ON v2_daily_logs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_daily_logs_user_date ON v2_daily_logs(user_id, date DESC);

-- ============================================================
-- v2_ai_conversations
-- ============================================================
CREATE TABLE v2_ai_conversations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content      TEXT NOT NULL,
  context_page TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE v2_ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_ai_conversations_select" ON v2_ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2_ai_conversations_insert" ON v2_ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2_ai_conversations_update" ON v2_ai_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2_ai_conversations_delete" ON v2_ai_conversations FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX v2_ai_conversations_user_created ON v2_ai_conversations(user_id, created_at DESC);
