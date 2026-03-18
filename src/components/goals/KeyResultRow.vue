<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between gap-2">
      <span class="text-sm text-slate-300 flex-1 min-w-0 truncate">{{ kr.title }}</span>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs text-slate-400">
          {{ kr.current_value }}/{{ kr.target_value }}
          <span v-if="kr.unit">{{ kr.unit }}</span>
        </span>
        <button
          v-if="!editing"
          class="text-xs text-brand-400 hover:text-brand-300 transition-colors px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
          @click="startEdit"
        >
          Update
        </button>
      </div>
    </div>

    <!-- Thin progress bar -->
    <div class="w-full rounded-full overflow-hidden bg-slate-800 h-1.5">
      <div
        class="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
        :style="{ width: `${progress}%` }"
      />
    </div>

    <!-- Inline edit -->
    <div v-if="editing" class="flex items-center gap-2 mt-1.5">
      <input
        v-model.number="editValue"
        type="number"
        :min="0"
        :max="kr.target_value"
        class="w-24 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-600"
        @keydown.enter="save"
        @keydown.escape="cancel"
      />
      <button
        :disabled="saving"
        class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        @click="save"
      >
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
      <button
        class="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 transition-colors"
        @click="cancel"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useGoalsStore } from '@/stores/goals'

const props = defineProps({
  kr: {
    type: Object,
    required: true,
  },
})

const goalsStore = useGoalsStore()

const editing = ref(false)
const editValue = ref(0)
const saving = ref(false)

const progress = computed(() => {
  if (!props.kr.target_value || props.kr.target_value <= 0) return 0
  return Math.min(100, Math.round((props.kr.current_value / props.kr.target_value) * 100))
})

function startEdit() {
  editValue.value = props.kr.current_value
  editing.value = true
}

function cancel() {
  editing.value = false
}

async function save() {
  saving.value = true
  try {
    await goalsStore.updateKeyResult(props.kr.id, editValue.value)
    editing.value = false
  } catch (err) {
    console.error('Failed to update key result:', err)
  } finally {
    saving.value = false
  }
}
</script>
