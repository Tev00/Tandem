/// <reference path="../pb_data/types.d.ts" />

onBootstrap((e) => {
  e.next()
  console.log('[enlice] hooks loaded')
})

// Auto-end dialogues past their expires_at every minute.
cronAdd('dialogue_expiry', '* * * * *', () => {
  require(`${__hooks}/dialogue.js`).expireDialogues($app)
})

// Score any dialogue that transitions to "ended" (covers admin panel + leave endpoint).
onRecordAfterUpdateSuccess((e) => {
  e.next()
  if (e.record.getString('status') !== 'ended') return
  const dialogueId = e.record.id
  const aId = e.record.getString('participant_a')
  const bId = e.record.getString('participant_b')
  // Skip if scores already exist (e.g. leaveDialogue already wrote them).
  try {
    const existing = e.app.findRecordsByFilter(
      'dialogue_participant_scores', 'dialogue = {:d}', '', 1, 0, { d: dialogueId }
    )
    if (existing.length > 0) return
  } catch (_) {}
  try {
    require(`${__hooks}/dialogue.js`).runScoring(e.app, dialogueId, aId, bId)
  } catch (err) {
    console.log('[dialogue/update] scoring error:', err)
  }
}, 'dialogues')

// Participant leave endpoint: POST /api/dialogue/:dialogueId/leave
routerAdd('POST', '/api/dialogue/{dialogueId}/leave', (e) => {
  const dialogueId = e.request.pathValue('dialogueId')
  const userId = e.auth?.id

  if (!userId) return e.json(401, { message: 'Unauthorized' })
  if (!dialogueId) return e.json(400, { message: 'Missing dialogueId' })

  try {
    const result = require(`${__hooks}/dialogue.js`).leaveDialogue(e.app, dialogueId, userId)
    if (result) {
      return e.json(200, { message: 'Dialogue ended' })
    } else {
      return e.json(400, { message: 'Cannot leave this dialogue (not a participant or already ended)' })
    }
  } catch (err) {
    console.log('[dialogue/leave] error:', err)
    return e.json(500, { message: 'Internal server error' })
  }
}, $apis.requireAuth())
