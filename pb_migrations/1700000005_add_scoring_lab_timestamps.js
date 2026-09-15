/// <reference path="../pb_data/types.d.ts" />
// scoring_apis / scoring_test_runs were created without explicit created/updated
// fields (unlike every other collection here, PocketBase doesn't add them
// automatically) — sorting by "-created" was silently failing and returning
// empty results from the scoring lab's history/export endpoints.
migrate((app) => {
  const apis = app.findCollectionByNameOrId('scoring_apis')
  apis.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
  apis.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
  app.save(apis)

  const runs = app.findCollectionByNameOrId('scoring_test_runs')
  runs.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
  runs.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
  app.save(runs)
}, (app) => {
  try {
    const apis = app.findCollectionByNameOrId('scoring_apis')
    apis.fields.removeByName('created'); apis.fields.removeByName('updated')
    app.save(apis)
  } catch (_) {}
  try {
    const runs = app.findCollectionByNameOrId('scoring_test_runs')
    runs.fields.removeByName('created'); runs.fields.removeByName('updated')
    app.save(runs)
  } catch (_) {}
})
