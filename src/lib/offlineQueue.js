const DB_NAME = 'lifeos-offline'
const STORE_NAME = 'pending-actions'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }

    request.onsuccess = (event) => resolve(event.target.result)
    request.onerror = (event) => reject(event.target.error)
  })
}

export async function queueAction(action) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.add({ ...action, timestamp: Date.now() })
    request.onsuccess = () => resolve(request.result)
    request.onerror = (event) => reject(event.target.error)
  })
}

export async function getPendingActions() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = (event) => reject(event.target.error)
  })
}

export async function clearAction(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = (event) => reject(event.target.error)
  })
}

export async function syncPendingActions(supabase) {
  let pending
  try {
    pending = await getPendingActions()
  } catch (err) {
    console.error('[offlineQueue] Failed to read pending actions:', err)
    return
  }

  for (const action of pending) {
    try {
      if (action.type === 'insert') {
        const { error } = await supabase.from(action.table).insert(action.data)
        if (error) throw error
      } else if (action.type === 'update') {
        const { error } = await supabase
          .from(action.table)
          .update(action.data)
          .eq('id', action.data.id)
        if (error) throw error
      }
      await clearAction(action.id)
    } catch (err) {
      console.error(`[offlineQueue] Failed to sync action id=${action.id}:`, err)
      // Leave in queue for next sync attempt
    }
  }
}
