// Phase 2: score a dialogue using the 8-criterion rubric (6 individual + 2 collective).
// Each criterion scored 0-5 with decimals. Individual scores private, collective shared.
//
// Prompt and API config are overridable from the admin scoring lab: a custom
// prompt saved there (app_settings.scoring_prompt) becomes production's prompt,
// and whichever scoring_apis row is marked is_default becomes production's API.
// Falls back to the hardcoded default prompt / Anthropic Haiku config if unset.

const { DEFAULT_PROMPT, buildTranscript, callModel } = require(`${__hooks}/lib/scoringEngine.js`)

const FALLBACK_API = {
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  endpoint: 'https://api.anthropic.com/v1/messages',
  api_key_env: 'ANTHROPIC_API_KEY',
}

function getActivePrompt(app) {
  try {
    const v = app.findFirstRecordByFilter('app_settings', 'key = "scoring_prompt"').getString('value')
    if (v) return v
  } catch (_) {}
  return DEFAULT_PROMPT
}

function getActiveApi(app) {
  try {
    const row = app.findFirstRecordByFilter('scoring_apis', 'is_default = true')
    return {
      provider: row.getString('provider'),
      model: row.getString('model'),
      endpoint: row.getString('endpoint'),
      api_key_env: row.getString('api_key_env'),
    }
  } catch (_) {
    return FALLBACK_API
  }
}

function scoreDialogue(app, dialogueId) {
  const built = buildTranscript(app, dialogueId)
  if (!built) return null

  const prompt = getActivePrompt(app)
  const apiConfig = getActiveApi(app)

  const { ok, result, error } = callModel(prompt, built.transcript, apiConfig)
  if (!ok) {
    console.log(`[scoring] error: ${error}`)
    return null
  }
  return result
}

module.exports = { scoreDialogue }
