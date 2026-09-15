// Shared core used by both production scoring (scoring.js) and the admin
// scoring lab (admin_scoring.pb.js): build a transcript, call a model, parse
// the 8-criterion rubric result. Kept provider-agnostic on purpose — today
// only "anthropic" is implemented, but the shape supports adding others.

const DEFAULT_PROMPT = `Tu es un juge de qualité du dialogue. Tu évalues deux niveaux :

1. La qualité du discours de chaque participant.
2. La qualité de l'ouverture de chaque participant au dialogue et la valeur collective émergente.

Tu évalues uniquement des comportements observables.

ÉCHELLE : 0-5 (0=contraire, 1=très faible, 2=partiel, 3=correct, 4=bon, 5=excellent).
Pour chaque critère : score (decimal OK, ex 3.5) + justification courte + confiance (faible/moyen/élevé).
Les scores sont absolus, pas relatifs.

CRITÈRES INDIVIDUELS (pour chaque participant) :
1. RESPECT : dialogue sans humilier, mépriser, insulter, personnellement. Critique les idées, pas la personne.
2. CLARTÉ : propositions compréhensibles. Explicite position, termes importants, périmètre, critères, distinction fait/valeur/hypothèse.
3. ARGUMENTATION : soutient position par raisons explicites. Enchainement justificatif clair. Exemples utiles. Pas d'affirmations sans raisons ni sophismes.
4. NUANCE : reconnaît complexité, ambiguïté, exceptions, points valides chez l'autre. Qualifie certitude. Distingue cas, contextes, écarts.
5. ÉCOUTE ACTIVE : répond réellement à ce que l'autre a dit. Reprend, se rapporte à ce que l'autre a énoncé. Pas d'avalanche de nouveaux points pour esquiver. Pas de monologue parallèle.
6. FAIR PLAY : évalue honnêtement la position adverse. Critique une version raisonnable/forte, reconnaît points valides. Pas de caricature ni homme de paille.

CRITÈRES COLLECTIFS (pour le dialogue entier) :
1. CLARIFICATION MUTUELLE : le dialogue a permis une reconnaissance partagée des termes importants, du périmètre du désaccord, des points d'accord/désaccord, des valeurs en tension. Malentendus repérés et corrigés. Les participants peuvent dire ensemble "notre désaccord porte sur...".
2. CONSTRUCTION DU DIALOGUE : réponses qui reprennent le tour précédent. Questions suivies de réponses prises en compte. Enchaînements où une idée est reprise, modifiée ou prolongée. Les participants raisonnent sur le raisonnement de l'autre. Pas de simple juxtaposition d'arguments.

Réponds UNIQUEMENT en JSON (pas de markdown ni preamble) :
{
  "participantA": {
    "name": "<nom utilisé>",
    "respect": {"score": X.X, "justification": "...", "confiance": "faible/moyen/élevé"},
    "clarte": {...},
    "argumentation": {...},
    "nuance": {...},
    "ecoute_active": {...},
    "fair_play": {...}
  },
  "participantB": {
    "name": "<nom utilisé>",
    ... (same 6 criteria)
  },
  "collective": {
    "clarification_mutuelle": {"score": X.X, "justification": "...", "confiance": "faible/moyen/élevé"},
    "construction_dialogue": {"score": X.X, "justification": "...", "confiance": "faible/moyen/élevé"}
  }
}`

// Builds the transcript text + resolves the two participants for a dialogue.
// Returns null if the dialogue doesn't have a usable 2-participant transcript.
function buildTranscript(app, dialogueId) {
  try { app.findRecordById('dialogues', dialogueId) } catch (_) { return null }

  let msgs = []
  try {
    msgs = app.findRecordsByFilter('messages', 'dialogue = {:d} && is_prompt = false', 'created', 500, 0, { d: dialogueId })
  } catch (_) { return null }
  if (msgs.length === 0) return null

  const userIds = {}
  let transcript = ''
  const participants = []
  for (const m of msgs) {
    const sender = m.get('sender')
    if (!sender) continue
    if (!userIds[sender]) {
      let name = 'Participant'
      try { name = app.findRecordById('users', sender).getString('pseudonym') || name } catch (_) {}
      userIds[sender] = name
      participants.push(sender)
    }
    transcript += `${userIds[sender]}: ${m.getString('body')}\n`
  }

  if (participants.length < 2) return null
  const [participantA, participantB] = participants.slice(0, 2)
  return { transcript, participantA, participantB, pseudoA: userIds[participantA], pseudoB: userIds[participantB] }
}

// Calls a scoring model over a transcript with a given prompt + API config.
// apiConfig: { provider, model, endpoint, api_key_env }
// Returns { ok, result?, error?, duration_ms }
function callModel(prompt, transcript, apiConfig) {
  const start = Date.now()
  const provider = apiConfig && apiConfig.provider
  if (provider === 'anthropic') return callAnthropic(prompt, transcript, apiConfig, start)
  if (provider === 'openai' || provider === 'mistral') return callOpenAiCompatible(prompt, transcript, apiConfig, start)
  return { ok: false, error: `provider "${provider}" not supported yet`, duration_ms: Date.now() - start }
}

function extractJson(rawText, duration_ms) {
  const text = (rawText || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  if (!text) return { ok: false, error: 'empty response text', duration_ms }
  try {
    return { ok: true, result: JSON.parse(text), duration_ms }
  } catch (err) {
    return { ok: false, error: `parse error: ${err}`, duration_ms }
  }
}

function callAnthropic(prompt, transcript, apiConfig, start) {
  const apiKey = $os.getenv(apiConfig.api_key_env || 'ANTHROPIC_API_KEY')
  if (!apiKey) {
    return { ok: false, error: `env var ${apiConfig.api_key_env} not set`, duration_ms: Date.now() - start }
  }

  let response
  try {
    response = $http.send({
      url: apiConfig.endpoint || 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: apiConfig.model,
        max_tokens: 2500,
        messages: [{ role: 'user', content: `${prompt}\n\nTranscript:\n${transcript}` }],
      }),
      timeout: 30,
    })
  } catch (err) {
    return { ok: false, error: String(err), duration_ms: Date.now() - start }
  }

  const duration_ms = Date.now() - start
  if (response.statusCode !== 200) {
    return { ok: false, error: `API error ${response.statusCode}: ${JSON.stringify(response.json || {}).slice(0, 300)}`, duration_ms }
  }

  const data = response.json
  const raw = data.content && data.content[0] ? data.content[0].text : ''
  return extractJson(raw, duration_ms)
}

// OpenAI and Mistral both speak the same Chat Completions wire format
// (Mistral's API is intentionally OpenAI-compatible), so one implementation
// covers both providers — only the default endpoint/model differ.
function callOpenAiCompatible(prompt, transcript, apiConfig, start) {
  const apiKey = $os.getenv(apiConfig.api_key_env || '')
  if (!apiKey) {
    return { ok: false, error: `env var ${apiConfig.api_key_env} not set`, duration_ms: Date.now() - start }
  }

  let response
  try {
    response = $http.send({
      url: apiConfig.endpoint,
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: apiConfig.model,
        max_tokens: 2500,
        messages: [{ role: 'user', content: `${prompt}\n\nTranscript:\n${transcript}` }],
      }),
      timeout: 30,
    })
  } catch (err) {
    return { ok: false, error: String(err), duration_ms: Date.now() - start }
  }

  const duration_ms = Date.now() - start
  if (response.statusCode !== 200) {
    return { ok: false, error: `API error ${response.statusCode}: ${JSON.stringify(response.json || {}).slice(0, 300)}`, duration_ms }
  }

  const data = response.json
  const choice = data.choices && data.choices[0]
  const raw = choice && choice.message ? choice.message.content : ''
  return extractJson(raw, duration_ms)
}

module.exports = { DEFAULT_PROMPT, buildTranscript, callModel }
