import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref([])
  const connected = ref(false)
  const loading = ref(false)

  const todaysEvents = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return events.value
      .filter(e => {
        const eventDate = e.start_time?.split('T')[0]
        return eventDate === today
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  })

  const nextEvent = computed(() => {
    const now = new Date()
    return todaysEvents.value.find(e => new Date(e.start_time) > now) || null
  })

  async function hydrate() {
    loading.value = true
    try {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('v2_calendar_events')
        .select('*')
        .gte('start_time', today)
        .lt('start_time', tomorrow)
        .order('start_time')

      if (error) {
        connected.value = false
        events.value = []
        return
      }

      events.value = data || []

      if (data && data.length > 0) {
        connected.value = true
      } else {
        const { count } = await supabase
          .from('v2_calendar_events')
          .select('id', { count: 'exact', head: true })

        connected.value = (count || 0) > 0
      }
    } catch (e) {
      connected.value = false
      events.value = []
    } finally {
      loading.value = false
    }
  }

  return {
    events, connected, loading,
    todaysEvents, nextEvent,
    hydrate
  }
})
