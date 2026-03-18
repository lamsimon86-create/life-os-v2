-- ============================================================
-- Life OS v2 Seed Migration
-- Populates v2_exercise_library with 40 exercises
-- Uses ON CONFLICT (name) DO NOTHING for idempotency
-- ============================================================

INSERT INTO v2_exercise_library (name, muscle_group, equipment, is_compound) VALUES

-- Chest (6)
('Bench Press',          'chest', 'barbell',   true),
('Incline Bench Press',  'chest', 'barbell',   true),
('Dumbbell Flyes',       'chest', 'dumbbell',  false),
('Cable Crossover',      'chest', 'cable',     false),
('Push-Ups',             'chest', 'bodyweight',true),
('Dumbbell Bench Press', 'chest', 'dumbbell',  true),

-- Back (7)
('Deadlift',             'back', 'barbell',    true),
('Barbell Row',          'back', 'barbell',    true),
('Pull-Ups',             'back', 'bodyweight', true),
('Lat Pulldown',         'back', 'cable',      true),
('Seated Cable Row',     'back', 'cable',      true),
('Dumbbell Row',         'back', 'dumbbell',   true),
('Face Pulls',           'back', 'cable',      false),

-- Shoulders (6)
('Overhead Press',       'shoulders', 'barbell',  true),
('Lateral Raises',       'shoulders', 'dumbbell', false),
('Front Raises',         'shoulders', 'dumbbell', false),
('Rear Delt Flyes',      'shoulders', 'dumbbell', false),
('Arnold Press',         'shoulders', 'dumbbell', true),
('Upright Row',          'shoulders', 'barbell',  true),

-- Legs (9)
('Squat',                'legs', 'barbell',    true),
('Leg Press',            'legs', 'machine',    true),
('Romanian Deadlift',    'legs', 'barbell',    true),
('Leg Curl',             'legs', 'machine',    false),
('Leg Extension',        'legs', 'machine',    false),
('Calf Raises',          'legs', 'machine',    false),
('Bulgarian Split Squat','legs', 'dumbbell',   true),
('Lunges',               'legs', 'bodyweight', true),
('Hip Thrust',           'legs', 'barbell',    true),

-- Arms (7)
('Barbell Curl',                'arms', 'barbell',  false),
('Dumbbell Curl',               'arms', 'dumbbell', false),
('Hammer Curl',                 'arms', 'dumbbell', false),
('Tricep Pushdown',             'arms', 'cable',    false),
('Overhead Tricep Extension',   'arms', 'dumbbell', false),
('Skull Crushers',              'arms', 'barbell',  false),
('Preacher Curl',               'arms', 'barbell',  false),

-- Core (5)
('Plank',               'core', 'bodyweight', false),
('Hanging Leg Raise',   'core', 'bodyweight', false),
('Cable Crunch',        'core', 'cable',      false),
('Ab Wheel Rollout',    'core', 'ab wheel',   false),
('Russian Twist',       'core', 'bodyweight', false)

ON CONFLICT (name) DO NOTHING;
