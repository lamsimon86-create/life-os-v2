<template>
  <div v-if="visible" class="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" @click.self="close">
    <div class="bg-slate-800 rounded-t-xl w-full max-w-md max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-slate-700">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-sm font-bold">{{ title }}</h3>
          <button @click="close" class="text-slate-400 hover:text-slate-200">
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            placeholder="Search exercises..."
            class="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div class="px-4 py-2 flex gap-2 overflow-x-auto border-b border-slate-700/50">
        <button
          v-for="group in groups"
          :key="group"
          @click="selectedGroup = group"
          class="shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors"
          :class="selectedGroup === group
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
            : 'bg-slate-700 text-slate-400'"
        >
          {{ group === 'all' ? 'All' : group.charAt(0).toUpperCase() + group.slice(1) }}
        </button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div
          v-for="exercise in results"
          :key="exercise.id"
          @click="select(exercise)"
          class="px-4 py-3 border-b border-slate-700/30 hover:bg-slate-700/50 cursor-pointer flex justify-between items-center"
        >
          <div>
            <div class="text-sm font-semibold">{{ exercise.name }}</div>
            <div class="text-[10px] text-slate-500">
              {{ exercise.muscle_group }} · {{ exercise.equipment }} · {{ exercise.is_compound ? 'Compound' : 'Isolation' }}
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-slate-500" />
        </div>
        <div v-if="results.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
          No exercises found
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { X, Search, ChevronRight } from 'lucide-vue-next'
import { useFitnessStore } from '@/stores/fitness'
import { MUSCLE_GROUPS } from '@/lib/constants'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: 'Select Exercise' },
  initialGroup: { type: String, default: 'all' }
})

const emit = defineEmits(['select', 'close'])

const fitnessStore = useFitnessStore()
const query = ref('')
const selectedGroup = ref(props.initialGroup)
const searchInput = ref(null)

const groups = computed(() => ['all', ...MUSCLE_GROUPS])

const results = computed(() => fitnessStore.searchExercises(query.value, selectedGroup.value))

watch(() => props.visible, async (v) => {
  if (v) {
    selectedGroup.value = props.initialGroup
    query.value = ''
    await nextTick()
    searchInput.value?.focus()
  }
})

function select(exercise) {
  emit('select', exercise)
  emit('close')
}

function close() {
  emit('close')
}
</script>
