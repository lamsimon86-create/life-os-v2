import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { supabase } from '@/lib/supabase'
import { calcMealXp } from '@/lib/gamification'
import { getWeekStart, MEAL_TYPES } from '@/lib/constants'

export const useMealsStore = defineStore('meals', () => {
  const weekPlan = ref(null)
  const todaysMeals = ref([])
  const recipes = ref([])
  const groceryList = ref(null)
  const recentMeals = ref([])
  const loading = ref(false)
  const openAiPanel = ref(false)

  async function hydrate() {
    const auth = useAuthStore()
    if (!auth.userId) return

    loading.value = true
    try {
      const today = new Date().toISOString().split('T')[0]
      const weekStart = getWeekStart()

      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0]

      const [planRes, recipesRes, todayRes, recentRes] = await Promise.all([
        supabase
          .from('v2_meal_plans')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('week_start', weekStart)
          .maybeSingle(),
        supabase
          .from('v2_recipes')
          .select('*')
          .eq('user_id', auth.userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('v2_meals')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('date', today),
        supabase
          .from('v2_meals')
          .select('*')
          .eq('user_id', auth.userId)
          .gte('date', fourteenDaysAgoStr)
          .order('date', { ascending: false }),
      ])

      if (planRes.error) throw planRes.error
      if (recipesRes.error) throw recipesRes.error
      if (todayRes.error) throw todayRes.error
      if (recentRes.error) throw recentRes.error

      weekPlan.value = planRes.data || null
      recipes.value = recipesRes.data || []
      todaysMeals.value = todayRes.data || []
      recentMeals.value = recentRes.data || []
      groceryList.value = weekPlan.value?.grocery_list || null
    } finally {
      loading.value = false
    }
  }

  async function logMeal(data) {
    const auth = useAuthStore()
    if (!auth.userId) return

    const { data: inserted, error } = await supabase
      .from('v2_meals')
      .insert({ user_id: auth.userId, ...data })
      .select()
      .single()

    if (error) throw error

    todaysMeals.value.push(inserted)

    // Award XP if all planned meal types for today are now logged
    const loggedTypes = new Set(todaysMeals.value.map((m) => m.meal_type))
    const allLogged = MEAL_TYPES.every((t) => loggedTypes.has(t))
    if (allLogged) {
      const userStore = useUserStore()
      await userStore.addXp(calcMealXp(userStore.streak))
    }

    return inserted
  }

  async function approveRecipe(recipeData) {
    const auth = useAuthStore()
    if (!auth.userId) return

    const { data, error } = await supabase
      .from('v2_recipes')
      .insert({ user_id: auth.userId, source: 'ai', liked: true, ...recipeData })
      .select()
      .single()

    if (error) throw error
    recipes.value.unshift(data)
    return data
  }

  function generatePlan() {
    openAiPanel.value = true
  }

  async function deleteRecipe(id) {
    const { error } = await supabase.from('v2_recipes').delete().eq('id', id)
    if (error) throw error
    recipes.value = recipes.value.filter((r) => r.id !== id)
  }

  return {
    weekPlan,
    todaysMeals,
    recipes,
    groceryList,
    recentMeals,
    loading,
    openAiPanel,
    hydrate,
    logMeal,
    approveRecipe,
    generatePlan,
    deleteRecipe,
  }
})
