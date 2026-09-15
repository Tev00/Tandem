/// <reference path="../pb_data/types.d.ts" />
// Matcher triggers:
//  1) instantly whenever someone joins the queue,
//  2) every minute as a safety net (cron's finest resolution),
//  3) on demand via POST /api/matcher/run (superusers only) for testing.

onRecordAfterCreateSuccess((e) => {
  e.next()
  try { require(`${__hooks}/lib/matchmaking.js`).runMatcher(e.app) }
  catch (err) { console.log('[matcher] join-trigger error:', err) }
}, 'matchmaking_queue')

cronAdd('matcher', '* * * * *', () => {
  require(`${__hooks}/lib/matchmaking.js`).runMatcher($app)
})

routerAdd('POST', '/api/matcher/run', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const summary = require(`${__hooks}/lib/matchmaking.js`).runMatcher(e.app)
  return e.json(200, summary)
})
