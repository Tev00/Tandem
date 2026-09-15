/// <reference path="../pb_data/types.d.ts" />
// Scoring lab: lets admins re-run dialogue scoring against custom prompts /
// API configs to test stability, without touching the live scores users see.
migrate((app) => {
  const dialogues = app.findCollectionByNameOrId('dialogues')

  // ---------------------------------------------------------------------------
  // scoring_apis — connection configs the lab (and production scoring) can use.
  // Only the env var *name* holding the secret is stored here, never the key.
  // ---------------------------------------------------------------------------
  const apis = new Collection({
    type: 'base',
    name: 'scoring_apis',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: 'name', type: 'text', required: true, max: 100 },
      { name: 'provider', type: 'text', required: true, max: 50 },      // e.g. "anthropic"
      { name: 'model', type: 'text', required: true, max: 100 },
      { name: 'endpoint', type: 'text', required: true, max: 300 },
      { name: 'api_key_env', type: 'text', required: true, max: 100 },  // env var name
      { name: 'is_default', type: 'bool' },
    ],
  })
  app.save(apis)

  // ---------------------------------------------------------------------------
  // scoring_test_runs — one row per re-scoring attempt. Never read by the app;
  // admin-only, and separate from dialogue_participant_scores / collective_criteria.
  // ---------------------------------------------------------------------------
  const runs = new Collection({
    type: 'base',
    name: 'scoring_test_runs',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: 'dialogue', type: 'relation', required: true, maxSelect: 1,
        collectionId: dialogues.id, cascadeDelete: true },
      { name: 'batch_id', type: 'text', required: true, max: 60 },
      { name: 'run_index', type: 'number', required: true },
      { name: 'api_name', type: 'text', max: 100 },
      { name: 'model', type: 'text', max: 100 },
      { name: 'prompt', type: 'text' },
      { name: 'result', type: 'json' },
      { name: 'error', type: 'text', max: 500 },
      { name: 'duration_ms', type: 'number' },
    ],
    indexes: [
      'CREATE INDEX idx_scoring_test_runs_dialogue ON scoring_test_runs (dialogue)',
      'CREATE INDEX idx_scoring_test_runs_batch ON scoring_test_runs (batch_id)',
    ],
  })
  app.save(runs)

  // Seed the one API we have today.
  const row = new Record(apis)
  row.set('name', 'Anthropic Claude Haiku')
  row.set('provider', 'anthropic')
  row.set('model', 'claude-haiku-4-5-20251001')
  row.set('endpoint', 'https://api.anthropic.com/v1/messages')
  row.set('api_key_env', 'ANTHROPIC_API_KEY')
  row.set('is_default', true)
  app.save(row)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId('scoring_test_runs')) } catch (_) {}
  try { app.delete(app.findCollectionByNameOrId('scoring_apis')) } catch (_) {}
})
