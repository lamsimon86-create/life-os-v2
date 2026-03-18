import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { supabase } from '@/lib/supabase'
import { calcWorkoutXp } from '@/lib/gamification'
import { getDayOfWeek, getWeekStart } from '@/lib/constants'

export const useFitnessStore = defineStore('fitness', () => {
  const activeProgram = ref(null)
  const todaysWorkout = ref(null)
  const activeSession = ref(null)
  const recentLogs = ref([])
  const weeklyVolume = ref(0)
  const workoutStreak = ref(0)
  const loading = ref(false)

  async function hydrate() {
    const auth = useAuthStore()
    if (!auth.userId) return

    loading.value = true
    try {
      // 1. Fetch active program with nested days + exercises
      const { data: programData, error: programError } = await supabase
        .from('v2_fitness_programs')
        .select(`
          *,
          days:v2_program_days(
            *,
            exercises:v2_program_exercises(*)
          )
        `)
        .eq('user_id', auth.userId)
        .eq('is_active', true)
        .maybeSingle()

      if (programError) throw programError
      activeProgram.value = programData || null

      // Sort days by day_of_week and exercises by sort_order
      if (activeProgram.value?.days) {
        activeProgram.value.days.sort((a, b) => a.day_of_week - b.day_of_week)
        for (const day of activeProgram.value.days) {
          if (day.exercises) {
            day.exercises.sort((a, b) => a.sort_order - b.sort_order)
          }
        }
      }

      // 2. Determine today's workout from program days
      const todayDow = getDayOfWeek()
      if (activeProgram.value?.days) {
        const dayMatch = activeProgram.value.days.find(d => d.day_of_week === todayDow)
        todaysWorkout.value = dayMatch || null
      } else {
        todaysWorkout.value = null
      }

      // 3. Fetch last 10 workout logs
      const { data: logData, error: logError } = await supabase
        .from('v2_workout_logs')
        .select('*')
        .eq('user_id', auth.userId)
        .order('started_at', { ascending: false })
        .limit(10)

      if (logError) throw logError
      recentLogs.value = logData || []

      // 4. Calculate weekly volume from v2_workout_sets this week
      const weekStart = getWeekStart()
      const { data: setsData, error: setsError } = await supabase
        .from('v2_workout_sets')
        .select('weight, reps')
        .eq('user_id', auth.userId)
        .gte('created_at', weekStart)

      if (setsError) throw setsError
      weeklyVolume.value = (setsData || []).reduce(
        (sum, s) => sum + (s.weight || 0) * (s.reps || 0),
        0
      )

      // 5. Calculate streak from recent logs (consecutive days with workouts)
      calculateStreak(logData || [])

      // 6. Check for in-progress session (started but not finished)
      const { data: activeData } = await supabase
        .from('v2_workout_logs')
        .select('*')
        .eq('user_id', auth.userId)
        .is('finished_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      activeSession.value = activeData || null
    } finally {
      loading.value = false
    }
  }

  function calculateStreak(logs) {
    if (!logs.length) {
      workoutStreak.value = 0
      return
    }

    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get unique workout dates
    const workoutDates = new Set()
    for (const log of logs) {
      if (log.finished_at) {
        const d = new Date(log.started_at)
        d.setHours(0, 0, 0, 0)
        workoutDates.add(d.getTime())
      }
    }

    // Count consecutive days going backwards from today (or yesterday)
    let checkDate = new Date(today)
    // If no workout today, start from yesterday
    if (!workoutDates.has(checkDate.getTime())) {
      checkDate.setDate(checkDate.getDate() - 1)
    }

    while (workoutDates.has(checkDate.getTime())) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    }

    workoutStreak.value = streak
  }

  async function startWorkout(programDayId) {
    const auth = useAuthStore()
    if (!auth.userId) return null

    const { data, error } = await supabase
      .from('v2_workout_logs')
      .insert({
        user_id: auth.userId,
        program_day_id: programDayId,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    activeSession.value = data
    return data.id
  }

  async function logSet(setData) {
    const { error } = await supabase
      .from('v2_workout_sets')
      .insert(setData)

    if (error) throw error
  }

  async function finishWorkout() {
    if (!activeSession.value) return 0

    const auth = useAuthStore()
    const userStore = useUserStore()

    // Calculate duration
    const startedAt = new Date(activeSession.value.started_at)
    const now = new Date()
    const durationMin = Math.round((now - startedAt) / 60000)

    // Count distinct exercises logged
    const { data: setsData } = await supabase
      .from('v2_workout_sets')
      .select('exercise_name')
      .eq('workout_log_id', activeSession.value.id)

    const exerciseNames = new Set((setsData || []).map(s => s.exercise_name))
    const exerciseCount = exerciseNames.size

    // Calculate XP
    const xp = calcWorkoutXp(exerciseCount, userStore.streak)

    // Update the log
    const { error } = await supabase
      .from('v2_workout_logs')
      .update({
        finished_at: now.toISOString(),
        duration_min: durationMin,
        xp_earned: xp
      })
      .eq('id', activeSession.value.id)

    if (error) throw error

    // Award XP
    await userStore.addXp(xp)

    // Clear active session
    activeSession.value = null

    // Re-fetch recent logs and weekly volume
    const { data: logData } = await supabase
      .from('v2_workout_logs')
      .select('*')
      .eq('user_id', auth.userId)
      .order('started_at', { ascending: false })
      .limit(10)

    recentLogs.value = logData || []

    const weekStart = getWeekStart()
    const { data: weekSets } = await supabase
      .from('v2_workout_sets')
      .select('weight, reps')
      .eq('user_id', auth.userId)
      .gte('created_at', weekStart)

    weeklyVolume.value = (weekSets || []).reduce(
      (sum, s) => sum + (s.weight || 0) * (s.reps || 0),
      0
    )

    calculateStreak(recentLogs.value)

    return xp
  }

  async function createProgramFromTemplate(template) {
    const auth = useAuthStore()
    if (!auth.userId) return

    // Deactivate any existing active program
    await supabase
      .from('v2_fitness_programs')
      .update({ is_active: false })
      .eq('user_id', auth.userId)
      .eq('is_active', true)

    // Insert the program
    const { data: program, error: progError } = await supabase
      .from('v2_fitness_programs')
      .insert({
        user_id: auth.userId,
        name: template.name,
        source: 'template',
        is_active: true
      })
      .select()
      .single()

    if (progError) throw progError

    // Insert days and exercises
    for (const day of template.days) {
      const { data: dayData, error: dayError } = await supabase
        .from('v2_program_days')
        .insert({
          program_id: program.id,
          user_id: auth.userId,
          day_of_week: day.day_of_week,
          name: day.name,
          focus: day.focus,
          is_rest_day: day.is_rest_day
        })
        .select()
        .single()

      if (dayError) throw dayError

      if (day.exercises && day.exercises.length > 0) {
        const exerciseRows = day.exercises.map((ex, idx) => ({
          program_day_id: dayData.id,
          user_id: auth.userId,
          exercise_name: ex.name,
          target_sets: ex.sets,
          target_reps_min: ex.reps_min,
          target_reps_max: ex.reps_max,
          rest_seconds: ex.rest,
          sort_order: idx
        }))

        const { error: exError } = await supabase
          .from('v2_program_exercises')
          .insert(exerciseRows)

        if (exError) throw exError
      }
    }

    // Re-hydrate to pick up the new program
    await hydrate()
  }

  async function fetchSetsForLog(logId) {
    const { data, error } = await supabase
      .from('v2_workout_sets')
      .select('*')
      .eq('workout_log_id', logId)
      .order('set_number', { ascending: true })

    if (error) throw error
    return data || []
  }

  async function fetchLastSessionSets(programDayId) {
    const auth = useAuthStore()
    if (!auth.userId || !programDayId) return []

    // Find the most recent completed log for this program day
    const { data: lastLog } = await supabase
      .from('v2_workout_logs')
      .select('id')
      .eq('user_id', auth.userId)
      .eq('program_day_id', programDayId)
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastLog) return []

    const { data: sets } = await supabase
      .from('v2_workout_sets')
      .select('*')
      .eq('workout_log_id', lastLog.id)
      .order('set_number', { ascending: true })

    return sets || []
  }

  async function fetchExerciseHistory(exerciseName) {
    const auth = useAuthStore()
    if (!auth.userId) return []

    const { data, error } = await supabase
      .from('v2_workout_sets')
      .select('weight, reps, created_at')
      .eq('user_id', auth.userId)
      .eq('exercise_name', exerciseName)
      .eq('is_warmup', false)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  }

  return {
    activeProgram,
    todaysWorkout,
    activeSession,
    recentLogs,
    weeklyVolume,
    workoutStreak,
    loading,
    hydrate,
    startWorkout,
    logSet,
    finishWorkout,
    createProgramFromTemplate,
    fetchSetsForLog,
    fetchLastSessionSets,
    fetchExerciseHistory
  }
})
