import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { supabase } from '@/lib/supabase'
import { calcWorkoutXp } from '@/lib/gamification'
import { getDayOfWeek, getWeekStart, getMondayWeekStart } from '@/lib/constants'

export const useFitnessStore = defineStore('fitness', () => {
  const activeProgram = ref(null)
  const todaysWorkout = ref(null)
  const activeSession = ref(null)
  const recentLogs = ref([])
  const weeklyVolume = ref(0)
  const workoutStreak = ref(0)
  const loading = ref(false)
  const previousWeekVolume = ref(0)
  const exerciseLibrary = ref([])
  const archivedPrograms = ref([])
  const personalRecords = ref([])

  const weeklyWorkoutCount = computed(() => {
    if (!activeProgram.value) return { completed: 0, planned: 0 }
    const planned = activeProgram.value.days
      ? activeProgram.value.days.filter(d => !d.is_rest_day).length
      : 0
    const weekStart = getMondayWeekStart()
    const completed = recentLogs.value.filter(log => {
      if (!log.finished_at) return false
      const logDate = log.started_at.split('T')[0]
      return logDate >= weekStart
    }).length
    return { completed, planned }
  })

  const lastCompletedWorkout = computed(() => {
    const completed = recentLogs.value.find(log => log.finished_at)
    if (!completed) return null
    const day = activeProgram.value?.days?.find(d => d.id === completed.program_day_id)
    return {
      name: day?.name || 'Workout',
      focus: day?.focus || '',
      duration: completed.duration_min || 0,
      xp: completed.xp_earned || 0
    }
  })

  const volumeTrend = computed(() => {
    if (previousWeekVolume.value === 0) {
      return { percentage: 0, direction: 'flat' }
    }
    const change = ((weeklyVolume.value - previousWeekVolume.value) / previousWeekVolume.value) * 100
    return {
      percentage: Math.abs(Math.round(change)),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
    }
  })

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

      // 4b. Fetch previous week volume for trend comparison
      const prevWeekStart = getMondayWeekStart(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      const prevWeekEnd = getMondayWeekStart()
      const { data: prevLogs } = await supabase
        .from('v2_workout_logs')
        .select('id')
        .eq('user_id', auth.userId)
        .gte('started_at', prevWeekStart)
        .lt('started_at', prevWeekEnd)

      const prevLogIds = (prevLogs || []).map(l => l.id)
      if (prevLogIds.length > 0) {
        const { data: prevSets } = await supabase
          .from('v2_workout_sets')
          .select('weight, reps')
          .in('workout_log_id', prevLogIds)
          .eq('is_warmup', false)

        previousWeekVolume.value = (prevSets || []).reduce(
          (sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0
        )
      } else {
        previousWeekVolume.value = 0
      }

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

      if (exerciseLibrary.value.length === 0) {
        await fetchExerciseLibrary()
      }
    } finally {
      loading.value = false
    }
  }

  function calculateStreak(logs) {
    if (!logs || logs.length === 0) {
      workoutStreak.value = 0
      return
    }

    const restDays = new Set()
    if (activeProgram.value?.days) {
      for (const day of activeProgram.value.days) {
        if (day.is_rest_day) restDays.add(day.day_of_week)
      }
    }

    const logDates = new Set(
      logs
        .filter(l => l.finished_at)
        .map(l => l.started_at.split('T')[0])
    )

    let streak = 0
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    let checkDate = new Date(today)
    if (!logDates.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1)
    }

    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0]
      const dayOfWeek = checkDate.getDay()

      if (restDays.has(dayOfWeek)) {
        checkDate.setDate(checkDate.getDate() - 1)
        continue
      }

      if (logDates.has(dateStr)) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
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
      .insert({
        ...setData,
        rpe: setData.rpe || null,
        substituted_for: setData.substituted_for || null
      })
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

  async function swapDays(dayIdA, dayIdB) {
    if (!activeProgram.value?.days) return
    const dayA = activeProgram.value.days.find(d => d.id === dayIdA)
    const dayB = activeProgram.value.days.find(d => d.id === dayIdB)
    if (!dayA || !dayB) return

    const dowA = dayA.day_of_week
    const dowB = dayB.day_of_week

    // Update both in DB
    const { error: errA } = await supabase
      .from('v2_program_days')
      .update({ day_of_week: dowB })
      .eq('id', dayIdA)
    if (errA) throw errA

    const { error: errB } = await supabase
      .from('v2_program_days')
      .update({ day_of_week: dowA })
      .eq('id', dayIdB)
    if (errB) throw errB

    // Update local state
    dayA.day_of_week = dowB
    dayB.day_of_week = dowA
    activeProgram.value.days.sort((a, b) => a.day_of_week - b.day_of_week)

    // Refresh today's workout
    const todayDow = getDayOfWeek()
    todaysWorkout.value = activeProgram.value.days.find(d => d.day_of_week === todayDow) || null
  }

  async function deactivateProgram() {
    if (!activeProgram.value) return
    const { error } = await supabase
      .from('v2_fitness_programs')
      .update({ is_active: false })
      .eq('id', activeProgram.value.id)
    if (error) throw error
    activeProgram.value = null
    todaysWorkout.value = null
  }

  async function fetchExerciseLibrary() {
    const { data } = await supabase
      .from('v2_exercise_library')
      .select('*')
      .order('muscle_group')
      .order('name')
    exerciseLibrary.value = data || []
  }

  function searchExercises(query, muscleGroup) {
    let results = exerciseLibrary.value
    if (muscleGroup && muscleGroup !== 'all') {
      results = results.filter(e => e.muscle_group === muscleGroup)
    }
    if (query) {
      const q = query.toLowerCase()
      results = results.filter(e => e.name.toLowerCase().includes(q))
    }
    return results
  }

  async function fetchLastWeightForExercise(exerciseName) {
    const user = useAuthStore().user
    const { data } = await supabase
      .from('v2_workout_sets')
      .select('weight, reps')
      .eq('user_id', user.id)
      .eq('exercise_name', exerciseName)
      .eq('is_warmup', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data
  }

  async function fetchPersonalRecords() {
    const user = useAuthStore().user
    const { data } = await supabase
      .from('v2_workout_sets')
      .select('exercise_name, weight, reps, created_at')
      .eq('user_id', user.id)
      .eq('is_warmup', false)
      .order('weight', { ascending: false })

    if (!data) { personalRecords.value = []; return }

    const prMap = new Map()
    for (const set of data) {
      if (!prMap.has(set.exercise_name) || set.weight > prMap.get(set.exercise_name).weight) {
        prMap.set(set.exercise_name, {
          exercise_name: set.exercise_name,
          weight: set.weight,
          reps: set.reps,
          date: set.created_at
        })
      }
    }
    personalRecords.value = Array.from(prMap.values()).sort((a, b) => b.weight - a.weight)
  }

  async function fetchWeeklyMuscleVolume() {
    const user = useAuthStore().user
    const weekStart = getMondayWeekStart()
    const { data } = await supabase
      .from('v2_workout_sets')
      .select('exercise_name')
      .eq('user_id', user.id)
      .eq('is_warmup', false)
      .gte('created_at', weekStart)

    if (!data || exerciseLibrary.value.length === 0) return {}

    const libMap = new Map()
    for (const ex of exerciseLibrary.value) {
      libMap.set(ex.name.toLowerCase(), ex.muscle_group)
    }

    const volume = {}
    for (const set of data) {
      const group = libMap.get(set.exercise_name.toLowerCase())
      if (group) {
        volume[group] = (volume[group] || 0) + 1
      }
    }
    return volume
  }

  async function archiveProgram(programId) {
    const user = useAuthStore().user
    await supabase
      .from('v2_fitness_programs')
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq('id', programId)
      .eq('user_id', user.id)
    activeProgram.value = null
    todaysWorkout.value = null
  }

  async function reactivateProgram(programId) {
    const user = useAuthStore().user
    if (activeProgram.value) {
      await archiveProgram(activeProgram.value.id)
    }
    await supabase
      .from('v2_fitness_programs')
      .update({ is_active: true, archived_at: null })
      .eq('id', programId)
      .eq('user_id', user.id)
    await hydrate()
  }

  async function fetchArchivedPrograms() {
    const user = useAuthStore().user
    const { data } = await supabase
      .from('v2_fitness_programs')
      .select('id, name, source, created_at, archived_at')
      .eq('user_id', user.id)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
    archivedPrograms.value = data || []
  }

  async function updateProgramDay(dayId, updates) {
    const user = useAuthStore().user
    await supabase
      .from('v2_program_days')
      .update(updates)
      .eq('id', dayId)
      .eq('user_id', user.id)
    await hydrate()
  }

  async function addExerciseToDay(dayId, exercise) {
    const user = useAuthStore().user
    const { data: existing } = await supabase
      .from('v2_program_exercises')
      .select('sort_order')
      .eq('program_day_id', dayId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextOrder = (existing?.sort_order || 0) + 1

    await supabase.from('v2_program_exercises').insert({
      program_day_id: dayId,
      user_id: user.id,
      exercise_name: exercise.name,
      target_sets: exercise.sets || 3,
      target_reps_min: exercise.reps_min || 8,
      target_reps_max: exercise.reps_max || 12,
      rest_seconds: exercise.rest_seconds || 90,
      sort_order: nextOrder
    })
  }

  async function removeExerciseFromDay(exerciseId) {
    const user = useAuthStore().user
    await supabase
      .from('v2_program_exercises')
      .delete()
      .eq('id', exerciseId)
      .eq('user_id', user.id)
  }

  async function reorderExercises(dayId, exerciseIds) {
    const user = useAuthStore().user
    for (let i = 0; i < exerciseIds.length; i++) {
      await supabase
        .from('v2_program_exercises')
        .update({ sort_order: i })
        .eq('id', exerciseIds[i])
        .eq('user_id', user.id)
    }
  }

  async function updateExercise(exerciseId, updates) {
    const user = useAuthStore().user
    await supabase
      .from('v2_program_exercises')
      .update(updates)
      .eq('id', exerciseId)
      .eq('user_id', user.id)
  }

  async function createProgramFromAI(selectedDays, goal, experience, injuries) {
    const userStore = useUserStore()

    const prompt = `Build a training program for the user:

Available days: ${selectedDays.join(', ')}
Goal: ${goal}
Experience: ${experience}
Injuries/limitations: ${injuries || 'none'}
Current weight: ${userStore.profile?.weight_kg || 'unknown'} lbs

Respond with JSON only:
{
  "name": "Program Name",
  "days": [
    {
      "day_of_week": 0-6,
      "name": "Day Name",
      "focus": "Muscle focus",
      "is_rest_day": false,
      "exercises": [
        { "name": "Exercise Name", "sets": 3, "reps_min": 8, "reps_max": 10, "rest_seconds": 90 }
      ]
    }
  ]
}

Rules:
- Only schedule training on the available days
- All other days are rest days
- Use standard exercise names
- Weight exercises use lbs
- Compound movements first, isolation last
- If injuries are noted, avoid exercises that stress those areas`

    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        message: prompt,
        context: { page: 'fitness', task: 'program_generation' },
        conversationHistory: [],
        difficulty: userStore.difficulty || 'medium'
      }
    })

    if (error) throw error

    const match = data.message.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI did not return valid JSON')

    const parsed = JSON.parse(match[0])
    await createProgramFromTemplate({
      name: parsed.name,
      days: parsed.days.map(d => ({
        ...d,
        exercises: (d.exercises || []).map(e => ({
          name: e.name,
          sets: e.sets,
          reps_min: e.reps_min,
          reps_max: e.reps_max,
          rest: e.rest_seconds
        }))
      }))
    })
  }

  const exerciseNames = computed(() => exerciseLibrary.value.map(e => e.name))

  return {
    activeProgram,
    todaysWorkout,
    activeSession,
    recentLogs,
    weeklyVolume,
    workoutStreak,
    loading,
    previousWeekVolume,
    exerciseLibrary,
    exerciseNames,
    archivedPrograms,
    personalRecords,
    weeklyWorkoutCount,
    lastCompletedWorkout,
    volumeTrend,
    hydrate,
    startWorkout,
    logSet,
    finishWorkout,
    createProgramFromTemplate,
    swapDays,
    deactivateProgram,
    fetchSetsForLog,
    fetchLastSessionSets,
    fetchExerciseHistory,
    fetchExerciseLibrary,
    searchExercises,
    fetchLastWeightForExercise,
    fetchPersonalRecords,
    fetchWeeklyMuscleVolume,
    archiveProgram,
    reactivateProgram,
    fetchArchivedPrograms,
    updateProgramDay,
    addExerciseToDay,
    removeExerciseFromDay,
    reorderExercises,
    updateExercise,
    createProgramFromAI
  }
})
