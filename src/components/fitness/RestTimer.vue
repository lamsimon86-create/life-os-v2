<template>
  <div
    v-if="visible"
    class="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4"
  >
    <div class="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-lg max-w-xs w-full">
      <Timer :size="18" class="text-brand-400 shrink-0" />

      <div class="flex-1">
        <p class="text-xs text-slate-400">Rest Timer</p>
        <p
          class="text-lg font-bold tabular-nums"
          :class="remaining <= 0 ? 'text-green-400' : 'text-white'"
        >
          {{ display }}
        </p>
      </div>

      <button
        v-if="remaining <= 0"
        class="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-500 active:scale-95 transition-all"
        @click="restart"
      >
        Restart
      </button>

      <button
        class="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
        aria-label="Dismiss timer"
        @click="dismiss"
      >
        <X :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Timer, X } from 'lucide-vue-next'

const props = defineProps({
  seconds: {
    type: Number,
    default: 90
  },
  active: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['dismiss'])

const remaining = ref(props.seconds)
const visible = ref(true)
let intervalId = null

const display = computed(() => {
  const secs = Math.max(0, remaining.value)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

function startTimer() {
  clearInterval(intervalId)
  intervalId = setInterval(() => {
    if (remaining.value > 0) {
      remaining.value--
      if (remaining.value === 0) {
        onTimerDone()
      }
    }
  }, 1000)
}

function onTimerDone() {
  clearInterval(intervalId)
  // Vibrate if supported
  if (navigator.vibrate) {
    navigator.vibrate(200)
  }
}

function restart() {
  remaining.value = props.seconds
  startTimer()
}

function dismiss() {
  clearInterval(intervalId)
  visible.value = false
  emit('dismiss')
}

watch(() => props.active, (val) => {
  if (val) {
    remaining.value = props.seconds
    visible.value = true
    startTimer()
  } else {
    clearInterval(intervalId)
  }
})

watch(() => props.seconds, (val) => {
  remaining.value = val
})

onMounted(() => {
  if (props.active) {
    startTimer()
  }
})

onUnmounted(() => {
  clearInterval(intervalId)
})
</script>
