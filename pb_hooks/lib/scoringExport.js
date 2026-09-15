// Shared by the admin scoring lab routes. Must be required() inside each
// route handler, not called as a bare top-level function — PocketBase's
// JSVM compiles each routerAdd callback in isolation, so top-level
// function declarations in a .pb.js file are NOT visible inside them
// (confirmed empirically: same-file top-level helpers throw
// "ReferenceError: ... is not defined" when called from a routerAdd callback).

function settingValue(app, key) {
  try { return app.findFirstRecordByFilter('app_settings', 'key = {:k}', { k: key }).getString('value') } catch (_) { return '' }
}

function loadExportRows(app, filter, params) {
  let recs = []
  try { recs = app.findRecordsByFilter('scoring_test_runs', filter, '-created', 5000, 0, params) } catch (_) {}

  const rows = [[
    'dialogue_id', 'pseudo_a', 'pseudo_b', 'topic', 'batch_id', 'run_index', 'api_name', 'model',
    'scope', 'subject', 'criterion', 'score', 'confiance', 'justification', 'error', 'duration_ms', 'created',
  ]]

  const dialogueCache = {}, userCache = {}, topicCache = {}
  function pseudoOf(id) {
    if (!id) return ''
    if (userCache[id] !== undefined) return userCache[id]
    let name = ''
    try { name = app.findRecordById('users', id).getString('pseudonym') || '' } catch (_) {}
    userCache[id] = name
    return name
  }
  function dialogueMeta(id) {
    if (dialogueCache[id]) return dialogueCache[id]
    let d, topicLabel = ''
    try {
      d = app.findRecordById('dialogues', id)
      const tId = d.getString('topic')
      if (tId) {
        if (topicCache[tId] === undefined) {
          try { topicCache[tId] = app.findRecordById('topics', tId).getString('label') } catch (_) { topicCache[tId] = '' }
        }
        topicLabel = topicCache[tId]
      }
    } catch (_) {}
    const meta = { pseudoA: d ? pseudoOf(d.getString('participant_a')) : '', pseudoB: d ? pseudoOf(d.getString('participant_b')) : '', topic: topicLabel }
    dialogueCache[id] = meta
    return meta
  }

  const criteriaIndividual = ['respect', 'clarte', 'argumentation', 'nuance', 'ecoute_active', 'fair_play']
  const criteriaCollective = ['clarification_mutuelle', 'construction_dialogue']

  // record.get() on a JSONField returns PocketBase's JSONRaw byte-array
  // wrapper, not a parsed object — plain JS property access on it silently
  // returns undefined for everything. Must go through .string() + JSON.parse.
  function parseResult(raw) {
    if (raw === null || raw === undefined) return null
    if (typeof raw === 'object' && typeof raw.string === 'function') {
      try { return JSON.parse(raw.string()) } catch (_) { return null }
    }
    return raw
  }

  for (const r of recs) {
    const did = r.getString('dialogue')
    const meta = dialogueMeta(did)
    const base = [did, meta.pseudoA, meta.pseudoB, meta.topic, r.getString('batch_id'), r.get('run_index'), r.getString('api_name'), r.getString('model')]
    const err = r.getString('error')
    const created = r.getString('created')
    const result = parseResult(r.get('result'))

    if (err || !result) {
      rows.push(base.concat(['', '', '', '', '', err || 'no result', r.get('duration_ms'), created]))
      continue
    }

    for (const who of ['participantA', 'participantB']) {
      const p = result[who]
      if (!p) continue
      const subject = p.name || (who === 'participantA' ? meta.pseudoA : meta.pseudoB)
      for (const c of criteriaIndividual) {
        const cell = p[c]
        if (!cell) continue
        rows.push(base.concat(['individual', subject, c, cell.score, cell.confiance || cell.confidence || '', cell.justification || '', '', r.get('duration_ms'), created]))
      }
    }
    if (result.collective) {
      for (const c of criteriaCollective) {
        const cell = result.collective[c]
        if (!cell) continue
        rows.push(base.concat(['collective', 'collective', c, cell.score, cell.confiance || cell.confidence || '', cell.justification || '', '', r.get('duration_ms'), created]))
      }
    }
  }
  return rows
}

function rowsToCsv(rows) {
  return rows.map(row => row.map(v => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\n')
}

function exportFilter(dialogueId, batchId) {
  const conditions = []
  const params = {}
  if (dialogueId) { conditions.push('dialogue = {:d}'); params.d = dialogueId }
  if (batchId) { conditions.push('batch_id = {:b}'); params.b = batchId }
  return { filter: conditions.length ? conditions.join(' && ') : 'id != ""', params }
}

module.exports = { settingValue, loadExportRows, rowsToCsv, exportFilter }
