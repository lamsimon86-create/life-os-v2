-- RPE tracking on workout sets
ALTER TABLE v2_workout_sets ADD COLUMN rpe integer;

-- Track exercise substitutions
ALTER TABLE v2_workout_sets ADD COLUMN substituted_for text;

-- Program archival
ALTER TABLE v2_fitness_programs ADD COLUMN archived_at timestamptz;

-- Add exercises not in existing seed (002_v2_seed.sql has ~40)
INSERT INTO v2_exercise_library (name, muscle_group, equipment, is_compound) VALUES
  ('Incline Dumbbell Press', 'chest', 'dumbbell', true),
  ('Cable Flyes', 'chest', 'cable', false),
  ('Chest Dips', 'chest', 'bodyweight', true),
  ('T-Bar Row', 'back', 'barbell', true),
  ('Dumbbell Shoulder Press', 'shoulders', 'dumbbell', true),
  ('Front Squat', 'legs', 'barbell', true),
  ('Goblet Squat', 'legs', 'dumbbell', true),
  ('Cable Curl', 'arms', 'cable', false),
  ('Tricep Dips', 'arms', 'bodyweight', true),
  ('Clean and Press', 'shoulders', 'barbell', true),
  ('Farmer''s Walk', 'core', 'dumbbell', true)
ON CONFLICT (name) DO NOTHING;

-- Index for exercise history queries (progression charts, PRs)
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise_history
  ON v2_workout_sets (user_id, exercise_name, created_at DESC)
  WHERE is_warmup = false;
