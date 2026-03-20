<template>
  <div class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" @click.self="$emit('close')">
    <div class="bg-slate-800 rounded-xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-bold">Body Composition</h3>
        <button @click="$emit('close')" class="text-slate-500 hover:text-slate-300">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Add entry form -->
      <div class="mb-6 p-3 bg-slate-750 rounded-lg border border-slate-700">
        <div class="text-xs font-semibold text-slate-400 mb-3">New Entry</div>
        <div class="flex gap-3 mb-3">
          <div class="flex-1">
            <label class="text-xs text-slate-400 mb-1 block">Weight (lbs)</label>
            <input
              v-model.number="form.weight"
              type="number"
              step="0.1"
              :placeholder="bodyStore.latestLog?.weight_lbs || ''"
              class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Front photo</label>
            <input type="file" accept="image/*" capture="environment" @change="e => form.photoFront = e.target.files[0]"
              class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-700 file:text-slate-300" />
          </div>
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Side photo</label>
            <input type="file" accept="image/*" capture="environment" @change="e => form.photoSide = e.target.files[0]"
              class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-700 file:text-slate-300" />
          </div>
        </div>

        <input v-model="form.notes" placeholder="Notes (optional)" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mb-3" />

        <button
          @click="submit"
          :disabled="!form.weight || saving"
          class="w-full bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save Entry' }}
        </button>
      </div>

      <!-- History -->
      <div class="text-xs font-semibold text-slate-400 mb-2">History</div>
      <div v-if="bodyStore.logs.length === 0" class="text-sm text-slate-500 text-center py-4">No entries yet</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="log in bodyStore.logs" :key="log.id" class="bg-slate-750 rounded-lg p-3">
          <div class="flex justify-between items-center">
            <div>
              <div class="text-sm font-semibold">{{ log.weight_lbs }} lbs</div>
              <div class="text-[10px] text-slate-500">{{ formatDate(log.date) }}</div>
            </div>
            <div class="text-[10px] text-slate-500">{{ log.notes || '' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { X } from 'lucide-vue-next'
import { useBodyStore } from '@/stores/body'

const emit = defineEmits(['close'])
const bodyStore = useBodyStore()

const saving = ref(false)
const form = reactive({
  weight: null,
  photoFront: null,
  photoSide: null,
  notes: ''
})

async function submit() {
  if (!form.weight) return
  saving.value = true
  try {
    await bodyStore.addLog(form.weight, form.photoFront, form.photoSide, form.notes)
    form.weight = null
    form.photoFront = null
    form.photoSide = null
    form.notes = ''
  } finally {
    saving.value = false
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
</script>
