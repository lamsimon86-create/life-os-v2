<template>
  <Transition name="slide-down">
    <div
      v-if="!isOnline"
      class="fixed top-14 left-0 right-0 z-50 bg-amber-600 text-white text-center py-2 text-sm flex items-center justify-center gap-2"
    >
      <WifiOff :size="14" />
      <span>You're offline — changes will sync when you reconnect</span>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { WifiOff } from 'lucide-vue-next'

const isOnline = ref(navigator.onLine)

function handleOnline() {
  isOnline.value = true
}

function handleOffline() {
  isOnline.value = false
}

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
