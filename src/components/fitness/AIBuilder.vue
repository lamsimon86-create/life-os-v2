<template>
  <div class="space-y-4">
    <div class="text-center">
      <h2 class="text-lg font-bold text-white">Build Your Program</h2>
      <p class="text-xs text-slate-400">AI creates a personalized training plan</p>
    </div>

    <!-- Step 1: Days -->
    <div v-if="step === 1" class="space-y-3">
      <div class="text-xs text-slate-500 uppercase font-semibold tracking-wide">Available Days</div>
      <div class="grid grid-cols-7 gap-1.5">
        <button
          v-for="(label, idx) in dayLabels"
          :key="idx"
          @click="toggleDay(idx)"
          class="py-2 rounded-lg text-xs font-semibold transition-colors"
          :class="selectedDays.includes(idx) ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'"
        >
          {{ label }}
        </button>
      </div>
      <p class="text-xs text-slate-500 text-center">
        {{ selectedDays.length }} day{{ selectedDays.length !== 1 ? 's' : '' }} selected
        <span v-if="selectedDays.length < 2"> — pick at least 2</span>
      </p>
      <button
        @click="step = 2"
        :disabled="selectedDays.length < 2"
        class="w-full py-2 bg-blue-500 rounded-lg text-sm font-bold text-white disabled:opacity-40 transition-opacity"
      >
        Next
      </button>
    </div>

    <!-- Step 2: Details -->
    <div v-if="step === 2" class="space-y-3">
      <div>
        <label class="text-xs text-slate-500 uppercase font-semibold tracking-wide block mb-1.5">Goal</label>
        <select
          v-model="goal"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option v-for="opt in goalOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>

      <div>
        <label class="text-xs text-slate-500 uppercase font-semibold tracking-wide block mb-1.5">Experience</label>
        <select
          v-model="experience"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option v-for="opt in experienceOptions" :key="opt" :value="opt" class="capitalize">{{ opt.charAt(0).toUpperCase() + opt.slice(1) }}</option>
        </select>
      </div>

      <div>
        <label class="text-xs text-slate-500 uppercase font-semibold tracking-wide block mb-1.5">
          Injuries / Limitations <span class="normal-case text-slate-600">(optional)</span>
        </label>
        <input
          v-model="injuries"
          type="text"
          placeholder="e.g. bad knees, shoulder pain"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div class="flex gap-2">
        <button
          @click="step = 1"
          class="flex-1 py-2 bg-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-600 transition-colors"
        >
          Back
        </button>
        <button
          @click="generate"
          class="flex-1 py-2 bg-green-500 rounded-lg text-sm font-bold text-slate-900 hover:bg-green-400 transition-colors"
        >
          Generate Program
        </button>
      </div>
    </div>

    <!-- Step 3: Result -->
    <div v-if="step === 3" class="space-y-4">

      <!-- Loading -->
      <div v-if="generating" class="py-8 text-center space-y-3">
        <div class="flex justify-center">
          <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p class="text-sm text-slate-400">Building your program...</p>
        <p class="text-xs text-slate-600">This may take a few seconds</p>
      </div>

      <!-- Success: Preview -->
      <div v-else-if="generatedProgram && !generateError" class="space-y-3">
        <div class="rounded-xl bg-slate-800 border border-slate-700 p-4">
          <p class="text-base font-bold text-white mb-3">{{ generatedProgram.name }}</p>
          <div class="space-y-1.5">
            <div
              v-for="day in previewDays"
              :key="day.day_of_week"
              class="flex items-center justify-between text-xs"
            >
              <span class="text-slate-400 w-10">{{ dayLabels[day.day_of_week] }}</span>
              <span class="flex-1 text-slate-200 px-2">{{ day.name }}</span>
              <span v-if="!day.is_rest_day" class="text-slate-500">{{ day.exercises?.length || 0 }} exercises</span>
              <span v-else class="text-slate-600">Rest</span>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            @click="regenerate"
            class="flex-1 py-2 bg-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Regenerate
          </button>
          <button
            @click="accept"
            :disabled="saving"
            class="flex-1 py-2 bg-green-500 rounded-lg text-sm font-bold text-slate-900 hover:bg-green-400 disabled:opacity-50 transition-colors"
          >
            {{ saving ? 'Saving...' : 'Accept & Activate' }}
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="generateError" class="space-y-3">
        <div class="rounded-xl bg-red-900/20 border border-red-700/30 p-4">
          <p class="text-sm text-red-400 font-medium mb-1">Generation failed</p>
          <p class="text-xs text-slate-400">{{ generateError }}</p>
        </div>
        <div class="flex gap-2">
          <button
            @click="step = 2"
            class="flex-1 py-2 bg-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Back
          </button>
          <button
            @click="useFallbackTemplate"
            class="flex-1 py-2 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-500 transition-colors"
          >
            Try a template instead
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFitnessStore } from '@/stores/fitness'
import { PROGRAM_TEMPLATES } from '@/lib/program-templates'

const emit = defineEmits(['program-created'])

const fitnessStore = useFitnessStore()

// Step state
const step = ref(1)

// Step 1: day selection
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const selectedDays = ref([])

function toggleDay(idx) {
  const pos = selectedDays.value.indexOf(idx)
  if (pos === -1) {
    selectedDays.value.push(idx)
  } else {
    selectedDays.value.splice(pos, 1)
  }
}

// Step 2: details
const goalOptions = ['Build Muscle', 'Lose Fat', 'Build Strength', 'General Fitness']
const experienceOptions = ['beginner', 'intermediate', 'advanced']
const goal = ref('Build Muscle')
const experience = ref('beginner')
const injuries = ref('')

// Step 3: result
const generating = ref(false)
const saving = ref(false)
const generatedProgram = ref(null)
const generateError = ref(null)

const previewDays = computed(() => {
  if (!generatedProgram.value?.days) return []
  return [...generatedProgram.value.days].sort((a, b) => a.day_of_week - b.day_of_week)
})

async function generate() {
  generating.value = true
  generateError.value = null
  generatedProgram.value = null
  step.value = 3

  // Map day indices to day names for the AI prompt
  const dayNames = selectedDays.value
    .slice()
    .sort((a, b) => a - b)
    .map(idx => dayLabels[idx])

  try {
    // createProgramFromAI saves to DB and calls hydrate internally.
    // We need the raw response to preview first, so we bypass the store's
    // all-in-one method and call the AI + parse separately — then let accept() save it.
    const program = await fetchAIProgram(dayNames)
    generatedProgram.value = program
  } catch (err) {
    generateError.value = err?.message || 'Something went wrong. Try again.'
  } finally {
    generating.value = false
  }
}

async function fetchAIProgram(dayNames) {
  const { supabase } = await import('@/lib/supabase')
  const { useUserStore } = await import('@/stores/user')
  const userStore = useUserStore()

  const prompt = `Build a training program for the user:

Available days: ${dayNames.join(', ')}
Goal: ${goal.value}
Experience: ${experience.value}
Injuries/limitations: ${injuries.value || 'none'}
Current weight: ${userStore.profile?.weight_kg || 'unknown'} lbs

Respond with JSON only:
{
  "name": "Program Name",
  "days": [
    {
      "day_of_week": 0,
      "name": "Day Name",
      "focus": "Muscle focus",
      "is_rest_day": false,
      "exercises": [
        { "name": "Exercise Name", "sets": 3, "reps_min": 8, "reps_max": 10, "rest_seconds": 90 }
      ]
    }
  ]
}

Rules:
- Only schedule training on the available days: ${dayNames.join(', ')}
- Day indices: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
- All other days must be included as rest days (is_rest_day: true, exercises: [])
- Include all 7 days (0-6) in the response
- Use standard exercise names
- Compound movements first, isolation last
- If injuries are noted, avoid exercises that stress those areas`

  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      message: prompt,
      context: { page: 'fitness', task: 'program_generation' },
      conversationHistory: [],
      difficulty: userStore.difficulty || 'medium'
    }
  })

  if (error) throw error

  const match = data.message.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI did not return valid JSON. Please try again.')

  const parsed = JSON.parse(match[0])
  if (!parsed.name || !Array.isArray(parsed.days)) {
    throw new Error('AI returned an unexpected format. Please try again.')
  }

  return parsed
}

async function accept() {
  if (!generatedProgram.value) return
  saving.value = true
  try {
    await fitnessStore.createProgramFromTemplate({
      name: generatedProgram.value.name,
      days: generatedProgram.value.days.map(d => ({
        day_of_week: d.day_of_week,
        name: d.name,
        focus: d.focus || '',
        is_rest_day: !!d.is_rest_day,
        exercises: (d.exercises || []).map(e => ({
          name: e.name,
          sets: e.sets,
          reps_min: e.reps_min,
          reps_max: e.reps_max,
          rest: e.rest_seconds
        }))
      }))
    })
    emit('program-created')
  } catch (err) {
    generateError.value = err?.message || 'Failed to save program.'
    generatedProgram.value = null
  } finally {
    saving.value = false
  }
}

function regenerate() {
  const dayNames = selectedDays.value
    .slice()
    .sort((a, b) => a - b)
    .map(idx => dayLabels[idx])

  generating.value = true
  generateError.value = null
  generatedProgram.value = null

  fetchAIProgram(dayNames)
    .then(program => { generatedProgram.value = program })
    .catch(err => { generateError.value = err?.message || 'Something went wrong.' })
    .finally(() => { generating.value = false })
}

async function useFallbackTemplate() {
  // Pick a sensible template based on day count
  const count = selectedDays.value.length
  let tmpl
  if (count <= 3) {
    tmpl = PROGRAM_TEMPLATES.find(t => t.name.includes('Full Body'))
  } else if (count <= 4) {
    tmpl = PROGRAM_TEMPLATES.find(t => t.name.includes('Upper/Lower'))
  } else {
    tmpl = PROGRAM_TEMPLATES.find(t => t.name.includes('Push/Pull'))
  }
  if (!tmpl) tmpl = PROGRAM_TEMPLATES[0]

  saving.value = true
  generateError.value = null
  try {
    await fitnessStore.createProgramFromTemplate(tmpl)
    emit('program-created')
  } catch (err) {
    generateError.value = err?.message || 'Failed to create template program.'
  } finally {
    saving.value = false
  }
}
</script>
