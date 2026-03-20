export const DIFFICULTY_PRESETS = {
  easy: { label: 'Easy', workoutDays: 3, mealComplexity: 'simple', accountability: 'gentle' },
  medium: { label: 'Medium', workoutDays: 4, mealComplexity: 'moderate', accountability: 'balanced' },
  hard: { label: 'Hard', workoutDays: 6, mealComplexity: 'advanced', accountability: 'strict' },
}

export const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core']

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

export const ENERGY_LEVELS = ['high', 'medium', 'low']

export const SLEEP_QUALITY = ['great', 'ok', 'rough']

export function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

export function formatDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

export function getDayOfWeek(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return d.getDay()
}

export function getWeekStart(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function getMondayWeekStart(date) {
  const d = date ? new Date(date) : new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().split('T')[0]
}
