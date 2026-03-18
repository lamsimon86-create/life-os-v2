<template>
  <div
    class="relative rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 cursor-pointer hover:border-slate-700 transition-colors"
    @click="emit('open', recipe)"
  >
    <!-- Delete button -->
    <button
      class="absolute top-3 right-3 rounded-lg p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors"
      aria-label="Delete recipe"
      @click.stop="confirmDelete"
    >
      <Trash2 :size="14" />
    </button>

    <!-- Name -->
    <h3 class="text-sm font-semibold text-slate-100 pr-8 leading-snug">{{ recipe.name }}</h3>

    <!-- Time row -->
    <div class="flex items-center gap-3 text-xs text-slate-500">
      <span v-if="recipe.prep_time_min" class="flex items-center gap-1">
        <Timer :size="12" />
        Prep {{ recipe.prep_time_min }}m
      </span>
      <span v-if="recipe.cook_time_min" class="flex items-center gap-1">
        <Flame :size="12" />
        Cook {{ recipe.cook_time_min }}m
      </span>
    </div>

    <!-- Macros -->
    <div class="flex items-center gap-3 text-xs">
      <span v-if="recipe.calories" class="text-slate-300 font-medium">{{ recipe.calories }} kcal</span>
      <span v-if="recipe.protein_g" class="text-brand-400">{{ recipe.protein_g }}g protein</span>
    </div>

    <!-- Tags -->
    <div v-if="recipe.tags && recipe.tags.length" class="flex flex-wrap gap-1.5">
      <span
        v-for="tag in recipe.tags"
        :key="tag"
        class="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
      >
        {{ tag }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { Trash2, Timer, Flame } from 'lucide-vue-next'
import { useMealsStore } from '@/stores/meals'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  recipe: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['open'])

const mealsStore = useMealsStore()
const { show: showToast } = useToast()

async function confirmDelete() {
  if (!confirm(`Delete "${props.recipe.name}"? This cannot be undone.`)) return
  try {
    await mealsStore.deleteRecipe(props.recipe.id)
    showToast('Recipe deleted', 'info')
  } catch (err) {
    console.error('Failed to delete recipe:', err)
    showToast('Failed to delete recipe', 'error')
  }
}
</script>
