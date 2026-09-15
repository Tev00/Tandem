/// <reference path="../pb_data/types.d.ts" />
// After every real (non-prompt) message, hand the turn to the other participant.
onRecordAfterCreateSuccess((e) => {
  e.next()
  if (e.record.getBool('is_prompt')) return
  const sender = e.record.getString('sender')
  if (!sender) return // system message
  try {
    require(`${__hooks}/lib/dialogue.js`).onMessage(e.app, e.record.getString('dialogue'), sender)
  } catch (err) {
    console.log('[messages] onMessage error:', err)
  }
}, 'messages')
