/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Add the 8-criterion scoring fields to dialogue_participant_scores
  const partScores = app.findCollectionByNameOrId('dialogue_participant_scores')
  for (const name of ['respect', 'clarte', 'argumentation', 'nuance', 'ecoute_active', 'fair_play', 'individual_avg']) {
    partScores.fields.add(new NumberField({ name }))
  }
  app.save(partScores)

  // Add collective_criteria JSON field to dialogues
  const dialogues = app.findCollectionByNameOrId('dialogues')
  dialogues.fields.add(new JSONField({ name: 'collective_criteria' }))
  app.save(dialogues)
}, (app) => {
  const partScores = app.findCollectionByNameOrId('dialogue_participant_scores')
  for (const name of ['respect', 'clarte', 'argumentation', 'nuance', 'ecoute_active', 'fair_play', 'individual_avg']) {
    try { partScores.fields.removeByName(name) } catch (_) {}
  }
  app.save(partScores)

  const dialogues = app.findCollectionByNameOrId('dialogues')
  try { dialogues.fields.removeByName('collective_criteria') } catch (_) {}
  app.save(dialogues)
})
