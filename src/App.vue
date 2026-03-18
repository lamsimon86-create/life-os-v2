<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { useFitnessStore } from '@/stores/fitness'
import { useMealsStore } from '@/stores/meals'
import { useGoalsStore } from '@/stores/goals'
import { useAiStore } from '@/stores/ai'

const route = useRoute()
const auth = useAuthStore()
const user = useUserStore()
const fitness = useFitnessStore()
const meals = useMealsStore()
const goals = useGoalsStore()
const ai = useAiStore()

onMounted(async () => {
  if (!auth.isAuthenticated) return

  // Hydrate user first — needed for onboarding check
  await user.hydrate()

  if (user.onboardingComplete) {
    await Promise.all([
      fitness.hydrate(),
      meals.hydrate(),
      goals.hydrate(),
    ])
  }
})

// Keep AI store in sync with current route
watch(
  () => route.name,
  (name) => {
    if (name) ai.currentPage = name
  }
)
</script>
