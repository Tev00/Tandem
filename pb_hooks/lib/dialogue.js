// Dialogue lifecycle helpers.
function fmt(d) { return d.toISOString().replace('T', ' ') }

function other(d, who) {
  const a = d.get('participant_a'), b = d.get('participant_b')
  return who === a ? b : a
}

// On a real reply: hand the turn to the other person and notify them.
function onMessage(app, dialogueId, senderId) {
  let d; try { d = app.findRecordById('dialogues', dialogueId) } catch (_) { return }
  if (d.getString('status') !== 'active') return
  const next = other(d, senderId)
  d.set('current_turn', next)
  app.save(d)
  require(`${__hooks}/lib/notify.js`).notify(app, next, 'your_turn', { dialogue: dialogueId })
}

// End every active dialogue past its expires_at.
function expireDialogues(app) {
  const now = fmt(new Date())
  let due = []
  try {
    due = app.findRecordsByFilter('dialogues',
      'status = "active" && expires_at != "" && expires_at < {:now}', '', 200, 0, { now })
  } catch (_) { return }
  const { notify } = require(`${__hooks}/lib/notify.js`)
  for (const d of due) {
    d.set('status', 'ended')
    d.set('end_reason', 'time_limit')
    d.set('ended_at', now)
    app.save(d)
    // PHASE 2: scoreDialogue() goes here, before notifying, so the bilan has scores.
    notify(app, d.get('participant_a'), 'dialogue_ended', { dialogue: d.id })
    notify(app, d.get('participant_b'), 'dialogue_ended', { dialogue: d.id })
  }
}

// A participant leaves -> end the dialogue.
function leaveDialogue(app, dialogueId, userId) {
  let d; try { d = app.findRecordById('dialogues', dialogueId) } catch (_) { return false }
  if (d.getString('status') !== 'active') return false
  const a = d.get('participant_a'), b = d.get('participant_b')
  if (userId !== a && userId !== b) return false
  d.set('status', 'ended')
  d.set('end_reason', 'left')
  d.set('ended_at', fmt(new Date()))
  app.save(d)
  require(`${__hooks}/lib/notify.js`).notify(app, other(d, userId), 'dialogue_ended', { dialogue: dialogueId })
  return true
}

module.exports = { onMessage, expireDialogues, leaveDialogue }
