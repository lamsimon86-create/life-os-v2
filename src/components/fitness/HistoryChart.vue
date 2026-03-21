<template>
  <div>
    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Progression</div>

    <!-- Exercise selector -->
    <select
      v-model="selectedExercise"
      class="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500 mb-3"
    >
      <option value="" disabled>Select exercise</option>
      <option v-for="name in exerciseNames" :key="name" :value="name">{{ name }}</option>
    </select>

    <!-- Loading -->
    <div v-if="loadingHistory" class="flex justify-center py-6">
      <LoadingSpinner />
    </div>

    <!-- Chart -->
    <div
      v-else-if="selectedExercise && chartData.length > 0"
      class="bg-slate-800 rounded-lg p-3"
    >
      <canvas ref="canvasRef" class="h-48" style="height: 12rem;"></canvas>
    </div>

    <!-- No data -->
    <p
      v-else-if="selectedExercise && chartData.length === 0 && !loadingHistory"
      class="text-sm text-slate-500 text-center py-6"
    >
      No data yet for {{ selectedExercise }}.
    </p>

    <!-- Prompt -->
    <div
      v-if="!selectedExercise"
      class="text-sm text-slate-500 text-center py-4"
    >
      Select an exercise to see progression
    </div>

    <!-- Stats row -->
    <div
      v-if="stats && !loadingHistory"
      class="flex justify-between mt-2 p-2 bg-slate-800 rounded-lg"
    >
      <div class="text-center flex-1">
        <div class="text-xs text-slate-500 mb-0.5">Best</div>
        <div class="text-sm font-semibold text-white">{{ stats.bestWeight }} lbs</div>
      </div>
      <div class="text-center flex-1">
        <div class="text-xs text-slate-500 mb-0.5">Est 1RM</div>
        <div class="text-sm font-semibold text-purple-400">{{ stats.est1rm }} lbs</div>
      </div>
      <div class="text-center flex-1">
        <div class="text-xs text-slate-500 mb-0.5">Progress</div>
        <div
          class="text-sm font-semibold"
          :class="stats.progressSign === '+' ? 'text-emerald-400' : stats.progressSign === '-' ? 'text-red-400' : 'text-slate-400'"
        >
          {{ stats.progress }}
        </div>
      </div>
      <div class="text-center flex-1">
        <div class="text-xs text-slate-500 mb-0.5">Sessions</div>
        <div class="text-sm font-semibold text-white">{{ stats.sessions }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import { useFitnessStore } from '@/stores/fitness'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

Chart.register(...registerables)

const fitnessStore = useFitnessStore()
const authStore = useAuthStore()

const selectedExercise = ref('')
const exerciseNames = ref([])
const chartData = ref([])
const loadingHistory = ref(false)
const canvasRef = ref(null)
let chartInstance = null

// Stats derived from chart data
const stats = computed(() => {
  if (chartData.value.length === 0) return null

  const weights = chartData.value.map(d => d.weight)
  const bestWeight = Math.max(...weights)

  // Best 1RM across all sessions
  const best1rmSet = chartData.value.reduce((best, d) => {
    const est = Math.round(d.weight * (1 + d.reps / 30))
    return est > best.est ? { est, d } : best
  }, { est: 0, d: null })
  const est1rm = best1rmSet.est

  // Progress: compare last data point weight vs first
  const first = chartData.value[0]
  const last = chartData.value[chartData.value.length - 1]
  const weightDiff = last.weight - first.weight
  const progressSign = weightDiff > 0 ? '+' : weightDiff < 0 ? '-' : ''

  // Week span
  let weekSpan = ''
  if (chartData.value.length > 1) {
    const firstDate = new Date(chartData.value[0].rawDate)
    const lastDate = new Date(chartData.value[chartData.value.length - 1].rawDate)
    const weeks = Math.max(1, Math.round((lastDate - firstDate) / (7 * 24 * 60 * 60 * 1000)))
    weekSpan = ` / ${weeks} wk${weeks !== 1 ? 's' : ''}`
  }

  const progress = weightDiff === 0
    ? '—'
    : `${progressSign}${Math.abs(weightDiff)} lbs${weekSpan}`

  return {
    bestWeight,
    est1rm,
    progress,
    progressSign,
    sessions: chartData.value.length
  }
})

// Fetch distinct exercise names from workout_sets (names actually logged)
async function loadExerciseNames() {
  if (!authStore.userId) return
  const { data } = await supabase
    .from('v2_workout_sets')
    .select('exercise_name')
    .eq('user_id', authStore.userId)
    .eq('is_warmup', false)
  if (data && data.length > 0) {
    const names = [...new Set(data.map(s => s.exercise_name))].sort()
    exerciseNames.value = names
  } else {
    // Fall back to exercise library names
    exerciseNames.value = fitnessStore.exerciseNames
  }
}

watch(selectedExercise, async (name) => {
  if (!name) {
    chartData.value = []
    destroyChart()
    return
  }

  loadingHistory.value = true
  destroyChart()

  try {
    const history = await fitnessStore.fetchExerciseHistory(name)

    // Group by date (YYYY-MM-DD), find best set per date (max weight; tie-break by highest 1RM)
    const byDate = {}
    for (const s of history) {
      const rawDate = s.created_at.split('T')[0]
      const date = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const existing = byDate[rawDate]
      if (!existing || s.weight > existing.weight || (s.weight === existing.weight && s.reps > existing.reps)) {
        byDate[rawDate] = { weight: s.weight, reps: s.reps, date, rawDate }
      }
    }

    chartData.value = Object.values(byDate).sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    await nextTick()
    renderChart()
  } finally {
    loadingHistory.value = false
  }
})

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
}

function renderChart() {
  if (!canvasRef.value || chartData.value.length === 0) return
  destroyChart()

  const labels = chartData.value.map(d => d.date)
  const weightData = chartData.value.map(d => d.weight)
  const oneRmData = chartData.value.map(d => Math.round(d.weight * (1 + d.reps / 30)))

  const ctx = canvasRef.value.getContext('2d')
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Best Set (lbs)',
          data: weightData,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#0ea5e9',
          borderWidth: 2,
          order: 1
        },
        {
          label: 'Est 1RM (lbs)',
          data: oneRmData,
          borderColor: '#a855f7',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#a855f7',
          borderWidth: 2,
          borderDash: [5, 4],
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#94a3b8',
            font: { size: 10 },
            boxWidth: 16,
            padding: 8,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => {
              const d = chartData.value[item.dataIndex]
              if (item.datasetIndex === 0) {
                return ` Best: ${d.weight} lbs x ${d.reps} reps`
              }
              return ` Est 1RM: ${Math.round(d.weight * (1 + d.reps / 30))} lbs`
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 10 } },
          grid: { color: 'rgba(100, 116, 139, 0.15)' }
        },
        y: {
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            callback: (v) => `${v}`
          },
          grid: { color: 'rgba(100, 116, 139, 0.15)' }
        }
      }
    }
  })
}

onMounted(async () => {
  await loadExerciseNames()
  if (exerciseNames.value.length > 0 && !selectedExercise.value) {
    selectedExercise.value = exerciseNames.value[0]
  }
})

onUnmounted(() => {
  destroyChart()
})
</script>
