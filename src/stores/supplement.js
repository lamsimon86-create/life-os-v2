import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useSupplementStore = defineStore('supplement', () => {
  const supplements = ref([])
  const todaysLogs = ref([])
  const loading = ref(false)

  const todaysSupplements = computed(() => {
    const today = new Date().getDay() // 0=Sun, 1=Mon, ...
    return supplements.value
      .filter(s => {
        if (!s.is_active) return false
        if (s.frequency === 'daily') return true
        try {
          const days = JSON.parse(s.frequency)
          return Array.isArray(days) && days.includes(today)
        } catch { return true }
      })
      .sort((a, b) => a.sort_order - b.sort_order)
  })

  const supplementStatus = computed(() => {
    const due = todaysSupplements.value.length
    const takenIds = new Set(todaysLogs.value.map(l => l.supplement_id))
    const taken = todaysSupplements.value.filter(s => takenIds.has(s.id)).length
    return { taken, due }
  })

  function isTaken(supplementId) {
    return todaysLogs.value.some(l => l.supplement_id === supplementId)
  }

  async function hydrate() {
    loading.value = true
    try {
      const { data: supps } = await supabase
        .from('v2_supplements')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      supplements.value = supps || []

      const today = new Date().toISOString().split('T')[0]
      const { data: logs } = await supabase
        .from('v2_supplement_logs')
        .select('*')
        .eq('date', today)

      todaysLogs.value = logs || []
    } finally {
      loading.value = false
    }
  }

  async function toggleSupplement(supplementId) {
    const today = new Date().toISOString().split('T')[0]
    const existing = todaysLogs.value.find(l => l.supplement_id === supplementId)

    if (existing) {
      // Undo — delete the log
      await supabase.from('v2_supplement_logs').delete().eq('id', existing.id)
      todaysLogs.value = todaysLogs.value.filter(l => l.id !== existing.id)
    } else {
      // Mark as taken
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('v2_supplement_logs')
        .insert({ user_id: user.id, supplement_id: supplementId, date: today })
        .select()
        .single()

      if (data) todaysLogs.value.push(data)
    }
  }

  async function addSupplement(name, frequency = 'daily') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const maxOrder = supplements.value.reduce((max, s) => Math.max(max, s.sort_order || 0), 0)
    const { data } = await supabase
      .from('v2_supplements')
      .insert({ user_id: user.id, name, frequency, sort_order: maxOrder + 1 })
      .select()
      .single()

    if (data) supplements.value.push(data)
  }

  async function removeSupplement(id) {
    await supabase.from('v2_supplements').update({ is_active: false }).eq('id', id)
    supplements.value = supplements.value.filter(s => s.id !== id)
  }

  return {
    supplements, todaysLogs, loading,
    todaysSupplements, supplementStatus, isTaken,
    hydrate, toggleSupplement, addSupplement, removeSupplement
  }
})
