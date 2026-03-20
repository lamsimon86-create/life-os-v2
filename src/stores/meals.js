import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { supabase } from '@/lib/supabase'
import { calcMealXp } from '@/lib/gamification'
import { getWeekStart, MEAL_TYPES, getMondayWeekStart } from '@/lib/constants'

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

  const weeklyMealProgress = computed(() => {
    if (!weekPlan.value?.plan_data) return { logged: 0, planned: 0, percentage: 0 }

    const weekStart = getMondayWeekStart()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const todayStr = new Date().toISOString().split('T')[0]

    let planned = 0
    const startDate = new Date(weekStart + 'T00:00:00')
    const endDate = new Date(todayStr + 'T23:59:59')
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayName = dayNames[d.getDay()]
      const dayPlan = weekPlan.value.plan_data[dayName]
      if (dayPlan) {
        planned += Object.keys(dayPlan).filter(k => dayPlan[k]).length
      }
    }

    const logged = recentMeals.value.filter(m => {
      return m.date >= weekStart
    }).length

    const percentage = planned > 0 ? Math.round((logged / planned) * 100) : 0
    return { logged, planned, percentage }
  })

  const nextMealToLog = computed(() => {
    const hour = new Date().getHours()

    let targetType
    if (hour < 10) targetType = 'breakfast'
    else if (hour < 14) targetType = 'lunch'
    else if (hour < 18) targetType = 'dinner'
    else targetType = 'snack'

    const loggedTypes = todaysMeals.value.map(m => m.meal_type)
    const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack']

    const startIdx = mealOrder.indexOf(targetType)
    for (let i = 0; i < mealOrder.length; i++) {
      const type = mealOrder[(startIdx + i) % mealOrder.length]
      if (!loggedTypes.includes(type)) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const todayName = dayNames[new Date().getDay()]
        const todayPlan = weekPlan.value?.plan_data?.[todayName]
        const planned = todayPlan?.[type] || null
        return { type, planned }
      }
    }

    return null
  })

  const dailyProtein = computed(() => {
    return (todaysMeals.value || []).reduce((sum, m) => sum + (m.protein_g || 0), 0)
  })

  const dailyCalories = computed(() => {
    return (todaysMeals.value || []).reduce((sum, m) => sum + (m.calories || 0), 0)
  })

  const proteinTarget = computed(() => {
    const userStore = useUserStore()
    return userStore.preferences?.daily_protein_target || 150
  })

  const calorieTarget = computed(() => {
    const userStore = useUserStore()
    return userStore.preferences?.daily_calorie_target || 2200
  })

  const savedMealsWithMacros = computed(() => {
    return recipes.value.filter(r => r.calories_est || r.protein_est)
  })

  async function estimateMacros(description) {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        message: `Estimate the calories and protein (in grams) for this meal: "${description}"\n\nRespond with JSON only: { "calories": number, "protein": number, "confidence": "high" | "medium" | "low" }\n\nBase estimates on typical serving sizes. If the description is vague, use medium portions.`,
        context: { page: 'meals', task: 'macro_estimation' },
        conversationHistory: [],
        difficulty: 'medium'
      }
    })

    if (error) throw error

    // Parse JSON from AI response
    try {
      const match = data.message.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
    } catch {}

    return { calories: 0, protein: 0, confidence: 'low' }
  }

  async function saveAsMeal(mealData) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('v2_recipes')
      .insert({
        user_id: user.id,
        name: mealData.name,
        description: mealData.description || '',
        calories_est: mealData.calories,
        protein_est: mealData.protein,
        source: 'user',
        liked: true
      })
      .select()
      .single()

    if (data) recipes.value.unshift(data)
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
    weeklyMealProgress,
    nextMealToLog,
    dailyProtein,
    dailyCalories,
    proteinTarget,
    calorieTarget,
    savedMealsWithMacros,
    estimateMacros,
    saveAsMeal,
  }
})
