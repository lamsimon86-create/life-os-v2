export const LEVELS = [
  { level: 1, title: 'Beginner', xp: 0 },
  { level: 2, title: 'Focused', xp: 100 },
  { level: 3, title: 'Disciplined', xp: 250 },
  { level: 4, title: 'Relentless', xp: 500 },
  { level: 5, title: 'Machine', xp: 1000 },
  { level: 6, title: 'Legend', xp: 2000 },
  { level: 7, title: 'Transcendent', xp: 4000 },
  { level: 8, title: 'Architect', xp: 7000 },
  { level: 9, title: 'Sovereign', xp: 12000 },
  { level: 10, title: 'Ascended', xp: 20000 },
  { level: 11, title: 'Eternal', xp: 35000 },
]

export function getLevelForXp(xp) {
  let current = LEVELS[0]
  for (const level of LEVELS) {
    if (xp >= level.xp) {
      current = level
    }
  }
  return current
}

export function getNextLevel(currentLevel) {
  const idx = LEVELS.findIndex((l) => l.level === currentLevel.level)
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null
}

export function getXpProgress(xp) {
  const current = getLevelForXp(xp)
  const next = getNextLevel(current)

  if (!next) {
    return { current, next: null, progress: 100 }
  }

  const earned = xp - current.xp
  const required = next.xp - current.xp
  const progress = Math.min(100, Math.floor((earned / required) * 100))

  return { current, next, progress }
}

export function calcStreakMultiplier(streak) {
  return Math.min(1.0 + Math.min(streak, 30) * 0.033, 2.0)
}

export function calcWorkoutXp(exerciseCount, streak) {
  const multiplier = calcStreakMultiplier(streak)
  return Math.round((50 + exerciseCount * 10) * multiplier)
}

export function calcMealXp(streak) {
  const multiplier = calcStreakMultiplier(streak)
  return Math.round(30 * multiplier)
}

export function calcKeyResultXp(streak) {
  const multiplier = calcStreakMultiplier(streak)
  return Math.round(20 * multiplier)
}
