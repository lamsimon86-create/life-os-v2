<template>
  <div v-if="active" class="mt-2 px-3 py-2 bg-slate-900 rounded-lg flex items-center justify-between">
    <div class="flex items-center gap-2">
      <Timer class="w-3.5 h-3.5 text-slate-500" />
      <span class="text-base font-bold" :class="remaining <= 0 ? 'text-green-400' : 'text-green-500'">
        {{ display }}
      </span>
    </div>
    <div class="flex gap-1.5">
      <button @click="adjust(-30)" class="bg-slate-700 text-slate-400 px-2 py-1 rounded-md text-[10px] hover:bg-slate-600">
        -30s
      </button>
      <button @click="adjust(30)" class="bg-slate-700 text-slate-400 px-2 py-1 rounded-md text-[10px] hover:bg-slate-600">
        +30s
      </button>
      <button @click="dismiss" class="bg-slate-700 text-slate-400 px-1.5 py-1 rounded-md text-[10px] hover:bg-slate-600">
        <X class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Timer, X } from 'lucide-vue-next'

const props = defineProps({
  seconds: { type: Number, default: 90 },
  active: { type: Boolean, default: false }
})

const emit = defineEmits(['dismiss', 'adjust'])

const remaining = ref(props.seconds)
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
  if (navigator.vibrate) {
    navigator.vibrate(200)
  }
}

function adjust(delta) {
  const newDuration = Math.max(0, remaining.value + delta)
  remaining.value = newDuration
  emit('adjust', newDuration)
}

function dismiss() {
  clearInterval(intervalId)
  emit('dismiss')
}

watch(() => props.active, (val) => {
  if (val) {
    remaining.value = props.seconds
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
