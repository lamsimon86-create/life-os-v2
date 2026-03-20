-- Supplement list
CREATE TABLE v2_supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  frequency text DEFAULT 'daily',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE v2_supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own supplements" ON v2_supplements FOR ALL USING (auth.uid() = user_id);

-- Supplement daily logs
CREATE TABLE v2_supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  supplement_id uuid REFERENCES v2_supplements(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  taken_at timestamptz DEFAULT now(),
  UNIQUE(supplement_id, date)
);

ALTER TABLE v2_supplement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own supplement logs" ON v2_supplement_logs FOR ALL USING (auth.uid() = user_id);

-- Body weight + progress photos
CREATE TABLE v2_body_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight_lbs numeric(5,1) NOT NULL,
  photo_front_url text,
  photo_side_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE v2_body_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own body logs" ON v2_body_logs FOR ALL USING (auth.uid() = user_id);

-- Macro tracking columns on meals
ALTER TABLE v2_meals ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE v2_meals ADD COLUMN IF NOT EXISTS confidence text;

-- Macro data on saved recipes
ALTER TABLE v2_recipes ADD COLUMN IF NOT EXISTS calories_est integer;
ALTER TABLE v2_recipes ADD COLUMN IF NOT EXISTS protein_est integer;
