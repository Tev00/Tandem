/// <reference path="../pb_data/types.d.ts" />
// Loaded by PocketBase on start. PocketBase already provides GET /api/health
// natively, so we don't register our own (doing so panics on boot).
onBootstrap((e) => {
  e.next()
  console.log('[enlice] hooks loaded')
})
