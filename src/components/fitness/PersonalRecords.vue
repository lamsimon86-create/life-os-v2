<template>
  <div>
    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Personal Records</div>
    <div v-if="loading" class="text-sm text-slate-500">Loading...</div>
    <div v-else-if="records.length === 0" class="text-sm text-slate-500">No records yet. Start lifting!</div>
    <div v-else class="space-y-1">
      <div
        v-for="pr in records"
        :key="pr.exercise_name"
        class="flex justify-between items-center p-2 bg-slate-800 rounded-lg"
      >
        <div>
          <div class="text-xs font-semibold">{{ pr.exercise_name }}</div>
          <div class="text-[10px] text-slate-500">{{ formatDate(pr.date) }}</div>
        </div>
        <div class="text-right">
          <div class="text-sm font-bold text-amber-400">{{ pr.weight }} lbs</div>
          <div class="text-[10px] text-slate-500">x {{ pr.reps }} reps</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useFitnessStore } from '@/stores/fitness'

const fitnessStore = useFitnessStore()
const loading = ref(true)
const records = ref([])

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(async () => {
  await fitnessStore.fetchPersonalRecords()
  records.value = fitnessStore.personalRecords
  loading.value = false
})
</script>
