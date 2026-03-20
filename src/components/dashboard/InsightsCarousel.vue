<template>
  <div>
    <div class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Insights</div>
    <div
      ref="scrollContainer"
      class="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
      @scroll="updateActiveDot"
    >
      <slot />
    </div>
    <!-- Dot indicators -->
    <div v-if="totalCards > 1" class="flex justify-center gap-1.5 mt-2">
      <div
        v-for="i in totalCards"
        :key="i"
        class="w-1.5 h-1.5 rounded-full transition-colors"
        :class="activeIndex === i - 1 ? 'bg-slate-300' : 'bg-slate-600'"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, useSlots } from 'vue'

const props = defineProps({
  totalCards: { type: Number, default: 1 }
})

const scrollContainer = ref(null)
const activeIndex = ref(0)

function updateActiveDot() {
  if (!scrollContainer.value) return
  const el = scrollContainer.value
  const cardWidth = el.firstElementChild?.offsetWidth || el.offsetWidth
  activeIndex.value = Math.round(el.scrollLeft / cardWidth)
}
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
