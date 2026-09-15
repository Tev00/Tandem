// Tandem matcher: clash + common ground, relaxation when small, never re-match,
// concurrent cap, seed prompts. Logs a summary each run for troubleshooting.
const CAP = 1
const DURATION_DAYS = 7

function fmt(d) { return d.toISOString().replace('T', ' ') }
function pairKey(a, b) { return [a, b].sort().join('_') }

function vectorFor(app, userId) {
  const ops = app.findRecordsByFilter('opinions', 'user = {:u} && topic.is_active = true', '', 500, 0, { u: userId })
  const v = {}
  for (const o of ops) v[o.get('topic')] = o.get('stance')
  return v
}
function activeCount(app, userId) {
  return app.findRecordsByFilter('dialogues',
    'status = "active" && (participant_a = {:u} || participant_b = {:u})', '', 100, 0, { u: userId }).length
}
function pairExists(app, key) {
  try { app.findFirstRecordByFilter('dialogues', 'pair_key = {:k}', { k: key }); return true } catch (_) { return false }
}

function runMatcher(app) {
  const summary = { queue: 0, eligible: 0, skipOnboarding: 0, skipInactive: 0, skipCap: 0, pairs: 0, matched: 0 }

  // Respect pause flag from admin panel
  try {
    const s = app.findFirstRecordByFilter('app_settings', 'key = "matchmaking_enabled"')
    if (s.getString('value') === 'false') {
      console.log('[matcher] paused — skipping run')
      return summary
    }
  } catch (_) {} // collection may not exist yet; default = enabled

  let queue = []
  try { queue = app.findRecordsByFilter('matchmaking_queue', 'id != ""', 'joined_at', 200, 0) }
  catch (err) { console.log('[matcher] queue read failed:', err); return summary }
  summary.queue = queue.length

  const elig = []
  for (const q of queue) {
    const uid = q.get('user')
    let u; try { u = app.findRecordById('users', uid) } catch (_) { continue }
    if (!u.getBool('onboarding_complete')) { summary.skipOnboarding++; continue }
    if (!u.getBool('is_active')) { summary.skipInactive++; continue }
    if (activeCount(app, uid) >= CAP) { summary.skipCap++; continue }
    elig.push({ qid: q.id, uid, pseudo: u.getString('pseudonym') || 'Anonyme', vec: vectorFor(app, uid) })
  }
  summary.eligible = elig.length

  const pairs = []
  for (let i = 0; i < elig.length; i++) for (let j = i + 1; j < elig.length; j++) {
    const A = elig[i], B = elig[j]
    const key = pairKey(A.uid, B.uid)
    if (pairExists(app, key)) continue
    let clashMax = 0, clashTopic = null, shared = 0, common = 0
    for (const t in A.vec) {
      if (B.vec[t] == null) continue
      common++
      const diff = Math.abs(A.vec[t] - B.vec[t])
      if (diff <= 1) shared++
      if (diff > clashMax) { clashMax = diff; clashTopic = t }
    }
    if (common === 0 || clashMax < 1) continue
    const tier = (clashMax >= 3 && shared >= 1) ? 3 : (clashMax >= 2 ? 2 : 1)
    pairs.push({ A, B, key, clashMax, clashTopic, shared, tier, r: Math.random() })
  }
  summary.pairs = pairs.length
  pairs.sort((x, y) => y.tier - x.tier || y.shared - x.shared || y.clashMax - x.clashMax || x.r - y.r)

  const used = {}
  for (const p of pairs) {
    if (used[p.A.uid] || used[p.B.uid]) continue
    used[p.A.uid] = true; used[p.B.uid] = true
    try { openDialogue(app, p); summary.matched++; console.log(`[matcher] matched ${p.A.pseudo} x ${p.B.pseudo} tier=${p.tier} clash=${p.clashMax}`) }
    catch (err) { console.log('[matcher] open failed:', err); used[p.A.uid] = false; used[p.B.uid] = false }
  }

  console.log(`[matcher] queue=${summary.queue} eligible=${summary.eligible} (skipOnboarding=${summary.skipOnboarding} skipInactive=${summary.skipInactive} skipCap=${summary.skipCap}) pairs=${summary.pairs} matched=${summary.matched}`)
  return summary
}

function openDialogue(app, p) {
  // Re-check immediately before saving to reduce (not eliminate) the concurrent-match race.
  // The pair_key UNIQUE constraint is the hard atomic guard; these checks catch the
  // same-user-matched-twice case that the constraint alone cannot prevent.
  if (pairExists(app, p.key)) throw new Error('pair already exists')
  if (activeCount(app, p.A.uid) >= CAP) throw new Error(`${p.A.pseudo} already has an active dialogue`)
  if (activeCount(app, p.B.uid) >= CAP) throw new Error(`${p.B.pseudo} already has an active dialogue`)

  const d = new Record(app.findCollectionByNameOrId('dialogues'))
  d.set('participant_a', p.A.uid); d.set('participant_b', p.B.uid)
  d.set('topic', p.clashTopic); d.set('pair_key', p.key)
  d.set('status', 'active'); d.set('current_turn', p.A.uid)
  d.set('expires_at', fmt(new Date(Date.now() + DURATION_DAYS * 86400000)))
  app.save(d)
  let label = 'votre sujet'
  try { label = app.findRecordById('topics', p.clashTopic).getString('label') } catch (_) {}
  seed(app, d.id, `Vous n'êtes pas d'accord sur : « ${label} ».`)
  seed(app, d.id, `${p.A.pseudo}, à toi d'ouvrir — qu'est-ce qui fonde ta position ? ${p.B.pseudo}, cherche d'abord à comprendre avant de répondre.`)
  const { notify } = require(`${__hooks}/lib/notify.js`)
  notify(app, p.A.uid, 'match_found', { dialogue: d.id, topic: label })
  notify(app, p.B.uid, 'match_found', { dialogue: d.id, topic: label })
  try { app.delete(app.findRecordById('matchmaking_queue', p.A.qid)) } catch (_) {}
  try { app.delete(app.findRecordById('matchmaking_queue', p.B.qid)) } catch (_) {}
}
function seed(app, dialogueId, body) {
  const m = new Record(app.findCollectionByNameOrId('messages'))
  m.set('dialogue', dialogueId); m.set('is_prompt', true); m.set('body', body)
  app.save(m)
}

module.exports = { runMatcher }
