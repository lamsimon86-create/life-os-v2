import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

function show(message, type = 'info', duration = 3000) {
  const id = ++nextId
  toasts.value.push({ id, message, type })

  if (duration > 0) {
    setTimeout(() => {
      remove(id)
    }, duration)
  }
}

function remove(id) {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index !== -1) {
    toasts.value.splice(index, 1)
  }
}

export function useToast() {
  return { toasts, show, remove }
}
