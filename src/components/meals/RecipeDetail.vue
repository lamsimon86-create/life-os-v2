<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      @click.self="emit('close')"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

      <!-- Modal -->
      <div class="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 flex items-start justify-between gap-3 p-5 bg-slate-900 border-b border-slate-800 rounded-t-2xl z-10">
          <h2 class="text-lg font-bold text-slate-100 leading-snug">{{ recipe.name }}</h2>
          <button
            class="shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="p-5 space-y-5">
          <!-- Macros row -->
          <div class="grid grid-cols-4 gap-2">
            <div
              v-for="macro in macros"
              :key="macro.label"
              class="rounded-lg bg-slate-800 p-2.5 text-center space-y-0.5"
            >
              <p class="text-sm font-semibold text-slate-100">{{ macro.value ?? '—' }}</p>
              <p class="text-xs text-slate-500">{{ macro.label }}</p>
            </div>
          </div>

          <!-- Time row -->
          <div v-if="recipe.prep_time_min || recipe.cook_time_min" class="flex items-center gap-4 text-sm text-slate-400">
            <span v-if="recipe.prep_time_min" class="flex items-center gap-1.5">
              <Timer :size="14" class="text-brand-400" />
              Prep: {{ recipe.prep_time_min }} min
            </span>
            <span v-if="recipe.cook_time_min" class="flex items-center gap-1.5">
              <Flame :size="14" class="text-brand-400" />
              Cook: {{ recipe.cook_time_min }} min
            </span>
          </div>

          <!-- Tags -->
          <div v-if="recipe.tags && recipe.tags.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="tag in recipe.tags"
              :key="tag"
              class="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400"
            >
              {{ tag }}
            </span>
          </div>

          <!-- Ingredients -->
          <div v-if="recipe.ingredients && recipe.ingredients.length" class="space-y-2">
            <h3 class="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <ShoppingBasket :size="14" class="text-brand-400" />
              Ingredients
            </h3>
            <ul class="space-y-1.5">
              <li
                v-for="(item, i) in recipe.ingredients"
                :key="i"
                class="flex items-start gap-2 text-sm text-slate-400"
              >
                <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                {{ item }}
              </li>
            </ul>
          </div>

          <!-- Instructions -->
          <div v-if="recipe.instructions && recipe.instructions.length" class="space-y-2">
            <h3 class="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <BookOpen :size="14" class="text-brand-400" />
              Instructions
            </h3>
            <ol class="space-y-2.5">
              <li
                v-for="(step, i) in recipe.instructions"
                :key="i"
                class="flex items-start gap-3 text-sm text-slate-400"
              >
                <span class="shrink-0 w-5 h-5 rounded-full bg-brand-600/20 text-brand-400 text-xs font-semibold flex items-center justify-center mt-0.5">
                  {{ i + 1 }}
                </span>
                <span class="leading-relaxed">{{ step }}</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { X, Timer, Flame, ShoppingBasket, BookOpen } from 'lucide-vue-next'

const props = defineProps({
  recipe: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close'])

const macros = computed(() => [
  { label: 'Calories', value: props.recipe.calories ? `${props.recipe.calories}` : null },
  { label: 'Protein', value: props.recipe.protein_g ? `${props.recipe.protein_g}g` : null },
  { label: 'Carbs', value: props.recipe.carbs_g ? `${props.recipe.carbs_g}g` : null },
  { label: 'Fat', value: props.recipe.fat_g ? `${props.recipe.fat_g}g` : null },
])
</script>
