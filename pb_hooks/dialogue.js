// Dialogue lifecycle helpers.
function fmt(d) { return d.toISOString().replace('T', ' ') }

function other(d, who) {
  const a = d.get('participant_a'), b = d.get('participant_b')
  return who === a ? b : a
}

function onMessage(app, dialogueId, senderId) {
  let d; try { d = app.findRecordById('dialogues', dialogueId) } catch (_) { return }
  if (d.getString('status') !== 'active') return
  const next = other(d, senderId)
  d.set('current_turn', next)
  app.save(d)
  require(`${__hooks}/lib/notify.js`).notify(app, next, 'your_turn', { dialogue: dialogueId })
}

function writeIndividualScore(app, dialogueId, userId, participantResult) {
  try {
    const s = new Record(app.findCollectionByNameOrId('dialogue_participant_scores'))
    s.set('dialogue', dialogueId)
    s.set('user', userId)
    s.set('respect', participantResult.respect.score)
    s.set('clarte', participantResult.clarte.score)
    s.set('argumentation', participantResult.argumentation.score)
    s.set('nuance', participantResult.nuance.score)
    s.set('ecoute_active', participantResult.ecoute_active.score)
    s.set('fair_play', participantResult.fair_play.score)
    const avg = (participantResult.respect.score + participantResult.clarte.score +
                 participantResult.argumentation.score + participantResult.nuance.score +
                 participantResult.ecoute_active.score + participantResult.fair_play.score) / 6
    s.set('individual_avg', avg)
    app.save(s)
  } catch (err) { console.log('[scoring] write error:', err) }
}

function runScoring(app, dialogueId, aId, bId) {
  let result = null
  try {
    result = require(`${__hooks}/scoring.js`).scoreDialogue(app, dialogueId)
  } catch (err) {
    console.log('[scoring] error for dialogue', dialogueId, ':', err)
  }

  if (result) {
    // Write individual scores BEFORE saving collective_criteria.
    // The onRecordAfterUpdateSuccess hook re-fires when collective_criteria
    // is saved; individual scores must already exist so the duplicate check
    // returns early and avoids a second scoring call.
    writeIndividualScore(app, dialogueId, aId, result.participantA)
    writeIndividualScore(app, dialogueId, bId, result.participantB)
    try {
      const d = app.findRecordById('dialogues', dialogueId)
      const collAvg = (result.collective.clarification_mutuelle.score + result.collective.construction_dialogue.score) / 2
      d.set('collective_criteria', {
        clarification_mutuelle: result.collective.clarification_mutuelle.score,
        construction_dialogue: result.collective.construction_dialogue.score,
        collective_avg: collAvg,
      })
      app.save(d)
    } catch (err) { console.log('[scoring] collective write error:', err) }
  } else {
    const zero = { score: 0, justification: '-', confiance: 'faible' }
    const stub = { respect: zero, clarte: zero, argumentation: zero, nuance: zero, ecoute_active: zero, fair_play: zero }
    writeIndividualScore(app, dialogueId, aId, stub)
    writeIndividualScore(app, dialogueId, bId, stub)
  }
}

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
    notify(app, d.get('participant_a'), 'dialogue_ended', { dialogue: d.id })
    notify(app, d.get('participant_b'), 'dialogue_ended', { dialogue: d.id })
  }
}

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

module.exports = { onMessage, expireDialogues, leaveDialogue, runScoring }
