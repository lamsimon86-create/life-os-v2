<template>
  <div class="rounded-xl bg-slate-900 border border-slate-800 p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-semibold text-white">{{ program.name }}</h3>
      <div class="flex items-center gap-2">
        <button
          @click="shuffleMode = !shuffleMode"
          class="text-xs px-2 py-1 rounded transition"
          :class="shuffleMode ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'"
        >
          {{ shuffleMode ? 'Done' : 'Shuffle' }}
        </button>
        <span class="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">{{ program.source }}</span>
      </div>
    </div>

    <!-- Shuffle instructions -->
    <p v-if="shuffleMode && !swapSource" class="text-xs text-brand-400 mb-2">
      Tap the day you want to move, then tap where you want it.
    </p>
    <p v-if="shuffleMode && swapSource" class="text-xs text-amber-400 mb-2">
      Now tap the day to swap with {{ dayLabel(swapSource.day_of_week) }} ({{ swapSource.name }})
    </p>

    <div class="space-y-1.5">
      <div
        v-for="day in sortedDays"
        :key="day.id"
        class="flex items-center gap-2 text-sm rounded-lg px-3 py-2 transition-colors cursor-default"
        :class="[
          day.day_of_week === todayDow && !shuffleMode
            ? 'bg-brand-600/20 border border-brand-500/40 text-brand-300'
            : shuffleMode && swapSource?.id === day.id
              ? 'bg-amber-600/20 border border-amber-500/40 text-amber-300'
              : shuffleMode
                ? 'text-slate-300 hover:bg-slate-800 cursor-pointer'
                : 'text-slate-400',
        ]"
        @click="shuffleMode ? handleSwapClick(day) : null"
      >
        <span class="w-10 font-medium shrink-0">{{ dayLabel(day.day_of_week) }}</span>
        <span v-if="day.is_rest_day" class="italic text-slate-500">Rest</span>
        <span v-else>
          {{ day.name }}
          <span v-if="day.focus" class="text-slate-500 ml-1">&mdash; {{ day.focus }}</span>
        </span>
        <span
          v-if="day.day_of_week === todayDow && !shuffleMode"
          class="ml-auto text-xs text-brand-400 font-medium"
        >Today</span>
        <ArrowUpDown
          v-if="shuffleMode && !day.is_rest_day"
          class="ml-auto w-3.5 h-3.5 text-slate-500"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ArrowUpDown } from 'lucide-vue-next'
import { getDayOfWeek } from '@/lib/constants'
import { useFitnessStore } from '@/stores/fitness'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  program: { type: Object, required: true }
})

const fitnessStore = useFitnessStore()
const toast = useToast()

const todayDow = getDayOfWeek()
const shuffleMode = ref(false)
const swapSource = ref(null)

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayLabel(dow) {
  return DAY_LABELS[dow] || ''
}

const sortedDays = computed(() => {
  if (!props.program?.days) return []
  return [...props.program.days].sort((a, b) => a.day_of_week - b.day_of_week)
})

async function handleSwapClick(day) {
  if (!swapSource.value) {
    // First click — select source
    swapSource.value = day
    return
  }

  if (swapSource.value.id === day.id) {
    // Clicked same day — deselect
    swapSource.value = null
    return
  }

  // Second click — swap
  try {
    await fitnessStore.swapDays(swapSource.value.id, day.id)
    toast.show(`Swapped ${swapSource.value.name} ↔ ${day.name}`, 'success')
  } catch (err) {
    toast.show('Failed to swap days', 'error')
  }
  swapSource.value = null
}
</script>
