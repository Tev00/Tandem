import { useState, useEffect } from 'react'
import { pb } from './pb'

// Reactive wrapper over PocketBase's auth store.
export function useAuth() {
  const [user, setUser] = useState(pb.authStore.record)
  useEffect(() => pb.authStore.onChange(() => setUser(pb.authStore.record)), [])
  return {
    user,
    isValid: pb.authStore.isValid,
    logout: () => pb.authStore.clear(),
    refresh: async () => {
      if (pb.authStore.isValid) {
        try { await pb.collection('users').authRefresh() } catch { pb.authStore.clear() }
        setUser(pb.authStore.record)
      }
    },
  }
}
