-- Goal system enhancements
ALTER TABLE v2_goals ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE v2_goals ADD COLUMN IF NOT EXISTS original_text text;
ALTER TABLE v2_goals ADD COLUMN IF NOT EXISTS difficulty text;
ALTER TABLE v2_goals ADD COLUMN IF NOT EXISTS ai_refined boolean DEFAULT false;
ALTER TABLE v2_goals ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_v2_goals_updated_at
  BEFORE UPDATE ON v2_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- One active goal per category per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_goals_active_category
  ON v2_goals (user_id, category)
  WHERE status = 'active';

-- Goal trackers
CREATE TABLE IF NOT EXISTS v2_goal_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id uuid REFERENCES v2_goals(id) ON DELETE CASCADE NOT NULL,
  tracker_type text NOT NULL,
  daily_target numeric,
  unit text,
  supplement_name text,
  reason text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE v2_goal_trackers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goal trackers" ON v2_goal_trackers FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_v2_goal_trackers_user_type ON v2_goal_trackers (user_id, tracker_type) WHERE is_active = true;
