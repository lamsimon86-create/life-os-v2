-- Add goal focus column
ALTER TABLE v2_goals ADD COLUMN is_focused boolean DEFAULT false;

-- Add hydration tracking to daily logs
ALTER TABLE v2_daily_logs ADD COLUMN water_glasses integer DEFAULT 0;

-- Calendar events table
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
