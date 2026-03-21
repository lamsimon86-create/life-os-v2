<template>
  <div class="min-h-screen bg-slate-950 px-4 py-6">
    <div class="mx-auto max-w-md">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="cancel" class="text-slate-400 hover:text-slate-200">
          <ArrowLeft class="w-5 h-5" />
        </button>
        <h1 class="text-lg font-bold">Edit Day</h1>
      </div>

      <div v-if="loading" class="text-center text-slate-500">Loading...</div>

      <div v-else class="space-y-4">
        <!-- Day name -->
        <div>
          <label class="text-xs text-slate-500 mb-1 block">Day Name</label>
          <input
            v-model="dayName"
            class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Rest day toggle -->
        <div class="flex justify-between items-center">
          <span class="text-sm text-slate-300">Rest Day</span>
          <button
            @click="toggleRestDay"
            class="px-3 py-1 rounded-lg text-xs font-semibold"
            :class="isRestDay ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'"
          >
            {{ isRestDay ? 'Make Training Day' : 'Make Rest Day' }}
          </button>
        </div>

        <!-- Exercise list -->
        <div v-if="!isRestDay" class="space-y-2">
          <div
            v-for="(ex, idx) in exercises"
            :key="ex.id"
            class="bg-slate-800 rounded-lg p-3"
          >
            <div class="flex items-center gap-2 mb-2">
              <!-- Reorder buttons -->
              <div class="flex flex-col gap-0.5">
                <button @click="moveUp(idx)" :disabled="idx === 0"
                  class="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-xs">&#9650;</button>
                <button @click="moveDown(idx)" :disabled="idx === exercises.length - 1"
                  class="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-xs">&#9660;</button>
              </div>
              <div class="flex-1 text-sm font-semibold">{{ ex.exercise_name }}</div>
              <button @click="removeExercise(ex.id, idx)" class="text-red-400 hover:text-red-300">
                <X class="w-4 h-4" />
              </button>
            </div>
            <div class="flex gap-3">
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-slate-500">Sets</span>
                <input v-model.number="ex.target_sets" type="number" min="1" max="10"
                  class="bg-slate-700 border-none text-slate-100 w-10 text-center rounded px-1 py-0.5 text-xs" />
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-slate-500">Reps</span>
                <input v-model.number="ex.target_reps_min" type="number" min="1"
                  class="bg-slate-700 border-none text-slate-100 w-10 text-center rounded px-1 py-0.5 text-xs" />
                <span class="text-[10px] text-slate-500">-</span>
                <input v-model.number="ex.target_reps_max" type="number" min="1"
                  class="bg-slate-700 border-none text-slate-100 w-10 text-center rounded px-1 py-0.5 text-xs" />
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-slate-500">Rest</span>
                <input v-model.number="ex.rest_seconds" type="number" min="0" step="15"
                  class="bg-slate-700 border-none text-slate-100 w-12 text-center rounded px-1 py-0.5 text-xs" />
                <span class="text-[9px] text-slate-500">s</span>
              </div>
            </div>
          </div>

          <!-- Add exercise -->
          <button @click="showSearch = true"
            class="w-full py-3 border border-dashed border-slate-600 rounded-lg text-blue-400 text-sm font-semibold hover:border-blue-500">
            + Add Exercise
          </button>
        </div>

        <!-- Save / Cancel -->
        <div class="flex gap-3 pt-4">
          <button @click="cancel" class="flex-1 py-2 bg-slate-700 rounded-lg text-sm text-slate-300">Cancel</button>
          <button @click="save" :disabled="saving"
            class="flex-1 py-2 bg-green-500 rounded-lg text-sm font-bold text-slate-900 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>

      <ExerciseSearch
        :visible="showSearch"
        title="Add Exercise"
        @select="addExercise"
        @close="showSearch = false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, X } from 'lucide-vue-next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useFitnessStore } from '@/stores/fitness'
import { useToast } from '@/composables/useToast'
import ExerciseSearch from '@/components/fitness/ExerciseSearch.vue'

const route = useRoute()
const router = useRouter()
const fitnessStore = useFitnessStore()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const showSearch = ref(false)
const dayName = ref('')
const isRestDay = ref(false)
const exercises = ref([])
const dayId = route.params.dayId

onMounted(async () => {
  const user = useAuthStore().user
  const { data: day } = await supabase
    .from('v2_program_days')
    .select('*, v2_program_exercises(*)')
    .eq('id', dayId)
    .eq('user_id', user.id)
    .single()

  if (!day) { router.push('/fitness'); return }

  dayName.value = day.name || ''
  isRestDay.value = day.is_rest_day || false
  exercises.value = (day.v2_program_exercises || [])
    .sort((a, b) => a.sort_order - b.sort_order)
  loading.value = false
})

function toggleRestDay() {
  isRestDay.value = !isRestDay.value
  if (isRestDay.value) exercises.value = []
}

function moveUp(idx) {
  if (idx === 0) return
  const temp = exercises.value[idx]
  exercises.value[idx] = exercises.value[idx - 1]
  exercises.value[idx - 1] = temp
  exercises.value = [...exercises.value]
}

function moveDown(idx) {
  if (idx === exercises.value.length - 1) return
  const temp = exercises.value[idx]
  exercises.value[idx] = exercises.value[idx + 1]
  exercises.value[idx + 1] = temp
  exercises.value = [...exercises.value]
}

async function addExercise(exercise) {
  await fitnessStore.addExerciseToDay(dayId, {
    name: exercise.name,
    sets: 3,
    reps_min: 8,
    reps_max: 12,
    rest_seconds: 90
  })
  const user = useAuthStore().user
  const { data } = await supabase
    .from('v2_program_exercises')
    .select('*')
    .eq('program_day_id', dayId)
    .eq('user_id', user.id)
    .order('sort_order')
  exercises.value = data || []
  showSearch.value = false
}

async function removeExercise(exerciseId, idx) {
  if (exercises.value.length === 1) {
    if (!confirm('Remove the last exercise? Consider making this a rest day instead.')) return
  }
  await fitnessStore.removeExerciseFromDay(exerciseId)
  exercises.value.splice(idx, 1)
}

async function save() {
  saving.value = true
  try {
    await fitnessStore.updateProgramDay(dayId, {
      name: dayName.value,
      is_rest_day: isRestDay.value
    })

    if (!isRestDay.value) {
      const ids = exercises.value.map(e => e.id)
      await fitnessStore.reorderExercises(dayId, ids)
      for (const ex of exercises.value) {
        await fitnessStore.updateExercise(ex.id, {
          target_sets: ex.target_sets,
          target_reps_min: ex.target_reps_min,
          target_reps_max: ex.target_reps_max,
          rest_seconds: ex.rest_seconds
        })
      }
    }

    toast.show('Day updated')
    router.push('/fitness')
  } catch (err) {
    toast.show('Failed to save')
  } finally {
    saving.value = false
  }
}

function cancel() {
  router.push('/fitness')
}
</script>
