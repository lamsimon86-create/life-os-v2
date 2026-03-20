<template>
  <div class="bg-slate-800 rounded-xl p-4 min-w-[85vw] max-w-[85vw] snap-center shrink-0 sm:min-w-[300px] sm:max-w-[350px]">
    <!-- Empty state -->
    <div v-if="!latestLog" class="text-center py-4">
      <p class="text-sm text-slate-400 mb-2">Track your body composition</p>
      <button @click="showModal = true" class="text-xs text-blue-400 hover:text-blue-300">
        Log your first weigh-in
      </button>
    </div>

    <!-- Has data -->
    <div v-else>
      <div class="flex items-start justify-between mb-2">
        <div>
          <div class="text-2xl font-bold">{{ latestLog.weight_lbs }} lbs</div>
          <div v-if="change" class="text-xs mt-0.5" :class="change.direction === 'down' ? 'text-green-400' : change.direction === 'up' ? 'text-red-400' : 'text-slate-400'">
            {{ change.direction === 'down' ? '↓' : change.direction === 'up' ? '↑' : '→' }}
            {{ change.value }} lbs since {{ formatDate(previousLog?.date) }}
          </div>
          <div v-else class="text-xs text-slate-500 mt-0.5">First entry — {{ formatDate(latestLog.date) }}</div>
        </div>
        <!-- Photo thumbnail -->
        <div v-if="photoUrl" class="w-12 h-12 rounded-lg overflow-hidden bg-slate-700">
          <img :src="photoUrl" class="w-full h-full object-cover" />
        </div>
      </div>

      <div class="flex gap-2 mt-3">
        <button
          v-if="bodyStore.needsMonthlyLog"
          @click="showModal = true"
          class="flex-1 text-xs bg-blue-500 text-white py-2 rounded-lg font-semibold"
        >
          Log weigh-in
        </button>
        <button
          @click="showModal = true"
          class="flex-1 text-xs bg-slate-700 text-slate-300 py-2 rounded-lg"
        >
          View history
        </button>
      </div>
    </div>

    <!-- Modal -->
    <BodyLogModal v-if="showModal" @close="showModal = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useBodyStore } from '@/stores/body'
import BodyLogModal from './BodyLogModal.vue'

const bodyStore = useBodyStore()

const showModal = ref(false)
const photoUrl = ref(null)

const latestLog = computed(() => bodyStore.latestLog)
const previousLog = computed(() => bodyStore.previousLog)
const change = computed(() => bodyStore.weightChange)

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

onMounted(async () => {
  if (latestLog.value?.photo_front_url) {
    photoUrl.value = await bodyStore.getSignedUrl(latestLog.value.photo_front_url)
  }
})
</script>
