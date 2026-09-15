// recompute(app, userId): flip users.onboarding_complete based on coverage of
// the active topic set. Called from onboarding.pb.js on opinion changes.
module.exports = {
  recompute(app, userId) {
    if (!userId) return
    const activeTopics = app.findRecordsByFilter('topics', 'is_active = true', '', 500, 0)
    const answered = app.findRecordsByFilter('opinions', 'user = {:u} && topic.is_active = true', '', 500, 0, { u: userId })
    const complete = activeTopics.length > 0 && answered.length >= activeTopics.length
    const user = app.findRecordById('users', userId)
    if (user.getBool('onboarding_complete') !== complete) {
      user.set('onboarding_complete', complete)
      app.save(user)
    }
  },
}
