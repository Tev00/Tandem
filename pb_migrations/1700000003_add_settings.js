/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const settings = new Collection({
    type: 'base',
    name: 'app_settings',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: 'key',   type: 'text', required: true, max: 100 },
      { name: 'value', type: 'text' },
    ],
  })
  app.save(settings)
  settings.addIndex('idx_app_settings_key', true, 'key', '')
  app.save(settings)

  // Seed defaults
  const row = new Record(settings)
  row.set('key',   'matchmaking_enabled')
  row.set('value', 'true')
  app.save(row)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId('app_settings')) } catch (_) {}
})
