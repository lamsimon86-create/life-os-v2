import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { getLevelForXp, getXpProgress } from '@/lib/gamification'

export const useUserStore = defineStore('user', () => {
  const profile = ref(null)
  const energy = ref(null)
  const sleepQuality = ref(null)
  const sleepHours = ref(null)
  const loading = ref(false)

  const name = computed(() => profile.value?.name || '')
  const xp = computed(() => profile.value?.xp || 0)
  const level = computed(() => profile.value?.level || 1)
  const streak = computed(() => profile.value?.streak || 0)
  const difficulty = computed(() => profile.value?.difficulty || 'medium')
  const preferences = computed(() => profile.value?.preferences || {})
  const onboardingComplete = computed(() => profile.value?.onboarding_complete || false)
  const levelInfo = computed(() => getLevelForXp(xp.value))
  const xpProgress = computed(() => getXpProgress(xp.value))

  async function hydrate() {
    const auth = useAuthStore()
    if (!auth.userId) return

    loading.value = true
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('v2_profiles')
        .select('*')
        .eq('user_id', auth.userId)
        .single()

      if (profileError && profileError.code !== 'PGRST116') throw profileError
      profile.value = profileData || null

      const today = new Date().toISOString().split('T')[0]
      const { data: logData } = await supabase
        .from('v2_daily_logs')
        .select('*')
        .eq('user_id', auth.userId)
        .eq('date', today)
        .single()

      if (logData) {
        energy.value = logData.energy
        sleepQuality.value = logData.sleep_quality
        sleepHours.value = logData.sleep_hours
      }
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(updates) {
    if (!profile.value?.id) return

    const { data, error } = await supabase
      .from('v2_profiles')
      .update(updates)
      .eq('id', profile.value.id)
      .select()
      .single()

    if (error) throw error
    profile.value = data
  }

  async function addXp(amount) {
    const newXp = xp.value + amount
    const newLevelInfo = getLevelForXp(newXp)
    await updateProfile({ xp: newXp, level: newLevelInfo.level })
  }

  async function logDailyState(data) {
    const auth = useAuthStore()
    if (!auth.userId) return

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('v2_daily_logs')
      .upsert(
        { user_id: auth.userId, date: today, ...data },
        { onConflict: 'user_id,date' }
      )

    if (error) throw error

    if (data.energy !== undefined) energy.value = data.energy
    if (data.sleep_quality !== undefined) sleepQuality.value = data.sleep_quality
    if (data.sleep_hours !== undefined) sleepHours.value = data.sleep_hours
  }

  return {
    profile,
    energy,
    sleepQuality,
    sleepHours,
    loading,
    name,
    xp,
    level,
    streak,
    difficulty,
    preferences,
    onboardingComplete,
    levelInfo,
    xpProgress,
    hydrate,
    updateProfile,
    addXp,
    logDailyState,
  }
})
