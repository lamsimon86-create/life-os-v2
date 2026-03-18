<template>
  <nav class="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-safe">
    <div class="flex items-end justify-around h-16 max-w-lg mx-auto px-2">

      <!-- Dashboard -->
      <RouterLink
        to="/dashboard"
        class="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors"
        :class="isActive('/dashboard') ? 'text-brand-400' : 'text-slate-500'"
      >
        <Home :size="22" />
        <span style="font-size:10px;line-height:1">Dashboard</span>
      </RouterLink>

      <!-- Fitness -->
      <RouterLink
        to="/fitness"
        class="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors"
        :class="isActive('/fitness') ? 'text-brand-400' : 'text-slate-500'"
      >
        <Dumbbell :size="22" />
        <span style="font-size:10px;line-height:1">Fitness</span>
      </RouterLink>

      <!-- AI FAB (center) -->
      <button
        class="flex items-center justify-center w-14 h-14 -mt-5 rounded-full bg-brand-600 shadow-lg hover:bg-brand-500 active:scale-95 transition-all"
        @click="$emit('openAi')"
        aria-label="Open AI assistant"
      >
        <MessageCircle :size="24" class="text-white" />
      </button>

      <!-- Meals -->
      <RouterLink
        to="/meals"
        class="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors"
        :class="isActive('/meals') ? 'text-brand-400' : 'text-slate-500'"
      >
        <UtensilsCrossed :size="22" />
        <span style="font-size:10px;line-height:1">Meals</span>
      </RouterLink>

      <!-- Goals -->
      <RouterLink
        to="/goals"
        class="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors"
        :class="isActive('/goals') ? 'text-brand-400' : 'text-slate-500'"
      >
        <Target :size="22" />
        <span style="font-size:10px;line-height:1">Goals</span>
      </RouterLink>

    </div>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { Home, Dumbbell, MessageCircle, UtensilsCrossed, Target } from 'lucide-vue-next'

defineEmits(['openAi'])

const route = useRoute()

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
