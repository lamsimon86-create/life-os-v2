import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { getLevelForXp, getXpProgress } from '@/lib/gamification'
import { getAvatarStage, getNextStage } from '@/lib/avatar'
import { getMondayWeekStart } from '@/lib/constants'

export const useUserStore = defineStore('user', () => {
  const profile = ref(null)
  const energy = ref(null)
  const sleepQuality = ref(null)
  const sleepHours = ref(null)
  const loading = ref(false)
  const waterGlasses = ref(0)
  const weeklyWater = ref(0)

  const name = computed(() => profile.value?.name || '')
  const xp = computed(() => profile.value?.xp || 0)
  const level = computed(() => profile.value?.level || 1)
  const streak = computed(() => profile.value?.streak || 0)
  const difficulty = computed(() => profile.value?.difficulty || 'medium')
  const preferences = computed(() => profile.value?.preferences || {})
  const onboardingComplete = computed(() => profile.value?.onboarding_complete || false)
  const levelInfo = computed(() => getLevelForXp(xp.value))
  const xpProgress = computed(() => getXpProgress(xp.value))
  const dailyCheckinDone = computed(() => energy.value !== null)
  const waterGoal = computed(() => {
    const prefs = profile.value?.preferences
    return prefs?.daily_water_goal || 8
  })
  const avatarStage = computed(() => getAvatarStage(level.value || 1))
  const avatarNextStage = computed(() => getNextStage(level.value || 1))

  async function hydrate() {
    const auth = useAuthStore()
    if (!auth.userId) return

    loading.value = true
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('v2_profiles')
        .select('*')
        .eq('user_id', auth.userId)
        .maybeSingle()

      if (profileError) throw profileError
      profile.value = profileData || null

      const today = new Date().toISOString().split('T')[0]
      const { data: logData } = await supabase
        .from('v2_daily_logs')
        .select('*')
        .eq('user_id', auth.userId)
        .eq('date', today)
        .maybeSingle()

      if (logData) {
        energy.value = logData.energy
        sleepQuality.value = logData.sleep_quality
        sleepHours.value = logData.sleep_hours
        waterGlasses.value = logData?.water_glasses || 0
      }

      // Fetch weekly water total
      const weekStart = getMondayWeekStart()
      const { data: waterData } = await supabase
        .from('v2_daily_logs')
        .select('water_glasses')
        .eq('user_id', auth.userId)
        .gte('date', weekStart)

      weeklyWater.value = (waterData || []).reduce((sum, d) => sum + (d.water_glasses || 0), 0)
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

  async function addWater() {
    waterGlasses.value++
    weeklyWater.value++
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('v2_daily_logs')
      .upsert({
        user_id: user.id,
        date: today,
        water_glasses: waterGlasses.value
      }, { onConflict: 'user_id,date' })
  }

  return {
    profile,
    energy,
    sleepQuality,
    sleepHours,
    loading,
    waterGlasses,
    weeklyWater,
    name,
    xp,
    level,
    streak,
    difficulty,
    preferences,
    onboardingComplete,
    levelInfo,
    xpProgress,
    dailyCheckinDone,
    waterGoal,
    avatarStage,
    avatarNextStage,
    hydrate,
    updateProfile,
    addXp,
    logDailyState,
    addWater,
  }
})
