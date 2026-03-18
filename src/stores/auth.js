import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!session.value)
  const userId = computed(() => session.value?.user?.id ?? null)

  async function init() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session

    supabase.auth.onAuthStateChange((event, newSession) => {
      if (
        event === 'TOKEN_REFRESHED' ||
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN'
      ) {
        session.value = newSession
      } else if (event === 'SIGNED_OUT') {
        session.value = null
      }
    })

    loading.value = false
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    session.value = data.session
    return data
  }

  async function signup(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    session.value = null
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/life-os/`
    })
    if (error) throw error
  }

  return { session, loading, isAuthenticated, userId, init, login, signup, logout, resetPassword }
})
