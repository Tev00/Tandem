/// <reference path="../pb_data/types.d.ts" />

// GET /api/admin/stats — full dashboard snapshot
routerAdd('GET', '/api/admin/stats', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })

  const app = e.app
  try {
    let matchmakingEnabled = true
    try {
      const meSetting = app.findFirstRecordByFilter('app_settings', 'key = "matchmaking_enabled"')
      matchmakingEnabled = meSetting.getString('value') !== 'false'
    } catch (_) {}

    let queueSize = 0
    try { queueSize = app.findRecordsByFilter('matchmaking_queue', 'id != ""', '', 1000, 0).length } catch (_) {}

    // Topic labels
    const topicMap = {}
    try {
      for (const t of app.findRecordsByFilter('topics', 'id != ""', '', 500, 0))
        topicMap[t.id] = t.getString('label')
    } catch (_) {}

    // All users
    const allUsers = []
    try {
      const recs = app.findRecordsByFilter('users', 'id != ""', '-created', 1000, 0)
      for (const u of recs) allUsers.push(u)
    } catch (_) {}

    const userPseudo = {}
    for (const u of allUsers) userPseudo[u.id] = u.getString('pseudonym') || '-'

    // Dialogues
    const activeDialogues = []
    try {
      const recs = app.findRecordsByFilter('dialogues', 'status = "active"', '', 500, 0)
      for (const d of recs) activeDialogues.push(d)
    } catch (_) {}

    const endedDialogues = []
    try {
      const recs = app.findRecordsByFilter('dialogues', 'status = "ended"', '', 500, 0)
      for (const d of recs) endedDialogues.push(d)
    } catch (_) {}

    // IDs in active/any dialogue
    const inDialogueIds = {}
    for (const d of activeDialogues) {
      inDialogueIds[d.getString('participant_a')] = true
      inDialogueIds[d.getString('participant_b')] = true
    }
    const everMatchedIds = {}
    for (const d of activeDialogues) {
      everMatchedIds[d.getString('participant_a')] = true
      everMatchedIds[d.getString('participant_b')] = true
    }
    for (const d of endedDialogues) {
      everMatchedIds[d.getString('participant_a')] = true
      everMatchedIds[d.getString('participant_b')] = true
    }

    // User list + funnel
    const funnel = { in_dialogue: 0, ever_matched: 0, onboarding_complete: 0, has_pseudo: 0, signed_up: 0 }
    const userList = []
    for (const u of allUsers) {
      const uid = u.id
      let stage
      if (inDialogueIds[uid])                 stage = 'in_dialogue'
      else if (everMatchedIds[uid])            stage = 'ever_matched'
      else if (u.getBool('onboarding_complete')) stage = 'onboarding_complete'
      else if (u.getString('pseudonym'))       stage = 'has_pseudo'
      else                                      stage = 'signed_up'
      funnel[stage]++
      userList.push({
        id: uid,
        pseudo: u.getString('pseudonym') || '-',
        email: u.getString('email') || '',
        stage,
        is_active: u.getBool('is_active'),
        created: u.getString('created'),
      })
    }

    // Scores by dialogue
    const scoresByDialogue = {}
    try {
      const recs = app.findRecordsByFilter('dialogue_participant_scores', 'id != ""', '', 2000, 0)
      for (const s of recs) {
        const did = s.getString('dialogue')
        if (!scoresByDialogue[did]) scoresByDialogue[did] = []
        scoresByDialogue[did].push({
          user: s.getString('user'),
          pseudo: userPseudo[s.getString('user')] || '-',
          avg: parseFloat(s.get('individual_avg') || 0),
          respect: parseFloat(s.get('respect') || 0),
          clarte: parseFloat(s.get('clarte') || 0),
          argumentation: parseFloat(s.get('argumentation') || 0),
          nuance: parseFloat(s.get('nuance') || 0),
          ecoute_active: parseFloat(s.get('ecoute_active') || 0),
          fair_play: parseFloat(s.get('fair_play') || 0),
        })
      }
    } catch (scoreErr) { console.log('[admin/stats] scores error:', scoreErr) }

    const activeData = []
    for (const d of activeDialogues) {
      activeData.push({
        id: d.id,
        pseudo_a: userPseudo[d.getString('participant_a')] || '-',
        pseudo_b: userPseudo[d.getString('participant_b')] || '-',
        participant_a: d.getString('participant_a'),
        participant_b: d.getString('participant_b'),
        topic: topicMap[d.getString('topic')] || '-',
        current_turn_id: d.getString('current_turn'),
        current_turn_pseudo: userPseudo[d.getString('current_turn')] || '-',
        started: d.getString('created'),
      })
    }

    const endedData = []
    for (const d of endedDialogues) {
      let collective = null
      try { const raw = d.getString('collective_criteria'); if (raw) collective = JSON.parse(raw) } catch (_) {}
      endedData.push({
        id: d.id,
        pseudo_a: userPseudo[d.getString('participant_a')] || '-',
        pseudo_b: userPseudo[d.getString('participant_b')] || '-',
        participant_a: d.getString('participant_a'),
        participant_b: d.getString('participant_b'),
        topic: topicMap[d.getString('topic')] || '-',
        end_reason: d.getString('end_reason'),
        ended: d.getString('updated'),
        scores: scoresByDialogue[d.id] || [],
        collective,
      })
    }

    return e.json(200, {
      matchmaking_enabled: matchmakingEnabled,
      queue_size: queueSize,
      funnel,
      users: userList,
      dialogues: { active: activeData, ended: endedData },
    })
  } catch (err) {
    console.log('[admin/stats] error:', err)
    return e.json(500, { message: String(err) })
  }
})

// POST /api/admin/matchmaking/toggle
routerAdd('POST', '/api/admin/matchmaking/toggle', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  let s
  try { s = app.findFirstRecordByFilter('app_settings', 'key = "matchmaking_enabled"') }
  catch (_) { return e.json(500, { message: 'settings not found' }) }
  const current = s.getString('value') !== 'false'
  s.set('value', current ? 'false' : 'true')
  app.save(s)
  return e.json(200, { matchmaking_enabled: !current })
})

// POST /api/admin/dialogues/end-all
routerAdd('POST', '/api/admin/dialogues/end-all', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  let active = []
  try { active = app.findRecordsByFilter('dialogues', 'status = "active"', '', 1000, 0) } catch (_) {}
  let count = 0
  for (const d of active) {
    d.set('status', 'ended')
    d.set('end_reason', 'moderation')
    try { app.save(d); count++ } catch (_) {}
  }
  return e.json(200, { ended: count })
})

// POST /api/admin/user/:userId/toggle-active
routerAdd('POST', '/api/admin/user/{userId}/toggle-active', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const userId = e.request.pathValue('userId')
  let u
  try { u = app.findRecordById('users', userId) }
  catch (_) { return e.json(404, { message: 'not found' }) }
  const next = !u.getBool('is_active')
  u.set('is_active', next)
  try { app.save(u) } catch (err) { return e.json(500, { message: String(err) }) }
  return e.json(200, { is_active: next })
})

// POST /api/admin/dialogue/:dialogueId/end
routerAdd('POST', '/api/admin/dialogue/{dialogueId}/end', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const dialogueId = e.request.pathValue('dialogueId')
  let d
  try { d = app.findRecordById('dialogues', dialogueId) }
  catch (_) { return e.json(404, { message: 'not found' }) }
  if (d.getString('status') !== 'active') return e.json(400, { message: 'not active' })
  d.set('status', 'ended')
  d.set('end_reason', 'moderation')
  try { app.save(d) } catch (err) { return e.json(500, { message: String(err) }) }
  return e.json(200, { ok: true })
})

// GET /api/admin/match-preview/{userA}/{userB} — clash analysis (same algorithm as matchmaking)
routerAdd('GET', '/api/admin/match-preview/{userA}/{userB}', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const uidA = e.request.pathValue('userA')
  const uidB = e.request.pathValue('userB')

  const vecA = {}, vecB = {}
  try {
    const ops = app.findRecordsByFilter('opinions', 'user = {:u} && topic.is_active = true', '', 500, 0, { u: uidA })
    for (const o of ops) vecA[o.getString('topic')] = parseFloat(o.get('stance'))
  } catch (_) {}
  try {
    const ops = app.findRecordsByFilter('opinions', 'user = {:u} && topic.is_active = true', '', 500, 0, { u: uidB })
    for (const o of ops) vecB[o.getString('topic')] = parseFloat(o.get('stance'))
  } catch (_) {}

  let clashMax = 0, clashTopic = null, shared = 0, common = 0
  for (const t in vecA) {
    if (vecB[t] == null) continue
    common++
    const diff = Math.abs(vecA[t] - vecB[t])
    if (diff <= 1) shared++
    if (diff > clashMax) { clashMax = diff; clashTopic = t }
  }
  const tier = common === 0 ? 0 : (clashMax >= 3 && shared >= 1) ? 3 : (clashMax >= 2 ? 2 : 1)

  let clashTopicLabel = null
  if (clashTopic) {
    try { clashTopicLabel = app.findRecordById('topics', clashTopic).getString('label') } catch (_) {}
  }

  const pairKeyStr = [uidA, uidB].sort().join('_')
  let alreadyMatched = false, alreadyMatchedId = null
  try {
    const existing = app.findFirstRecordByFilter('dialogues', 'pair_key = {:k}', { k: pairKeyStr })
    alreadyMatched = true; alreadyMatchedId = existing.id
  } catch (_) {}

  return e.json(200, {
    common, shared, clash_max: clashMax, tier,
    clash_topic_id: clashTopic, clash_topic_label: clashTopicLabel,
    already_matched: alreadyMatched, already_matched_id: alreadyMatchedId,
    can_match: !alreadyMatched,
  })
})

// POST /api/admin/match-force — force a dialogue between two users (bypasses queue and cap)
routerAdd('POST', '/api/admin/match-force', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app

  const body = new DynamicModel({ a: '', b: '' })
  e.bindBody(body)
  const uidA = body.a, uidB = body.b
  if (!uidA || !uidB || uidA === uidB) return e.json(400, { message: 'need two distinct user ids' })

  let pseudoA = 'Anonyme', pseudoB = 'Anonyme'
  try { pseudoA = app.findRecordById('users', uidA).getString('pseudonym') || 'Anonyme' } catch (_) { return e.json(404, { message: 'user A not found' }) }
  try { pseudoB = app.findRecordById('users', uidB).getString('pseudonym') || 'Anonyme' } catch (_) { return e.json(404, { message: 'user B not found' }) }

  const pairKeyStr = [uidA, uidB].sort().join('_')
  try { app.findFirstRecordByFilter('dialogues', 'pair_key = {:k}', { k: pairKeyStr }); return e.json(409, { message: 'already matched' }) } catch (_) {}

  const vecA = {}, vecB = {}
  try {
    const ops = app.findRecordsByFilter('opinions', 'user = {:u} && topic.is_active = true', '', 500, 0, { u: uidA })
    for (const o of ops) vecA[o.getString('topic')] = parseFloat(o.get('stance'))
  } catch (_) {}
  try {
    const ops = app.findRecordsByFilter('opinions', 'user = {:u} && topic.is_active = true', '', 500, 0, { u: uidB })
    for (const o of ops) vecB[o.getString('topic')] = parseFloat(o.get('stance'))
  } catch (_) {}

  let clashMax = 0, clashTopic = null
  for (const t in vecA) {
    if (vecB[t] == null) continue
    const diff = Math.abs(vecA[t] - vecB[t])
    if (diff > clashMax) { clashMax = diff; clashTopic = t }
  }
  if (!clashTopic) {
    for (const t in vecA) { if (vecB[t] != null) { clashTopic = t; break } }
  }

  let topicLabel = 'sujet à définir'
  if (clashTopic) {
    try { topicLabel = app.findRecordById('topics', clashTopic).getString('label') } catch (_) {}
  }

  const expires = new Date(Date.now() + 7 * 86400000).toISOString().replace('T', ' ')
  const d = new Record(app.findCollectionByNameOrId('dialogues'))
  d.set('participant_a', uidA); d.set('participant_b', uidB)
  if (clashTopic) d.set('topic', clashTopic)
  d.set('pair_key', pairKeyStr)
  d.set('status', 'active'); d.set('current_turn', uidA)
  d.set('expires_at', expires)
  try { app.save(d) } catch (err) { return e.json(500, { message: String(err) }) }

  function seedMsg(text) {
    const m = new Record(app.findCollectionByNameOrId('messages'))
    m.set('dialogue', d.id); m.set('is_prompt', true); m.set('body', text)
    app.save(m)
  }
  seedMsg(`Vous n'êtes pas d'accord sur : « ${topicLabel} ».`)
  seedMsg(`${pseudoA}, à toi d'ouvrir — qu'est-ce qui fonde ta position ? ${pseudoB}, cherche d'abord à comprendre avant de répondre.`)

  try {
    const { notify } = require(`${__hooks}/lib/notify.js`)
    notify(app, uidA, 'match_found', { dialogue: d.id, topic: topicLabel })
    notify(app, uidB, 'match_found', { dialogue: d.id, topic: topicLabel })
  } catch (_) {}

  return e.json(200, { ok: true, dialogue_id: d.id, topic: topicLabel })
})

// GET /api/admin/dialogue/:dialogueId/messages
routerAdd('GET', '/api/admin/dialogue/{dialogueId}/messages', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const dialogueId = e.request.pathValue('dialogueId')

  let d
  try { d = app.findRecordById('dialogues', dialogueId) }
  catch (_) { return e.json(404, { message: 'dialogue not found' }) }

  const userPseudo = {}
  try {
    const a = app.findRecordById('users', d.getString('participant_a'))
    userPseudo[a.id] = a.getString('pseudonym') || '—'
  } catch (_) {}
  try {
    const b = app.findRecordById('users', d.getString('participant_b'))
    userPseudo[b.id] = b.getString('pseudonym') || '—'
  } catch (_) {}

  let messages = []
  try {
    messages = app.findRecordsByFilter('messages', 'dialogue = {:d}', 'created', 500, 0, { d: dialogueId })
  } catch (_) {}

  return e.json(200, {
    messages: messages.map(m => ({
      id: m.id,
      sender: m.getString('sender'),
      sender_pseudo: userPseudo[m.getString('sender')] || '—',
      body: m.getString('body'),
      is_prompt: m.getBool('is_prompt'),
      created: m.getString('created'),
    })),
  })
})
