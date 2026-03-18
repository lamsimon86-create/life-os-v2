import { useMealsStore } from '@/stores/meals'
import { useFitnessStore } from '@/stores/fitness'
import { useToast } from '@/composables/useToast'

export function useAi() {
  const mealsStore = useMealsStore()
  const fitnessStore = useFitnessStore()
  const toast = useToast()

  async function handleActions(actions) {
    if (!actions || !Array.isArray(actions)) return

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'suggest_recipe': {
            // Recipe actions are handled by the UI "Save to Library" button
            // This case is a no-op — the action is displayed in the chat panel
            break
          }

          case 'create_program': {
            if (action.program) {
              await fitnessStore.createProgramFromTemplate(action.program)
              toast.show('Program created and activated.', 'success')
            }
            break
          }

          default:
            break
        }
      } catch (err) {
        console.error(`Failed to handle action "${action.type}":`, err)
        toast.show(`Failed to apply action: ${action.type}`, 'error')
      }
    }
  }

  async function saveRecipe(recipe) {
    try {
      await mealsStore.approveRecipe(recipe)
      toast.show('Recipe saved to library.', 'success')
    } catch (err) {
      console.error('Failed to save recipe:', err)
      toast.show('Failed to save recipe.', 'error')
    }
  }

  return { handleActions, saveRecipe }
}
