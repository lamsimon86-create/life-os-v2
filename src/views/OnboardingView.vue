<template>
  <div class="min-h-screen bg-slate-950 flex flex-col">
    <!-- Progress bar -->
    <div class="h-1.5 w-full bg-slate-800">
      <div
        class="h-full bg-brand-500 transition-all duration-300"
        :style="{ width: `${(currentStep / totalSteps) * 100}%` }"
      />
    </div>

    <!-- Content -->
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-lg">
        <!-- Step 1: About You -->
        <OnboardingStep
          v-if="currentStep === 1"
          :step="1"
          title="About You"
          subtitle="Tell us a bit about yourself so we can personalise your experience."
        >
          <div class="space-y-4">
            <div>
              <label class="block text-sm text-slate-400 mb-1">Name <span class="text-brand-400">*</span></label>
              <input
                v-model="form.name"
                type="text"
                placeholder="Your name"
                class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500"
              />
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-sm text-slate-400 mb-1">Age</label>
                <input
                  v-model.number="form.age"
                  type="number"
                  placeholder="28"
                  min="13"
                  max="100"
                  class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500"
                />
              </div>
              <div>
                <label class="block text-sm text-slate-400 mb-1">Height (cm)</label>
                <input
                  v-model.number="form.height_cm"
                  type="number"
                  placeholder="175"
                  min="100"
                  max="250"
                  class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500"
                />
              </div>
              <div>
                <label class="block text-sm text-slate-400 mb-1">Weight (lbs)</label>
                <input
                  v-model.number="form.weight_lbs"
                  type="number"
                  placeholder="165"
                  min="50"
                  max="500"
                  class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500"
                />
              </div>
            </div>
          </div>
        </OnboardingStep>

        <!-- Step 2: Your Goal -->
        <OnboardingStep
          v-if="currentStep === 2"
          :step="2"
          title="Your Goal"
          subtitle="What are you working towards? Be specific — the more detail, the better."
        >
          <div>
            <label class="block text-sm text-slate-400 mb-1">Describe your goal</label>
            <textarea
              v-model="form.goal_text"
              rows="4"
              placeholder="e.g. Lose 15lbs by summer and feel more energetic at work"
              class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 resize-none"
            />
          </div>
        </OnboardingStep>

        <!-- Step 3: Fitness -->
        <OnboardingStep
          v-if="currentStep === 3"
          :step="3"
          title="Fitness"
          subtitle="Help us understand your background so we can build the right program."
        >
          <div class="space-y-6">
            <!-- Experience -->
            <div>
              <label class="block text-sm text-slate-400 mb-2">Experience level</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="lvl in ['beginner', 'intermediate', 'advanced']"
                  :key="lvl"
                  type="button"
                  class="px-4 py-3 rounded-lg border text-sm font-medium capitalize transition-colors"
                  :class="
                    form.experience === lvl
                      ? 'bg-brand-600/20 border-brand-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  "
                  @click="form.experience = lvl"
                >
                  {{ lvl }}
                </button>
              </div>
            </div>

            <!-- Days per week -->
            <div>
              <label class="block text-sm text-slate-400 mb-2">
                Days per week
                <span class="text-slate-100 font-medium ml-1">{{ form.days_per_week }}</span>
              </label>
              <input
                v-model.number="form.days_per_week"
                type="range"
                min="2"
                max="7"
                class="w-full accent-brand-500"
              />
              <div class="flex justify-between text-xs text-slate-500 mt-1">
                <span>2</span><span>7</span>
              </div>
            </div>

            <!-- Equipment -->
            <div>
              <label class="block text-sm text-slate-400 mb-2">Equipment available</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="eq in ['Full Gym', 'Home Basic', 'Bodyweight']"
                  :key="eq"
                  type="button"
                  class="px-4 py-3 rounded-lg border text-sm font-medium transition-colors"
                  :class="
                    form.equipment === eq
                      ? 'bg-brand-600/20 border-brand-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  "
                  @click="form.equipment = eq"
                >
                  {{ eq }}
                </button>
              </div>
            </div>

            <!-- Injuries -->
            <div>
              <label class="block text-sm text-slate-400 mb-1">Injuries or limitations <span class="text-slate-500">(optional)</span></label>
              <input
                v-model="form.injuries"
                type="text"
                placeholder="e.g. Lower back pain, bad left knee"
                class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500"
              />
            </div>
          </div>
        </OnboardingStep>

        <!-- Step 4: Food Preferences -->
        <OnboardingStep
          v-if="currentStep === 4"
          :step="4"
          title="Food Preferences"
          subtitle="This helps us build meals you'll actually enjoy."
        >
          <div class="space-y-4">
            <div>
              <label class="block text-sm text-slate-400 mb-1">Foods you love</label>
              <input
                v-model="form.foods_love"
                type="text"
                placeholder="e.g. chicken, rice, eggs, avocado"
                class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500"
              />
              <p class="text-xs text-slate-500 mt-1">Comma separated</p>
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-1">Foods you avoid</label>
              <input
                v-model="form.foods_avoid"
                type="text"
                placeholder="e.g. brussels sprouts, liver"
                class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500"
              />
              <p class="text-xs text-slate-500 mt-1">Comma separated</p>
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-1">Dietary restrictions</label>
              <input
                v-model="form.dietary_restrictions"
                type="text"
                placeholder="e.g. gluten-free, lactose intolerant"
                class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500"
              />
              <p class="text-xs text-slate-500 mt-1">Comma separated</p>
            </div>

            <!-- Cooking comfort -->
            <div>
              <label class="block text-sm text-slate-400 mb-2">
                Cooking comfort
                <span class="text-slate-100 font-medium ml-1">{{ cookingComfortLabel }}</span>
              </label>
              <input
                v-model.number="form.cooking_comfort"
                type="range"
                min="1"
                max="5"
                class="w-full accent-brand-500"
              />
              <div class="flex justify-between text-xs text-slate-500 mt-1">
                <span>Minimal</span><span>Chef level</span>
              </div>
            </div>

            <!-- Meals per day -->
            <div>
              <label class="block text-sm text-slate-400 mb-2">
                Meals per day
                <span class="text-slate-100 font-medium ml-1">{{ form.meals_per_day }}</span>
              </label>
              <input
                v-model.number="form.meals_per_day"
                type="range"
                min="2"
                max="5"
                class="w-full accent-brand-500"
              />
              <div class="flex justify-between text-xs text-slate-500 mt-1">
                <span>2</span><span>5</span>
              </div>
            </div>
          </div>
        </OnboardingStep>

        <!-- Step 5: Difficulty -->
        <OnboardingStep
          v-if="currentStep === 5"
          :step="5"
          title="Difficulty"
          subtitle="Choose how hard you want to be pushed."
        >
          <div class="space-y-3">
            <button
              v-for="opt in difficultyOptions"
              :key="opt.value"
              type="button"
              class="w-full text-left px-5 py-4 rounded-lg border transition-colors"
              :class="
                form.difficulty === opt.value
                  ? 'bg-brand-600/20 border-brand-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
              "
              @click="form.difficulty = opt.value"
            >
              <div class="font-semibold capitalize mb-0.5">{{ opt.value }}</div>
              <div class="text-sm text-slate-400">{{ opt.description }}</div>
            </button>
          </div>
        </OnboardingStep>

        <!-- Step 6: Your Plan -->
        <OnboardingStep
          v-if="currentStep === 6"
          :step="6"
          title="Your Plan"
          subtitle="We're building your personalised program based on everything you told us."
        >
          <div>
            <!-- Loading state -->
            <div v-if="planLoading" class="flex flex-col items-center py-10 gap-4">
              <div class="w-10 h-10 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
              <p class="text-slate-400 text-sm">Generating your plan...</p>
            </div>

            <!-- Error state -->
            <div v-else-if="planError" class="bg-slate-800 border border-slate-700 rounded-lg p-4 text-slate-300 text-sm">
              Could not generate plan. You can set things up manually.
            </div>

            <!-- AI response -->
            <div
              v-else-if="aiResponse"
              class="bg-slate-800 border border-slate-700 rounded-lg p-5 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap"
            >
              {{ aiResponse }}
            </div>
          </div>
        </OnboardingStep>
      </div>
    </div>

    <!-- Navigation -->
    <div class="p-6 flex gap-3 max-w-lg mx-auto w-full">
      <button
        v-if="currentStep > 1"
        type="button"
        class="px-6 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 font-medium hover:bg-slate-700 transition-colors"
        @click="back"
      >
        Back
      </button>
      <div class="flex-1" />

      <!-- Get Started on step 6 -->
      <button
        v-if="currentStep === totalSteps"
        type="button"
        class="px-6 py-3 bg-brand-600 rounded-lg text-white font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="finishing"
        @click="finish"
      >
        {{ finishing ? 'Saving...' : 'Get Started' }}
      </button>

      <!-- Next on steps 1-5 -->
      <button
        v-else
        type="button"
        class="px-6 py-3 bg-brand-600 rounded-lg text-white font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="currentStep === 1 && !form.name.trim()"
        @click="next"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import OnboardingStep from '@/components/onboarding/OnboardingStep.vue'

const router = useRouter()
const auth = useAuthStore()
const userStore = useUserStore()

const totalSteps = 6
const currentStep = ref(1)
const planLoading = ref(false)
const planError = ref(false)
const aiResponse = ref(null)
const aiActions = ref([])
const finishing = ref(false)

const form = ref({
  name: '',
  age: null,
  height_cm: null,
  weight_lbs: null,
  goal_text: '',
  experience: 'beginner',
  days_per_week: 4,
  equipment: 'Full Gym',
  injuries: '',
  foods_love: '',
  foods_avoid: '',
  dietary_restrictions: '',
  cooking_comfort: 3,
  meals_per_day: 3,
  difficulty: 'medium'
})

const difficultyOptions = [
  {
    value: 'easy',
    description: 'Gentle start. 3 days/week, simple meals, encouraging nudges.'
  },
  {
    value: 'medium',
    description: 'Balanced push. 4-5 days/week, moderate meals, honest feedback.'
  },
  {
    value: 'hard',
    description: 'No excuses. 5-6 days/week, precise nutrition, direct accountability.'
  }
]

const cookingComfortLabel = computed(() => {
  const labels = ['', 'Minimal', 'Basic', 'Comfortable', 'Confident', 'Chef level']
  return labels[form.value.cooking_comfort] || form.value.cooking_comfort
})

function splitCsv(str) {
  if (!str || !str.trim()) return []
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

function next() {
  if (currentStep.value < totalSteps) {
    currentStep.value++
  }
}

function back() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

// Generate AI plan when reaching step 6
watch(currentStep, async (step) => {
  if (step === 6) {
    planLoading.value = true
    planError.value = false
    aiResponse.value = null
    aiActions.value = []

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          intent: 'onboarding_plan',
          data: {
            name: form.value.name,
            age: form.value.age,
            height_cm: form.value.height_cm,
            weight_lbs: form.value.weight_lbs,
            goal: form.value.goal_text,
            experience: form.value.experience,
            days_per_week: form.value.days_per_week,
            equipment: form.value.equipment,
            injuries: form.value.injuries,
            foods_love: splitCsv(form.value.foods_love),
            foods_avoid: splitCsv(form.value.foods_avoid),
            dietary_restrictions: splitCsv(form.value.dietary_restrictions),
            cooking_comfort: form.value.cooking_comfort,
            meals_per_day: form.value.meals_per_day,
            difficulty: form.value.difficulty
          }
        }
      })

      if (error) throw error

      aiResponse.value = data?.message || data?.response || JSON.stringify(data)
      if (data?.actions) {
        aiActions.value = data.actions
      }
    } catch {
      planError.value = true
    } finally {
      planLoading.value = false
    }
  }
})

async function finish() {
  if (!auth.userId) return
  finishing.value = true

  try {
    // Build preferences JSONB
    const preferences = {
      foods_liked: splitCsv(form.value.foods_love),
      foods_disliked: splitCsv(form.value.foods_avoid),
      dietary_restrictions: splitCsv(form.value.dietary_restrictions),
      cooking_level: form.value.cooking_comfort,
      meals_per_day: form.value.meals_per_day,
      fitness_experience: form.value.experience,
      available_days: form.value.days_per_week,
      equipment_access: form.value.equipment,
      injuries: form.value.injuries || null,
      weight_unit: 'lbs'
    }

    // Upsert profile (only columns that exist in v2_profiles)
    const { error: profileError } = await supabase
      .from('v2_profiles')
      .upsert(
        {
          user_id: auth.userId,
          name: form.value.name.trim(),
          age: form.value.age || null,
          height_cm: form.value.height_cm || null,
          weight_kg: form.value.weight_lbs || null,
          difficulty: form.value.difficulty,
          preferences,
          onboarding_complete: true
        },
        { onConflict: 'user_id' }
      )

    if (profileError) throw profileError

    // Create goal if provided
    if (form.value.goal_text.trim()) {
      const { error: goalError } = await supabase
        .from('v2_goals')
        .insert({
          user_id: auth.userId,
          title: form.value.goal_text.trim(),
          status: 'active'
        })

      if (goalError) throw goalError
    }

    // Save AI-generated fitness program if returned
    const programAction = aiActions.value.find(a => a.type === 'create_program')
    if (programAction?.data) {
      const prog = programAction.data

      const { data: savedProgram, error: progError } = await supabase
        .from('v2_fitness_programs')
        .insert({
          user_id: auth.userId,
          name: prog.name || 'My Program',
          source: 'ai',
          is_active: true
        })
        .select('id')
        .single()

      if (progError) throw progError

      if (prog.days && savedProgram?.id) {
        for (const day of prog.days) {
          const { data: savedDay, error: dayError } = await supabase
            .from('v2_program_days')
            .insert({
              program_id: savedProgram.id,
              user_id: auth.userId,
              day_of_week: day.day_of_week,
              name: day.name || 'Day',
              focus: day.focus || null,
              is_rest_day: day.is_rest_day || false
            })
            .select('id')
            .single()

          if (dayError) throw dayError

          if (day.exercises && savedDay?.id) {
            const exercises = day.exercises.map((ex, idx) => ({
              program_day_id: savedDay.id,
              user_id: auth.userId,
              exercise_name: ex.name,
              target_sets: ex.sets || 3,
              target_reps_min: ex.reps_min || 8,
              target_reps_max: ex.reps_max || 12,
              rest_seconds: ex.rest || 90,
              sort_order: idx
            }))

            const { error: exError } = await supabase
              .from('v2_program_exercises')
              .insert(exercises)

            if (exError) throw exError
          }
        }
      }
    }

    // Hydrate user store with new profile
    await userStore.hydrate()

    router.push('/dashboard')
  } catch (err) {
    console.error('Onboarding finish error:', err)
  } finally {
    finishing.value = false
  }
}
</script>
