<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-950 px-4">
    <div class="w-full max-w-sm">
      <!-- Logo / Title -->
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-bold text-brand-400">Life OS</h1>
        <p class="mt-1 text-sm text-slate-400">
          {{ mode === 'login' ? 'Sign in to your account' : mode === 'signup' ? 'Create your account' : 'Reset your password' }}
        </p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="mb-1 block text-sm text-slate-300">Email</label>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
            class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div v-if="mode !== 'reset'">
          <label class="mb-1 block text-sm text-slate-300">Password</label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
            class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <!-- Error / Success -->
        <p v-if="error" class="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{{ error }}</p>
        <p v-if="success" class="rounded-lg bg-green-900/40 px-3 py-2 text-sm text-green-400">{{ success }}</p>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ submitting ? 'Please wait…' : submitLabel }}
        </button>
      </form>

      <!-- Mode toggles -->
      <div class="mt-6 space-y-2 text-center text-sm text-slate-500">
        <template v-if="mode === 'login'">
          <p>
            No account?
            <button @click="setMode('signup')" class="text-brand-400 hover:underline">Create account</button>
          </p>
          <p>
            <button @click="setMode('reset')" class="text-brand-400 hover:underline">Forgot password?</button>
          </p>
        </template>

        <template v-else-if="mode === 'signup'">
          <p>
            Already have an account?
            <button @click="setMode('login')" class="text-brand-400 hover:underline">Sign in</button>
          </p>
        </template>

        <template v-else>
          <p>
            <button @click="setMode('login')" class="text-brand-400 hover:underline">Back to sign in</button>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const mode = ref('login')
const email = ref('')
const password = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)

const submitLabel = computed(() => {
  if (mode.value === 'login') return 'Sign in'
  if (mode.value === 'signup') return 'Create account'
  return 'Send reset link'
})

function setMode(m) {
  mode.value = m
  error.value = ''
  success.value = ''
  password.value = ''
}

async function handleSubmit() {
  error.value = ''
  success.value = ''
  submitting.value = true

  try {
    if (mode.value === 'login') {
      await auth.login(email.value, password.value)
      router.push('/dashboard')
    } else if (mode.value === 'signup') {
      await auth.signup(email.value, password.value)
      success.value = 'Check your email to confirm your account.'
    } else {
      await auth.resetPassword(email.value)
      success.value = 'Reset link sent — check your inbox.'
    }
  } catch (err) {
    error.value = err.message || 'Something went wrong.'
  } finally {
    submitting.value = false
  }
}
</script>
