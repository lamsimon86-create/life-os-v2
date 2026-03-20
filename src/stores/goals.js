import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { supabase } from '@/lib/supabase'
import { calcKeyResultXp, calcStreakMultiplier } from '@/lib/gamification'
import { useFitnessStore } from '@/stores/fitness'
import { useSupplementStore } from '@/stores/supplement'

export const useGoalsStore = defineStore('goals', () => {
  const goals = ref([])
  const loading = ref(false)
  const trackers = ref([])

  const activeGoals = computed(() => goals.value.filter((g) => g.status === 'active'))
  const topGoals = computed(() => activeGoals.value.slice(0, 2))

  const focusedGoals = computed(() =>
    goals.value.filter(g => g.status === 'active' && g.is_focused)
  )

  const focusedCount = computed(() => focusedGoals.value.length)

  const dashboardGoals = computed(() => {
    if (focusedGoals.value.length > 0) {
      return focusedGoals.value.slice(0, 3)
    }
    return [...activeGoals.value]
      .sort((a, b) => {
        if (!a.target_date) return 1
        if (!b.target_date) return -1
        return new Date(a.target_date) - new Date(b.target_date)
      })
      .slice(0, 3)
  })

  const goalsByCategory = computed(() => ({
    body: activeGoals.value.find(g => g.category === 'body') || null,
    nutrition: activeGoals.value.find(g => g.category === 'nutrition') || null,
    performance: activeGoals.value.find(g => g.category === 'performance') || null
  }))

  const destinationGoals = computed(() =>
    activeGoals.value.filter(g => g.category).slice(0, 3)
  )

  const activeTrackers = computed(() =>
    trackers.value.filter(t => t.is_active)
  )

  function goalProgress(goal) {
    const krs = goal.key_results
    if (!krs || krs.length === 0) return 0
    const avg =
      krs.reduce((sum, kr) => {
        const pct = kr.target_value > 0 ? (kr.current_value / kr.target_value) * 100 : 0
        return sum + pct
      }, 0) / krs.length
    return Math.round(avg)
  }

  function getTarget(type) {
    const matching = activeTrackers.value.filter(t => t.tracker_type === type)
    if (matching.length === 0) return null
    return Math.max(...matching.map(t => t.daily_target))
  }

  function hasTracker(type) {
    return activeTrackers.value.some(t => t.tracker_type === type)
  }

  function goalCountdown(goal) {
    if (!goal.target_date) return null
    const now = new Date()
    const target = new Date(goal.target_date)
    const days = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
    if (days <= 0) return { days: 0, label: 'Due' }
    if (days > 60) return { days, label: `${Math.round(days / 30)} months` }
    return { days, label: `${days} days` }
  }

  async function hydrate() {
    const auth = useAuthStore()
    if (!auth.userId) return

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('v2_goals')
        .select('*, key_results:v2_key_results(*)')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      goals.value = data || []

      const { data: trackerData } = await supabase
        .from('v2_goal_trackers')
        .select('*')
        .eq('is_active', true)

      trackers.value = trackerData || []
    } finally {
      loading.value = false
    }
  }

  async function createGoal(title, description, targetDate) {
    const auth = useAuthStore()
    if (!auth.userId) return

    const { data, error } = await supabase
      .from('v2_goals')
      .insert({
        user_id: auth.userId,
        title,
        description,
        target_date: targetDate || null,
        status: 'active',
      })
      .select('*, key_results:v2_key_results(*)')
      .single()

    if (error) throw error
    goals.value.unshift(data)
    return data
  }

  async function addKeyResult(goalId, title, targetValue, unit, deadline) {
    const auth = useAuthStore()
    if (!auth.userId) return

    const { data, error } = await supabase
      .from('v2_key_results')
      .insert({
        goal_id: goalId,
        user_id: auth.userId,
        title,
        target_value: targetValue,
        current_value: 0,
        unit: unit || null,
        deadline: deadline || null,
      })
      .select()
      .single()

    if (error) throw error

    const goal = goals.value.find((g) => g.id === goalId)
    if (goal) {
      if (!goal.key_results) goal.key_results = []
      goal.key_results.push(data)
    }
    return data
  }

  async function updateKeyResult(id, currentValue) {
    const { data, error } = await supabase
      .from('v2_key_results')
      .update({ current_value: currentValue })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    for (const goal of goals.value) {
      if (!goal.key_results) continue
      const kr = goal.key_results.find((k) => k.id === id)
      if (kr) {
        kr.current_value = data.current_value
        break
      }
    }

    const userStore = useUserStore()
    await userStore.addXp(calcKeyResultXp(userStore.streak))

    return data
  }

  async function updateGoalStatus(id, status) {
    const { data, error } = await supabase
      .from('v2_goals')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    const goal = goals.value.find((g) => g.id === id)
    if (goal) goal.status = data.status

    return data
  }

  async function deleteGoal(id) {
    const { error } = await supabase.from('v2_goals').delete().eq('id', id)
    if (error) throw error
    goals.value = goals.value.filter((g) => g.id !== id)
  }

  async function toggleFocus(goalId) {
    const goal = goals.value.find(g => g.id === goalId)
    if (!goal) return
    if (!goal.is_focused && focusedCount.value >= 3) return
    const newValue = !goal.is_focused
    const { error } = await supabase
      .from('v2_goals')
      .update({ is_focused: newValue })
      .eq('id', goalId)
    if (!error) {
      goal.is_focused = newValue
    }
  }

  async function createGoalWithAI(category, userText) {
    const userStore = useUserStore()
    const fitnessStore = useFitnessStore()

    const prompt = `The user wants to set a fitness goal. Here's their context:

Goal (their words): "${userText}"
Category: ${category}
Current stats: Weight ${userStore.profile?.weight || 'unknown'}kg, Age ${userStore.profile?.age || 'unknown'}, Difficulty: ${userStore.difficulty || 'medium'}
Fitness experience: ${userStore.preferences?.fitness_experience || 'unknown'}
Current program: ${fitnessStore.activeProgram?.name || 'none'}

Respond with JSON only:
{
  "refined_title": "Short measurable title",
  "description": "What success looks like in 1-2 sentences",
  "target_description": "The measurable outcome",
  "deadline_days": number,
  "key_results": [
    { "title": "...", "target_value": number, "unit": "...", "current_value": number }
  ],
  "prescribed_trackers": [
    { "type": "protein|calories|water|supplement|workout_frequency|body_weight", "daily_target": number, "unit": "...", "name": "optional supplement name", "reason": "why this helps" }
  ]
}`

    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        message: prompt,
        context: { page: 'goals', task: 'goal_refinement' },
        conversationHistory: [],
        difficulty: userStore.difficulty || 'medium'
      }
    })

    if (error) throw error

    try {
      const match = data.message.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
    } catch {}

    throw new Error('Could not parse AI response. Please try again.')
  }

  async function approveGoal(category, originalText, refined, prescribedTrackers) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Create the goal
    const { data: goal, error: goalError } = await supabase
      .from('v2_goals')
      .insert({
        user_id: user.id,
        title: refined.refined_title,
        description: refined.description,
        target_date: new Date(Date.now() + refined.deadline_days * 86400000).toISOString().split('T')[0],
        status: 'active',
        category,
        original_text: originalText,
        difficulty: refined.difficulty || 'medium',
        ai_refined: true
      })
      .select()
      .single()

    if (goalError) throw goalError

    // Create key results
    for (const kr of (refined.key_results || [])) {
      await supabase.from('v2_key_results').insert({
        goal_id: goal.id,
        user_id: user.id,
        title: kr.title,
        target_value: kr.target_value,
        current_value: kr.current_value || 0,
        unit: kr.unit,
        deadline: goal.target_date
      })
    }

    // Save trackers
    const trackerInserts = prescribedTrackers.map(t => ({
      user_id: user.id,
      goal_id: goal.id,
      tracker_type: t.type,
      daily_target: t.daily_target,
      unit: t.unit,
      supplement_name: t.name || null,
      reason: t.reason
    }))

    if (trackerInserts.length > 0) {
      const { data: newTrackers } = await supabase
        .from('v2_goal_trackers')
        .insert(trackerInserts)
        .select()

      if (newTrackers) trackers.value.push(...newTrackers)
    }

    // Write targets to preferences
    const userStore = useUserStore()
    const prefUpdates = {}
    for (const t of prescribedTrackers) {
      if (t.type === 'protein') prefUpdates.daily_protein_target = Math.max(t.daily_target, userStore.preferences?.daily_protein_target || 0)
      if (t.type === 'calories') prefUpdates.daily_calorie_target = Math.max(t.daily_target, userStore.preferences?.daily_calorie_target || 0)
      if (t.type === 'water') prefUpdates.daily_water_goal = Math.max(t.daily_target, userStore.preferences?.daily_water_goal || 0)
    }

    if (Object.keys(prefUpdates).length > 0) {
      await userStore.updateProfile({
        preferences: { ...userStore.preferences, ...prefUpdates }
      })
    }

    // Auto-add prescribed supplements (dedup by name)
    const supplementStore = useSupplementStore()
    for (const t of prescribedTrackers) {
      if (t.type === 'supplement' && t.name) {
        const exists = supplementStore.supplements.some(
          s => s.name.toLowerCase() === t.name.toLowerCase()
        )
        if (!exists) {
          await supplementStore.addSupplement(t.name, 'daily')
        }
      }
    }

    // Refresh goals
    await hydrate()
    return goal
  }

  async function completeGoal(goalId) {
    const goal = goals.value.find(g => g.id === goalId)
    if (!goal) return

    // Mark complete
    await supabase
      .from('v2_goals')
      .update({ status: 'completed' })
      .eq('id', goalId)

    // Deactivate trackers for this goal
    await supabase
      .from('v2_goal_trackers')
      .update({ is_active: false })
      .eq('goal_id', goalId)

    // Award XP
    const userStore = useUserStore()
    const streak = userStore.streak || 0
    const multiplier = calcStreakMultiplier(streak)
    const isEarly = goal.target_date && new Date(goal.target_date) > new Date()
    const baseXp = isEarly ? 750 : 500
    await userStore.addXp(Math.round(baseXp * multiplier))

    // Refresh
    await hydrate()
  }

  return {
    goals,
    loading,
    activeGoals,
    topGoals,
    focusedGoals,
    focusedCount,
    dashboardGoals,
    goalsByCategory,
    destinationGoals,
    activeTrackers,
    trackers,
    goalProgress,
    getTarget,
    hasTracker,
    goalCountdown,
    hydrate,
    createGoal,
    addKeyResult,
    updateKeyResult,
    updateGoalStatus,
    deleteGoal,
    toggleFocus,
    createGoalWithAI,
    approveGoal,
    completeGoal,
  }
})
