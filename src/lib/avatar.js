/**
 * Avatar companion logic — stage derived from level, mood from daily activity.
 * 5 evolution stages, 4 mood states.
 */

export const AVATAR_STAGES = [
  { stage: 1, name: 'Hatchling', minLevel: 1, maxLevel: 2, description: 'Small, just hatched' },
  { stage: 2, name: 'Juvenile', minLevel: 3, maxLevel: 4, description: 'Bigger, more defined' },
  { stage: 3, name: 'Warrior', minLevel: 5, maxLevel: 6, description: 'Strong, battle-ready' },
  { stage: 4, name: 'Champion', minLevel: 7, maxLevel: 8, description: 'Powerful, glowing' },
  { stage: 5, name: 'Mythic', minLevel: 9, maxLevel: 11, description: 'Final form, legendary' }
]

export const MOOD_STATES = ['happy', 'neutral', 'tired', 'sad']

export function getAvatarStage(level) {
  return AVATAR_STAGES.find(s => level >= s.minLevel && level <= s.maxLevel) || AVATAR_STAGES[0]
}

export function getNextStage(level) {
  const current = getAvatarStage(level)
  return AVATAR_STAGES.find(s => s.stage === current.stage + 1) || null
}

export function getAvatarMood({ workoutDone, allMealsLogged, checkinDone, streak, streakBroken }) {
  if (streakBroken) return 'sad'
  const completions = [workoutDone, allMealsLogged, checkinDone].filter(Boolean).length
  if (completions === 3) return 'happy'
  if (completions === 0) return 'tired'
  return 'neutral'
}
