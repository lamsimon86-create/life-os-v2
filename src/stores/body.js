import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useBodyStore = defineStore('body', () => {
  const logs = ref([])
  const loading = ref(false)

  const latestLog = computed(() => logs.value[0] || null)
  const previousLog = computed(() => logs.value[1] || null)

  const weightChange = computed(() => {
    if (!latestLog.value || !previousLog.value) return null
    const diff = latestLog.value.weight_lbs - previousLog.value.weight_lbs
    return {
      value: Math.abs(diff).toFixed(1),
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
    }
  })

  const needsMonthlyLog = computed(() => {
    if (!latestLog.value) return true
    const lastDate = new Date(latestLog.value.date)
    const now = new Date()
    // More than 28 days since last log
    return (now - lastDate) / (1000 * 60 * 60 * 24) >= 28
  })

  async function hydrate() {
    loading.value = true
    try {
      const { data } = await supabase
        .from('v2_body_logs')
        .select('*')
        .order('date', { ascending: false })
        .limit(20)

      logs.value = data || []
    } finally {
      loading.value = false
    }
  }

  async function addLog(weightLbs, photoFrontFile, photoSideFile, notes) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let photoFrontUrl = null
    let photoSideUrl = null
    const timestamp = Date.now()

    // Upload photos if provided
    if (photoFrontFile) {
      const path = `${user.id}/${timestamp}-front.jpg`
      const { error } = await supabase.storage.from('progress-photos').upload(path, photoFrontFile)
      if (!error) photoFrontUrl = path
    }

    if (photoSideFile) {
      const path = `${user.id}/${timestamp}-side.jpg`
      const { error } = await supabase.storage.from('progress-photos').upload(path, photoSideFile)
      if (!error) photoSideUrl = path
    }

    const { data } = await supabase
      .from('v2_body_logs')
      .insert({
        user_id: user.id,
        weight_lbs: weightLbs,
        photo_front_url: photoFrontUrl,
        photo_side_url: photoSideUrl,
        notes
      })
      .select()
      .single()

    if (data) {
      logs.value.unshift(data)
    }
  }

  async function getSignedUrl(path) {
    if (!path) return null
    const { data } = await supabase.storage
      .from('progress-photos')
      .createSignedUrl(path, 3600) // 1 hour
    return data?.signedUrl || null
  }

  async function deleteLog(id) {
    const log = logs.value.find(l => l.id === id)
    if (!log) return

    // Delete photos from storage
    const paths = [log.photo_front_url, log.photo_side_url].filter(Boolean)
    if (paths.length > 0) {
      await supabase.storage.from('progress-photos').remove(paths)
    }

    await supabase.from('v2_body_logs').delete().eq('id', id)
    logs.value = logs.value.filter(l => l.id !== id)
  }

  return {
    logs, loading,
    latestLog, previousLog, weightChange, needsMonthlyLog,
    hydrate, addLog, getSignedUrl, deleteLog
  }
})
