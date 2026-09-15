import PocketBase from 'pocketbase'

// In production the SPA is served by PocketBase itself (same origin).
// For local dev against the remote box, set VITE_PB_URL=https://enlice.eu
export const pb = new PocketBase(import.meta.env.VITE_PB_URL || window.location.origin)
pb.autoCancellation(false)
