<template>
  <div class="space-y-4">
    <div
      v-for="(itemList, category) in items"
      :key="category"
      class="space-y-2"
    >
      <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{{ category }}</h4>
      <ul class="space-y-1.5">
        <li
          v-for="(item, i) in itemList"
          :key="`${category}-${i}`"
          class="flex items-center gap-3"
        >
          <input
            :id="`grocery-${category}-${i}`"
            v-model="checked[`${category}-${i}`]"
            type="checkbox"
            class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 accent-brand-500 cursor-pointer"
          />
          <label
            :for="`grocery-${category}-${i}`"
            class="text-sm cursor-pointer transition-colors"
            :class="checked[`${category}-${i}`] ? 'text-slate-600 line-through' : 'text-slate-300'"
          >
            {{ item }}
          </label>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

const props = defineProps({
  items: {
    type: Object,
    required: true,
  },
})

// Local checkbox state — not persisted
const checked = reactive({})
</script>
