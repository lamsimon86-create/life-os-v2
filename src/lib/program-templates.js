function makeExercise(name, sets, repsMin, repsMax, rest) {
  return { name, sets, reps_min: repsMin, reps_max: repsMax, rest }
}

export const PROGRAM_TEMPLATES = [
  {
    name: 'Push/Pull/Legs (6-day)',
    description: '6 days on, 1 rest. Classic PPL split.',
    days: [
      { day_of_week: 0, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 1, name: 'Push A', focus: 'Chest & Triceps', is_rest_day: false, exercises: [
        makeExercise('Bench Press', 4, 6, 8, 120),
        makeExercise('Incline Bench Press', 3, 8, 10, 90),
        makeExercise('Overhead Press', 3, 8, 10, 90),
        makeExercise('Lateral Raises', 3, 12, 15, 60),
        makeExercise('Tricep Pushdown', 3, 10, 12, 60),
        makeExercise('Overhead Tricep Extension', 3, 10, 12, 60)
      ]},
      { day_of_week: 2, name: 'Pull A', focus: 'Back & Biceps', is_rest_day: false, exercises: [
        makeExercise('Barbell Row', 4, 6, 8, 120),
        makeExercise('Pull-Ups', 3, 6, 10, 90),
        makeExercise('Lat Pulldown', 3, 10, 12, 60),
        makeExercise('Face Pulls', 3, 15, 20, 60),
        makeExercise('Barbell Curl', 3, 8, 10, 60),
        makeExercise('Hammer Curl', 3, 10, 12, 60)
      ]},
      { day_of_week: 3, name: 'Legs A', focus: 'Quads & Hamstrings', is_rest_day: false, exercises: [
        makeExercise('Squat', 4, 6, 8, 150),
        makeExercise('Leg Press', 3, 10, 12, 90),
        makeExercise('Romanian Deadlift', 3, 8, 10, 90),
        makeExercise('Leg Curl', 3, 10, 12, 60),
        makeExercise('Leg Extension', 3, 10, 12, 60),
        makeExercise('Calf Raises', 4, 12, 15, 60)
      ]},
      { day_of_week: 4, name: 'Push B', focus: 'Shoulders & Chest', is_rest_day: false, exercises: [
        makeExercise('Dumbbell Bench Press', 4, 8, 10, 90),
        makeExercise('Arnold Press', 3, 8, 10, 90),
        makeExercise('Cable Crossover', 3, 12, 15, 60),
        makeExercise('Lateral Raises', 3, 12, 15, 60),
        makeExercise('Skull Crushers', 3, 10, 12, 60),
        makeExercise('Tricep Pushdown', 3, 10, 12, 60)
      ]},
      { day_of_week: 5, name: 'Pull B', focus: 'Back & Biceps', is_rest_day: false, exercises: [
        makeExercise('Deadlift', 4, 5, 6, 180),
        makeExercise('Seated Cable Row', 3, 10, 12, 90),
        makeExercise('Dumbbell Row', 3, 10, 12, 60),
        makeExercise('Rear Delt Flyes', 3, 12, 15, 60),
        makeExercise('Dumbbell Curl', 3, 10, 12, 60),
        makeExercise('Preacher Curl', 3, 10, 12, 60)
      ]},
      { day_of_week: 6, name: 'Legs B', focus: 'Glutes & Legs', is_rest_day: false, exercises: [
        makeExercise('Squat', 4, 8, 10, 150),
        makeExercise('Bulgarian Split Squat', 3, 8, 10, 90),
        makeExercise('Hip Thrust', 3, 10, 12, 90),
        makeExercise('Leg Curl', 3, 10, 12, 60),
        makeExercise('Calf Raises', 4, 12, 15, 60),
        makeExercise('Lunges', 3, 10, 12, 60)
      ]}
    ]
  },
  {
    name: 'Upper/Lower (4-day)',
    description: 'Mon/Thu upper, Tue/Fri lower, 3 rest days.',
    days: [
      { day_of_week: 0, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 1, name: 'Upper A', focus: 'Chest, Back & Arms', is_rest_day: false, exercises: [
        makeExercise('Bench Press', 4, 6, 8, 120),
        makeExercise('Barbell Row', 4, 6, 8, 120),
        makeExercise('Overhead Press', 3, 8, 10, 90),
        makeExercise('Lat Pulldown', 3, 10, 12, 60),
        makeExercise('Dumbbell Curl', 3, 10, 12, 60),
        makeExercise('Tricep Pushdown', 3, 10, 12, 60)
      ]},
      { day_of_week: 2, name: 'Lower A', focus: 'Quads & Hamstrings', is_rest_day: false, exercises: [
        makeExercise('Squat', 4, 6, 8, 150),
        makeExercise('Romanian Deadlift', 3, 8, 10, 120),
        makeExercise('Leg Press', 3, 10, 12, 90),
        makeExercise('Leg Curl', 3, 10, 12, 60),
        makeExercise('Calf Raises', 4, 12, 15, 60),
        makeExercise('Lunges', 3, 10, 12, 60)
      ]},
      { day_of_week: 3, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 4, name: 'Upper B', focus: 'Shoulders, Back & Arms', is_rest_day: false, exercises: [
        makeExercise('Dumbbell Bench Press', 4, 8, 10, 90),
        makeExercise('Seated Cable Row', 3, 10, 12, 90),
        makeExercise('Arnold Press', 3, 8, 10, 90),
        makeExercise('Pull-Ups', 3, 6, 10, 90),
        makeExercise('Hammer Curl', 3, 10, 12, 60),
        makeExercise('Skull Crushers', 3, 10, 12, 60)
      ]},
      { day_of_week: 5, name: 'Lower B', focus: 'Glutes & Legs', is_rest_day: false, exercises: [
        makeExercise('Deadlift', 4, 5, 6, 180),
        makeExercise('Bulgarian Split Squat', 3, 8, 10, 90),
        makeExercise('Hip Thrust', 3, 10, 12, 90),
        makeExercise('Leg Extension', 3, 10, 12, 60),
        makeExercise('Calf Raises', 4, 12, 15, 60),
        makeExercise('Leg Curl', 3, 10, 12, 60)
      ]},
      { day_of_week: 6, name: 'Rest', focus: '', is_rest_day: true, exercises: [] }
    ]
  },
  {
    name: 'Full Body (3-day)',
    description: 'Mon/Wed/Fri full body, 4 rest days.',
    days: [
      { day_of_week: 0, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 1, name: 'Full Body A', focus: 'Compound Focus', is_rest_day: false, exercises: [
        makeExercise('Squat', 4, 6, 8, 150),
        makeExercise('Bench Press', 4, 6, 8, 120),
        makeExercise('Barbell Row', 3, 8, 10, 90),
        makeExercise('Overhead Press', 3, 8, 10, 90),
        makeExercise('Barbell Curl', 3, 10, 12, 60),
        makeExercise('Calf Raises', 3, 12, 15, 60)
      ]},
      { day_of_week: 2, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 3, name: 'Full Body B', focus: 'Hypertrophy', is_rest_day: false, exercises: [
        makeExercise('Deadlift', 4, 5, 6, 180),
        makeExercise('Dumbbell Bench Press', 3, 10, 12, 90),
        makeExercise('Lat Pulldown', 3, 10, 12, 60),
        makeExercise('Lateral Raises', 3, 12, 15, 60),
        makeExercise('Tricep Pushdown', 3, 10, 12, 60),
        makeExercise('Leg Curl', 3, 10, 12, 60)
      ]},
      { day_of_week: 4, name: 'Rest', focus: '', is_rest_day: true, exercises: [] },
      { day_of_week: 5, name: 'Full Body C', focus: 'Strength & Power', is_rest_day: false, exercises: [
        makeExercise('Squat', 4, 8, 10, 120),
        makeExercise('Incline Bench Press', 3, 8, 10, 90),
        makeExercise('Pull-Ups', 3, 6, 10, 90),
        makeExercise('Romanian Deadlift', 3, 8, 10, 90),
        makeExercise('Hammer Curl', 3, 10, 12, 60),
        makeExercise('Calf Raises', 3, 12, 15, 60)
      ]},
      { day_of_week: 6, name: 'Rest', focus: '', is_rest_day: true, exercises: [] }
    ]
  }
]
