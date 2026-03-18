import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true }
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/OnboardingView.vue')
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue')
  },
  {
    path: '/fitness',
    name: 'fitness',
    component: () => import('@/views/FitnessView.vue')
  },
  {
    path: '/fitness/workout/:id',
    name: 'workout',
    component: () => import('@/views/WorkoutView.vue')
  },
  {
    path: '/meals',
    name: 'meals',
    component: () => import('@/views/MealsView.vue')
  },
  {
    path: '/goals',
    name: 'goals',
    component: () => import('@/views/GoalsView.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue')
  }
]

const router = createRouter({
  history: createWebHistory('/life-os/'),
  routes
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Wait for auth to finish initialising
  if (auth.loading) {
    await auth.init()
  }

  const isPublic = to.meta?.public === true

  // Not authenticated → redirect to login
  if (!isPublic && !auth.isAuthenticated) {
    return { path: '/' }
  }

  // Already authenticated → skip login page
  if (to.path === '/' && auth.isAuthenticated) {
    return { path: '/dashboard' }
  }
})

export default router
