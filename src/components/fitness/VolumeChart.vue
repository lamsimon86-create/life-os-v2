<template>
  <div>
    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Weekly Volume by Muscle Group</div>
    <div v-if="Object.keys(volume).length === 0" class="text-sm text-slate-500">No data this week</div>
    <div v-else class="bg-slate-800 rounded-lg p-3 space-y-2">
      <div v-for="group in sortedGroups" :key="group.name">
        <div class="flex justify-between mb-0.5">
          <span class="text-[11px] capitalize">{{ group.name }}</span>
          <span class="text-[10px] text-slate-500">{{ group.sets }} sets</span>
        </div>
        <div class="bg-slate-700 h-1.5 rounded">
          <div
            class="h-full rounded transition-all"
            :class="barColor(group.name)"
            :style="{ width: `${(group.sets / maxSets) * 100}%` }"
          ></div>
        </div>
      </div>
    </div>
    <div class="text-[9px] text-slate-600 text-center mt-1">
      Based on logged sets this week
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFitnessStore } from '@/stores/fitness'

const fitnessStore = useFitnessStore()
const volume = ref({})

const COLORS = {
  chest: 'bg-blue-500',
  back: 'bg-green-500',
  shoulders: 'bg-purple-400',
  legs: 'bg-amber-500',
  arms: 'bg-cyan-500',
  core: 'bg-pink-500'
}

function barColor(group) {
  return COLORS[group] || 'bg-slate-400'
}

const sortedGroups = computed(() =>
  Object.entries(volume.value)
    .map(([name, sets]) => ({ name, sets }))
    .sort((a, b) => b.sets - a.sets)
)

const maxSets = computed(() => Math.max(...sortedGroups.value.map(g => g.sets), 1))

onMounted(async () => {
  volume.value = await fitnessStore.fetchWeeklyMuscleVolume()
})
</script>
