import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { supabase } from '@/lib/supabase'
import { calcKeyResultXp } from '@/lib/gamification'

export const useGoalsStore = defineStore('goals', () => {
  const goals = ref([])
  const loading = ref(false)

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

  return {
    goals,
    loading,
    activeGoals,
    topGoals,
    focusedGoals,
    focusedCount,
    dashboardGoals,
    goalProgress,
    hydrate,
    createGoal,
    addKeyResult,
    updateKeyResult,
    updateGoalStatus,
    deleteGoal,
    toggleFocus,
  }
})
