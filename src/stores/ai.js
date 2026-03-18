import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/stores/user'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'

export const useAiStore = defineStore('ai', () => {
  const isOpen = ref(false)
  const messages = ref([])
  const isLoading = ref(false)
  const currentPage = ref('dashboard')

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function clearHistory() {
    messages.value = []
  }

  function buildContext() {
    const userStore = useUserStore()
    const fitnessStore = useFitnessStore()
    const mealsStore = useMealsStore()
    const goalsStore = useGoalsStore()

    const context = {
      page: currentPage.value,
    }

    // User profile
    if (userStore.profile) {
      context.userName = userStore.name
      context.age = userStore.profile.age || null
      context.weight = userStore.profile.weight || null
      context.difficulty = userStore.difficulty
    }

    // Food preferences
    const prefs = userStore.preferences
    if (prefs && Object.keys(prefs).length > 0) {
      context.foodPreferences = {
        liked: prefs.liked_foods || null,
        disliked: prefs.disliked_foods || null,
        restrictions: prefs.dietary_restrictions || null,
        cookingLevel: prefs.cooking_level || null,
      }
    }

    // Fitness info
    if (userStore.profile) {
      context.fitnessExperience = userStore.profile.fitness_experience || null
    }
    if (fitnessStore.todaysWorkout) {
      context.todaysWorkout = {
        name: fitnessStore.todaysWorkout.name,
        focus: fitnessStore.todaysWorkout.focus,
        exercises: fitnessStore.todaysWorkout.exercises || [],
      }
    }

    // Today's meals
    if (mealsStore.todaysMeals && mealsStore.todaysMeals.length > 0) {
      context.todaysMeals = mealsStore.todaysMeals.map((m) => ({
        meal_type: m.meal_type,
        name: m.name,
        calories: m.calories,
      }))
    }

    // Active goals with progress
    if (goalsStore.activeGoals && goalsStore.activeGoals.length > 0) {
      context.activeGoals = goalsStore.activeGoals.map((g) => ({
        title: g.title,
        description: g.description,
        progress: goalsStore.goalProgress(g),
      }))
    }

    // Daily state
    context.energy = userStore.energy
    context.sleepQuality = userStore.sleepQuality
    context.sleepHours = userStore.sleepHours

    return context
  }

  async function sendMessage(text) {
    // Push user message
    messages.value.push({ role: 'user', content: text })
    isLoading.value = true

    try {
      const context = buildContext()

      // Build conversation history (last 18 messages for context window)
      const history = messages.value
        .slice(-19, -1)
        .map((m) => ({ role: m.role, content: m.content }))

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: text,
          context,
          conversationHistory: history,
          difficulty: context.difficulty || 'medium',
        },
      })

      if (error) throw error

      // Push assistant response
      const assistantMsg = {
        role: 'assistant',
        content: data.message,
        actions: data.actions || [],
      }
      messages.value.push(assistantMsg)

      return data
    } catch (err) {
      // Push error message so user sees feedback
      messages.value.push({
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        error: true,
      })
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    isOpen,
    messages,
    isLoading,
    currentPage,
    open,
    close,
    clearHistory,
    buildContext,
    sendMessage,
  }
})
