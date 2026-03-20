<template>
  <div class="min-h-screen bg-slate-950 px-4 py-10">
    <div class="mx-auto max-w-md space-y-8">
      <h1 class="text-2xl font-bold text-slate-100">Settings</h1>

      <form class="space-y-6" @submit.prevent="save">
        <!-- Name -->
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-400">Name</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="Your name"
            class="w-full rounded-lg bg-slate-800 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600"
          />
        </div>

        <!-- Age + Weight -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-400">Age</label>
            <input
              v-model.number="form.age"
              type="number"
              min="1"
              max="120"
              placeholder="Age"
              class="w-full rounded-lg bg-slate-800 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-400">Weight (kg)</label>
            <input
              v-model.number="form.weight_kg"
              type="number"
              min="1"
              step="0.1"
              placeholder="Weight"
              class="w-full rounded-lg bg-slate-800 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
        </div>

        <!-- Difficulty -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-400">Difficulty</label>
          <div class="flex gap-3">
            <button
              v-for="(preset, key) in DIFFICULTY_PRESETS"
              :key="key"
              type="button"
              :class="[
                'flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors',
                form.difficulty === key
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700',
              ]"
              @click="form.difficulty = key"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <!-- Health Tracking -->
        <div class="mt-6">
          <h2 class="text-lg font-bold text-brand-400 mb-4">Health Tracking</h2>

          <div class="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label class="mb-1 block text-sm text-slate-300">Water Goal</label>
              <input v-model.number="waterGoal" type="number" min="1" max="20"
                class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" />
              <span class="text-[10px] text-slate-500">glasses/day</span>
            </div>
            <div>
              <label class="mb-1 block text-sm text-slate-300">Protein Target</label>
              <input v-model.number="proteinTarget" type="number" min="0"
                class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" />
              <span class="text-[10px] text-slate-500">grams/day</span>
            </div>
            <div>
              <label class="mb-1 block text-sm text-slate-300">Calorie Target</label>
              <input v-model.number="calorieTarget" type="number" min="0"
                class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" />
              <span class="text-[10px] text-slate-500">kcal/day</span>
            </div>
          </div>

          <SupplementSettings />
        </div>

        <!-- Save -->
        <button
          type="submit"
          :disabled="saving"
          class="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </form>

      <!-- Toast -->
      <p v-if="toast" class="text-center text-sm text-green-400">{{ toast }}</p>

      <!-- Log Out -->
      <button
        class="w-full rounded-lg bg-slate-800 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-slate-700"
        @click="logout"
      >
        Log Out
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useAuthStore } from '@/stores/auth'
import { DIFFICULTY_PRESETS } from '@/lib/constants'
import SupplementSettings from '@/components/settings/SupplementSettings.vue'
import { useSupplementStore } from '@/stores/supplement'

const router = useRouter()
const user = useUserStore()
const auth = useAuthStore()
const supplementStore = useSupplementStore()

const saving = ref(false)
const toast = ref('')

const form = ref({
  name: '',
  age: null,
  weight_kg: null,
  difficulty: 'medium',
})

const waterGoal = ref(8)
const proteinTarget = ref(150)
const calorieTarget = ref(2200)

onMounted(() => {
  if (user.profile) {
    form.value.name = user.profile.name || ''
    form.value.age = user.profile.age || null
    form.value.weight_kg = user.profile.weight_kg || null
    form.value.difficulty = user.profile.difficulty || 'medium'
    waterGoal.value = user.profile.preferences?.daily_water_goal || 8
    proteinTarget.value = user.profile.preferences?.daily_protein_target || 150
    calorieTarget.value = user.profile.preferences?.daily_calorie_target || 2200
  }
  supplementStore.hydrate()
})

async function save() {
  saving.value = true
  toast.value = ''
  try {
    const preferences = {
      ...user.profile?.preferences,
      daily_water_goal: waterGoal.value,
      daily_protein_target: proteinTarget.value,
      daily_calorie_target: calorieTarget.value,
    }
    await user.updateProfile({
      name: form.value.name,
      age: form.value.age,
      weight_kg: form.value.weight_kg,
      difficulty: form.value.difficulty,
      preferences,
    })
    toast.value = 'Changes saved.'
    setTimeout(() => { toast.value = '' }, 3000)
  } catch (err) {
    toast.value = 'Failed to save. Please try again.'
    console.error(err)
  } finally {
    saving.value = false
  }
}

async function logout() {
  await auth.logout()
  router.push('/')
}
</script>
