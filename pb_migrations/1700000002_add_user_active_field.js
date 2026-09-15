/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.fields.add(new BoolField({ name: 'is_active' }))
  app.save(users)
  // Default all existing users to active so the matcher keeps picking them up.
  app.db().newQuery('UPDATE users SET is_active = 1').execute()
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  try { users.fields.removeByName('is_active') } catch (_) {}
  app.save(users)
})
