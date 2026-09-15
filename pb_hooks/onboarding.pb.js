/// <reference path="../pb_data/types.d.ts" />
// Maintain users.onboarding_complete: true once the user has answered every
// ACTIVE topic. Recomputed whenever their opinions change.
onRecordAfterCreateSuccess((e) => {
  e.next()
  require(`${__hooks}/lib/onboarding.js`).recompute(e.app, e.record.get('user'))
}, 'opinions')

onRecordAfterUpdateSuccess((e) => {
  e.next()
  require(`${__hooks}/lib/onboarding.js`).recompute(e.app, e.record.get('user'))
}, 'opinions')
