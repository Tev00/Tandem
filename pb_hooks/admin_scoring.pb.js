/// <reference path="../pb_data/types.d.ts" />
// Admin scoring lab: customize the scoring prompt, manage scoring API configs,
// re-run scoring on finished dialogues N times to test stability, and export
// the results to CSV/Excel or push them to a Google Sheet.
//
// Every route handler requires its own shared helpers via lib/*.js instead of
// calling top-level functions defined in this file — PocketBase's JSVM
// compiles each routerAdd callback in isolation, so top-level function
// declarations here are NOT visible inside them (confirmed by testing).
// Same reason POST bodies are bound with `new DynamicModel({...})` instead of
// a plain `{}` object — bindBody() into a raw object fails with a Go-level
// "json: Unmarshal(non-pointer ...)" error on this PocketBase version.

// ── prompt ───────────────────────────────────────────────────────────────────

routerAdd('GET', '/api/admin/scoring/prompt', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const { DEFAULT_PROMPT } = require(`${__hooks}/lib/scoringEngine.js`)
  let custom = ''
  try { custom = app.findFirstRecordByFilter('app_settings', 'key = "scoring_prompt"').getString('value') } catch (_) {}
  return e.json(200, { prompt: custom || DEFAULT_PROMPT, is_custom: !!custom, default_prompt: DEFAULT_PROMPT })
})

routerAdd('POST', '/api/admin/scoring/prompt', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const data = new DynamicModel({ prompt: '' })
  e.bindBody(data)
  const prompt = (data.prompt || '').trim()
  if (!prompt) return e.json(400, { message: 'prompt vide' })
  let row
  try { row = app.findFirstRecordByFilter('app_settings', 'key = "scoring_prompt"') }
  catch (_) { row = new Record(app.findCollectionByNameOrId('app_settings')); row.set('key', 'scoring_prompt') }
  row.set('value', prompt)
  try { app.save(row) } catch (err) { return e.json(500, { message: String(err) }) }
  return e.json(200, { ok: true })
})

routerAdd('POST', '/api/admin/scoring/prompt/reset', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  try { app.delete(app.findFirstRecordByFilter('app_settings', 'key = "scoring_prompt"')) } catch (_) {}
  return e.json(200, { ok: true })
})

// ── API configs ──────────────────────────────────────────────────────────────

routerAdd('GET', '/api/admin/scoring/apis', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  let recs = []
  try { recs = app.findRecordsByFilter('scoring_apis', 'id != ""', 'name', 200, 0) } catch (_) {}
  return e.json(200, {
    apis: recs.map(r => ({
      id: r.id, name: r.getString('name'), provider: r.getString('provider'),
      model: r.getString('model'), endpoint: r.getString('endpoint'),
      api_key_env: r.getString('api_key_env'), is_default: r.getBool('is_default'),
    })),
  })
})

routerAdd('POST', '/api/admin/scoring/apis', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const data = new DynamicModel({ name: '', provider: '', model: '', endpoint: '', api_key_env: '', is_default: false })
  e.bindBody(data)
  if (!data.name || !data.provider || !data.model || !data.endpoint || !data.api_key_env)
    return e.json(400, { message: 'champs manquants (name, provider, model, endpoint, api_key_env)' })

  const rec = new Record(app.findCollectionByNameOrId('scoring_apis'))
  rec.set('name', data.name)
  rec.set('provider', data.provider)
  rec.set('model', data.model)
  rec.set('endpoint', data.endpoint)
  rec.set('api_key_env', data.api_key_env)
  rec.set('is_default', !!data.is_default)
  try { app.save(rec) } catch (err) { return e.json(500, { message: String(err) }) }

  if (data.is_default) {
    try {
      const others = app.findRecordsByFilter('scoring_apis', 'is_default = true && id != {:id}', '', 100, 0, { id: rec.id })
      for (const o of others) { o.set('is_default', false); app.save(o) }
    } catch (_) {}
  }
  return e.json(200, { id: rec.id })
})

routerAdd('POST', '/api/admin/scoring/apis/{id}/set-default', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const id = e.request.pathValue('id')
  let rec
  try { rec = app.findRecordById('scoring_apis', id) } catch (_) { return e.json(404, { message: 'not found' }) }
  rec.set('is_default', true)
  try { app.save(rec) } catch (err) { return e.json(500, { message: String(err) }) }
  try {
    const others = app.findRecordsByFilter('scoring_apis', 'is_default = true && id != {:id}', '', 100, 0, { id })
    for (const o of others) { o.set('is_default', false); app.save(o) }
  } catch (_) {}
  return e.json(200, { ok: true })
})

routerAdd('DELETE', '/api/admin/scoring/apis/{id}', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const id = e.request.pathValue('id')
  let rec
  try { rec = app.findRecordById('scoring_apis', id) } catch (_) { return e.json(404, { message: 'not found' }) }
  try { app.delete(rec) } catch (err) { return e.json(500, { message: String(err) }) }
  return e.json(200, { ok: true })
})

// ── run scoring N times ──────────────────────────────────────────────────────

routerAdd('POST', '/api/admin/scoring/run', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const data = new DynamicModel({ dialogueId: '', apiId: '', prompt: '', runs: 0 })
  e.bindBody(data)

  const dialogueId = data.dialogueId
  const apiId = data.apiId
  const promptText = (data.prompt || '').trim()
  let runsCount = parseInt(data.runs, 10) || 1
  if (runsCount < 1) runsCount = 1
  if (runsCount > 10) runsCount = 10

  if (!dialogueId) return e.json(400, { message: 'dialogueId requis' })
  if (!apiId) return e.json(400, { message: 'apiId requis' })

  let dialogue
  try { dialogue = app.findRecordById('dialogues', dialogueId) } catch (_) { return e.json(404, { message: 'dialogue introuvable' }) }
  if (dialogue.getString('status') !== 'ended') return e.json(400, { message: 'seuls les dialogues terminés peuvent être re-notés' })

  let apiRow
  try { apiRow = app.findRecordById('scoring_apis', apiId) } catch (_) { return e.json(404, { message: 'config API introuvable' }) }

  const { DEFAULT_PROMPT, buildTranscript, callModel } = require(`${__hooks}/lib/scoringEngine.js`)
  const built = buildTranscript(app, dialogueId)
  if (!built) return e.json(400, { message: 'pas de transcript exploitable pour ce dialogue' })

  const prompt = promptText || DEFAULT_PROMPT
  const apiConfig = {
    provider: apiRow.getString('provider'),
    model: apiRow.getString('model'),
    endpoint: apiRow.getString('endpoint'),
    api_key_env: apiRow.getString('api_key_env'),
  }

  const batchId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const results = []
  for (let i = 1; i <= runsCount; i++) {
    const out = callModel(prompt, built.transcript, apiConfig)
    try {
      const rec = new Record(app.findCollectionByNameOrId('scoring_test_runs'))
      rec.set('dialogue', dialogueId)
      rec.set('batch_id', batchId)
      rec.set('run_index', i)
      rec.set('api_name', apiRow.getString('name'))
      rec.set('model', apiConfig.model)
      rec.set('prompt', prompt)
      rec.set('result', out.ok ? out.result : null)
      rec.set('error', out.ok ? '' : String(out.error || 'unknown error'))
      rec.set('duration_ms', out.duration_ms || 0)
      app.save(rec)
    } catch (err) { console.log('[scoring-lab] save error:', err) }

    results.push({
      run_index: i, ok: out.ok, result: out.ok ? out.result : null,
      error: out.ok ? null : out.error, duration_ms: out.duration_ms,
    })
  }

  return e.json(200, {
    batch_id: batchId,
    pseudo_a: built.pseudoA,
    pseudo_b: built.pseudoB,
    runs: results,
  })
})

routerAdd('GET', '/api/admin/scoring/runs/{dialogueId}', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const dialogueId = e.request.pathValue('dialogueId')

  let recs = []
  try { recs = app.findRecordsByFilter('scoring_test_runs', 'dialogue = {:d}', '-created', 1000, 0, { d: dialogueId }) } catch (_) {}

  const batches = {}
  for (const r of recs) {
    const bid = r.getString('batch_id')
    if (!batches[bid]) {
      batches[bid] = {
        batch_id: bid, api_name: r.getString('api_name'), model: r.getString('model'),
        created: r.getString('created'), runs: [],
      }
    }
    batches[bid].runs.push({
      run_index: r.get('run_index'),
      result: r.get('result'),
      error: r.getString('error'),
      duration_ms: r.get('duration_ms'),
    })
  }
  const list = Object.values(batches).sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0))
  for (const b of list) b.runs.sort((a, c) => a.run_index - c.run_index)

  return e.json(200, { batches: list })
})

// ── export ───────────────────────────────────────────────────────────────────

routerAdd('POST', '/api/admin/scoring/export', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const data = new DynamicModel({ dialogueId: '', batchId: '' })
  e.bindBody(data)
  const { exportFilter, loadExportRows, rowsToCsv } = require(`${__hooks}/lib/scoringExport.js`)
  const { filter, params } = exportFilter(data.dialogueId, data.batchId)
  const rows = loadExportRows(app, filter, params)
  const csv = rowsToCsv(rows)
  return e.json(200, { filename: `scoring_export_${Date.now()}.csv`, csv, row_count: rows.length - 1 })
})

// ── Google Sheets integration ────────────────────────────────────────────────

routerAdd('GET', '/api/admin/integrations/google-sheets', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const { settingValue } = require(`${__hooks}/lib/scoringExport.js`)
  const clientId = settingValue(app, 'google_sheets_client_id')
  const clientSecretSet = !!settingValue(app, 'google_sheets_client_secret')
  const refreshTokenSet = !!settingValue(app, 'google_sheets_refresh_token')
  const spreadsheetId = settingValue(app, 'google_sheets_spreadsheet_id')
  return e.json(200, {
    client_id: clientId,
    client_secret_set: clientSecretSet,
    refresh_token_set: refreshTokenSet,
    spreadsheet_id: spreadsheetId,
    sheet_name: settingValue(app, 'google_sheets_sheet_name') || 'Scoring runs',
    configured: !!(clientId && clientSecretSet && refreshTokenSet && spreadsheetId),
  })
})

routerAdd('POST', '/api/admin/integrations/google-sheets', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const data = new DynamicModel({ client_id: '', client_secret: '', refresh_token: '', spreadsheet_id: '', sheet_name: '' })
  e.bindBody(data)

  function upsert(key, value) {
    if (!value) return
    let row
    try { row = app.findFirstRecordByFilter('app_settings', 'key = {:k}', { k: key }) }
    catch (_) { row = new Record(app.findCollectionByNameOrId('app_settings')); row.set('key', key) }
    row.set('value', value)
    app.save(row)
  }

  upsert('google_sheets_client_id', data.client_id)
  upsert('google_sheets_client_secret', data.client_secret)
  upsert('google_sheets_refresh_token', data.refresh_token)
  upsert('google_sheets_spreadsheet_id', data.spreadsheet_id)
  upsert('google_sheets_sheet_name', data.sheet_name)
  return e.json(200, { ok: true })
})

routerAdd('POST', '/api/admin/scoring/export/google-sheets', (e) => {
  if (!e.hasSuperuserAuth || !e.hasSuperuserAuth()) return e.json(403, { message: 'superusers only' })
  const app = e.app
  const data = new DynamicModel({ dialogueId: '', batchId: '' })
  e.bindBody(data)

  const { settingValue, exportFilter, loadExportRows } = require(`${__hooks}/lib/scoringExport.js`)
  const { filter, params } = exportFilter(data.dialogueId, data.batchId)
  const rows = loadExportRows(app, filter, params)
  if (rows.length <= 1) return e.json(400, { message: 'aucune donnée à exporter' })

  const clientId = settingValue(app, 'google_sheets_client_id')
  const clientSecret = settingValue(app, 'google_sheets_client_secret')
  const refreshToken = settingValue(app, 'google_sheets_refresh_token')
  const spreadsheetId = settingValue(app, 'google_sheets_spreadsheet_id')
  const sheetName = settingValue(app, 'google_sheets_sheet_name') || 'Scoring runs'

  if (!clientId || !clientSecret || !refreshToken || !spreadsheetId) {
    return e.json(400, { message: 'Google Sheets non configuré (voir Intégrations dans le labo de notation).' })
  }

  let tokenRes
  try {
    tokenRes = $http.send({
      url: 'https://oauth2.googleapis.com/token',
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&refresh_token=${encodeURIComponent(refreshToken)}&grant_type=refresh_token`,
      timeout: 15,
    })
  } catch (err) { return e.json(502, { message: `Erreur de connexion à Google : ${err}` }) }
  if (tokenRes.statusCode !== 200) return e.json(502, { message: `Échec du rafraîchissement du token Google : ${JSON.stringify(tokenRes.json)}` })
  const accessToken = tokenRes.json.access_token

  function appendValues() {
    const range = `${sheetName}!A1`
    return $http.send({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ values: rows }),
      timeout: 20,
    })
  }

  let appendRes
  try { appendRes = appendValues() } catch (err) { return e.json(502, { message: `Erreur Google Sheets : ${err}` }) }

  if (appendRes.statusCode === 400 && JSON.stringify(appendRes.json || {}).includes('Unable to parse range')) {
    try {
      $http.send({
        url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
        timeout: 15,
      })
      appendRes = appendValues()
    } catch (err) { return e.json(502, { message: `Impossible de créer l'onglet "${sheetName}" : ${err}` }) }
  }

  if (appendRes.statusCode !== 200) {
    return e.json(502, { message: `Échec de l'envoi vers Google Sheets : ${JSON.stringify(appendRes.json || {}).slice(0, 400)}` })
  }

  return e.json(200, { ok: true, appended_rows: rows.length - 1 })
})
