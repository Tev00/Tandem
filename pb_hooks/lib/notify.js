// notify(app, userId, type, payload) — the single notification seam.
// PHASE 0: writes the in-app row. PHASE 1: also dispatch email via SMTP.
module.exports = {
  notify(app, userId, type, payload) {
    const collection = app.findCollectionByNameOrId("notifications")
    const record = new Record(collection)
    record.set("user", userId)
    record.set("type", type)
    record.set("payload", payload || {})
    record.set("read", false)
    record.set("emailed", false)
    app.save(record)
    // TODO PHASE 1: send the email and set emailed = true.
    return record
  },
}
