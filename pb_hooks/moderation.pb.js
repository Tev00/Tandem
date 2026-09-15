/// <reference path="../pb_data/types.d.ts" />
// Reject signup if the email is in banned_emails (a ban survives new pseudonyms).
// Report triage itself happens in the dashboard (superusers).
onRecordCreateRequest((e) => {
  const email = e.record.email ? e.record.email() : e.record.getString('email')
  if (email) {
    let banned = false
    try { e.app.findFirstRecordByFilter('banned_emails', 'email = {:e}', { e: email }); banned = true } catch (_) {}
    if (banned) throw new BadRequestError("Cet e-mail n'est pas autorisé.")
  }
  e.next()
}, 'users')
