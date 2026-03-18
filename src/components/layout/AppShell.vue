<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">

    <!-- Header -->
    <header
      v-if="!hideChrome"
      class="fixed top-0 left-0 right-0 z-40 h-14 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex items-center justify-between px-4 max-w-lg mx-auto"
    >
      <span class="text-lg font-bold tracking-tight text-white">Life OS</span>
      <button
        class="p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
        aria-label="Settings"
        @click="router.push('/settings')"
      >
        <Settings :size="20" />
      </button>
    </header>

    <!-- Main content -->
    <main
      class="max-w-lg mx-auto"
      :class="hideChrome ? '' : 'pt-14 pb-20'"
    >
      <slot />
    </main>

    <!-- Tab bar -->
    <TabBar
      v-if="!hideChrome"
      @open-ai="aiOpen = true"
    />

    <!-- Toast -->
    <Toast />

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Settings } from 'lucide-vue-next'
import TabBar from './TabBar.vue'
import Toast from '@/components/shared/Toast.vue'

const route = useRoute()
const router = useRouter()

// Placeholder for Task 12 AI panel
const aiOpen = ref(false)

const HIDDEN_ROUTES = ['login', 'onboarding', 'workout']

const hideChrome = computed(() => {
  return HIDDEN_ROUTES.includes(route.name)
})
</script>
