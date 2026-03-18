<template>
  <div class="rounded-xl bg-slate-900 border border-slate-800 p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-semibold text-white">{{ program.name }}</h3>
      <span class="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">{{ program.source }}</span>
    </div>

    <div class="space-y-1.5">
      <div
        v-for="day in sortedDays"
        :key="day.id"
        class="flex items-center gap-2 text-sm rounded-lg px-3 py-2 transition-colors"
        :class="day.day_of_week === todayDow
          ? 'bg-brand-600/20 border border-brand-500/40 text-brand-300'
          : 'text-slate-400'"
      >
        <span class="w-10 font-medium shrink-0">{{ dayLabel(day.day_of_week) }}</span>
        <span v-if="day.is_rest_day" class="italic text-slate-500">Rest</span>
        <span v-else>
          {{ day.name }}
          <span v-if="day.focus" class="text-slate-500 ml-1">&mdash; {{ day.focus }}</span>
        </span>
        <span
          v-if="day.day_of_week === todayDow"
          class="ml-auto text-xs text-brand-400 font-medium"
        >Today</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getDayOfWeek } from '@/lib/constants'

const props = defineProps({
  program: {
    type: Object,
    required: true
  }
})

const todayDow = getDayOfWeek()

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayLabel(dow) {
  return DAY_LABELS[dow] || ''
}

const sortedDays = computed(() => {
  if (!props.program?.days) return []
  return [...props.program.days].sort((a, b) => a.day_of_week - b.day_of_week)
})
</script>
