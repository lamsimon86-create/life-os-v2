<template>
  <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
    <TransitionGroup
      name="toast"
      tag="div"
      class="flex flex-col gap-2"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium min-w-48 max-w-xs"
        :class="colorClass(toast.type)"
        @click="remove(toast.id)"
      >
        <span class="flex-1">{{ toast.message }}</span>
        <button class="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const { toasts, remove } = useToast()

function colorClass(type) {
  if (type === 'success') return 'bg-green-600'
  if (type === 'error') return 'bg-red-600'
  return 'bg-slate-700'
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
