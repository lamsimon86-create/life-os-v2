<template>
  <div>
    <h3 class="text-sm font-bold text-brand-400 mb-3">Supplements</h3>

    <!-- Existing supplements -->
    <div class="flex flex-col gap-2 mb-3">
      <div
        v-for="supp in supplements"
        :key="supp.id"
        class="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2"
      >
        <div>
          <div class="text-sm">{{ supp.name }}</div>
          <div class="text-[10px] text-slate-500 capitalize">{{ formatFrequency(supp.frequency) }}</div>
        </div>
        <button
          @click="remove(supp.id)"
          class="text-slate-500 hover:text-red-400 transition-colors"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
      <p v-if="supplements.length === 0" class="text-sm text-slate-500">No supplements added yet.</p>
    </div>

    <!-- Add form -->
    <div class="flex gap-2">
      <input
        v-model="newName"
        placeholder="Supplement name"
        class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        @keyup.enter="add"
      />
      <select
        v-model="newFrequency"
        class="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm"
      >
        <option value="daily">Daily</option>
        <option value="[1,3,5]">Mon/Wed/Fri</option>
        <option value="[2,4,6]">Tue/Thu/Sat</option>
      </select>
      <button
        @click="add"
        :disabled="!newName.trim()"
        class="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        Add
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { useSupplementStore } from '@/stores/supplement'

const supplementStore = useSupplementStore()
const supplements = computed(() => supplementStore.supplements)

const newName = ref('')
const newFrequency = ref('daily')

async function add() {
  if (!newName.value.trim()) return
  await supplementStore.addSupplement(newName.value.trim(), newFrequency.value)
  newName.value = ''
  newFrequency.value = 'daily'
}

async function remove(id) {
  await supplementStore.removeSupplement(id)
}

function formatFrequency(freq) {
  if (freq === 'daily') return 'Daily'
  try {
    const days = JSON.parse(freq)
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days.map(d => names[d]).join(', ')
  } catch { return freq }
}
</script>
