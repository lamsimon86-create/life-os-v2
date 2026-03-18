<template>
  <div class="rounded-xl bg-slate-900 border border-slate-800 p-4">
    <h3 class="text-sm font-semibold text-white mb-3">Exercise Progress</h3>

    <!-- Exercise dropdown -->
    <select
      v-model="selectedExercise"
      class="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500 mb-4"
    >
      <option value="" disabled>Select exercise</option>
      <option
        v-for="name in exerciseNames"
        :key="name"
        :value="name"
      >
        {{ name }}
      </option>
    </select>

    <!-- Chart -->
    <div v-if="selectedExercise && chartData.length > 0" class="h-48">
      <canvas ref="canvasRef" />
    </div>

    <p
      v-else-if="selectedExercise && chartData.length === 0 && !loadingHistory"
      class="text-sm text-slate-500 text-center py-8"
    >
      No data yet for {{ selectedExercise }}.
    </p>

    <p
      v-else-if="!selectedExercise"
      class="text-sm text-slate-500 text-center py-8"
    >
      Choose an exercise to view your progress over time.
    </p>

    <div v-if="loadingHistory" class="flex justify-center py-8">
      <LoadingSpinner />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import { useFitnessStore } from '@/stores/fitness'

Chart.register(...registerables)

const props = defineProps({
  logs: {
    type: Array,
    default: () => []
  }
})

const fitnessStore = useFitnessStore()

const selectedExercise = ref('')
const chartData = ref([])
const loadingHistory = ref(false)
const canvasRef = ref(null)
let chartInstance = null

// Derive unique exercise names from all logs' sets
const exerciseNames = ref([])

// Extract exercise names from sets in recent logs
async function loadExerciseNames() {
  const names = new Set()
  for (const log of props.logs) {
    if (log.id) {
      const sets = await fitnessStore.fetchSetsForLog(log.id)
      for (const s of sets) {
        names.add(s.exercise_name)
      }
    }
  }
  exerciseNames.value = [...names].sort()
  if (exerciseNames.value.length > 0 && !selectedExercise.value) {
    selectedExercise.value = exerciseNames.value[0]
  }
}

watch(() => props.logs, loadExerciseNames, { immediate: true })

watch(selectedExercise, async (name) => {
  if (!name) return

  loadingHistory.value = true
  try {
    const history = await fitnessStore.fetchExerciseHistory(name)

    // Group by date, find best set (highest weight) per date
    const byDate = {}
    for (const s of history) {
      const date = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!byDate[date] || s.weight > byDate[date].weight) {
        byDate[date] = { weight: s.weight, reps: s.reps, date }
      }
    }

    chartData.value = Object.values(byDate)
    await nextTick()
    renderChart()
  } finally {
    loadingHistory.value = false
  }
})

function renderChart() {
  if (!canvasRef.value || chartData.value.length === 0) return

  if (chartInstance) {
    chartInstance.destroy()
  }

  const ctx = canvasRef.value.getContext('2d')
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.value.map(d => d.date),
      datasets: [{
        label: 'Best Set (lbs)',
        data: chartData.value.map(d => d.weight),
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#0ea5e9'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = chartData.value[ctx.dataIndex]
              return `${d.weight} lbs x ${d.reps} reps`
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
          ticks: { color: '#64748b', font: { size: 10 } },
          grid: { color: 'rgba(100, 116, 139, 0.15)' }
        }
      }
    }
  })
}

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>
