/// <reference path="../pb_data/types.d.ts" />
// =============================================================================
// EN LICE — initial schema migration (PocketBase v0.23+ JSVM API)
// Place this file in:  pb_migrations/1700000000_init_agon_schema.js
// Apply with a normal start, or:  ./pocketbase migrate up
//
// Maps every locked design decision onto PocketBase. Differences vs the
// Postgres version are intentional and idiomatic:
//   * Tables -> collections; enums -> "select" fields with fixed values.
//   * RLS policies -> per-collection API rules (filter strings).
//       null  = locked to superusers only (our "admin only").
//       ""    = open to anyone.
//       "..." = a filter expression.
//   * "never re-match" -> a unique `pair_key` text field (sorted user ids)
//     instead of a least()/greatest() expression index.
//   * ADMINS = PocketBase superusers, who manage moderation via the dashboard
//     and bypass all API rules. (If you later want in-app, non-superuser
//     moderators, add a `role` select field on users and swap the null rules
//     for `@request.auth.role = "admin"`.)
//   * Email lives on the built-in users auth collection and stays hidden from
//     other users by PocketBase's emailVisibility mechanism; superusers see it.
//
// Tunables left to hooks/config (not schema): dialogue duration (expires_at),
// the 3-5 concurrent cap, the week boundary, and the scoring engine.
// =============================================================================

migrate((app) => {
  // ---------------------------------------------------------------------------
  // 0. USERS (extend the built-in auth collection -> this is our "profiles")
  // ---------------------------------------------------------------------------
  const users = app.findCollectionByNameOrId("users");

  // pseudonym: not required (set during onboarding), but unique when present.
  users.fields.add(new TextField({ name: "pseudonym", required: false, max: 40 }));
  users.fields.add(new BoolField({ name: "onboarding_complete" }));
  users.fields.add(new DateField({ name: "guidelines_accepted_at" }));

  // Authenticated users may read each other's records (pseudonym), but the
  // email is hidden by emailVisibility, so this exposes pseudonyms only.
  users.listRule = "@request.auth.id != ''";
  users.viewRule = "@request.auth.id != ''";
  // create/update/delete keep PocketBase's sensible auth defaults.

  // Unique pseudonym, ignoring not-yet-set (empty) ones.
  users.addIndex("idx_users_pseudonym", true, "pseudonym", "pseudonym != ''");
  app.save(users);
  const usersId = users.id;

  // ---------------------------------------------------------------------------
  // 1. TOPICS (admin-curated; users read, superusers write)
  // ---------------------------------------------------------------------------
  const topics = new Collection({
    type: "base",
    name: "topics",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "label", type: "text", required: true, max: 200 },
      { name: "category", type: "select", maxSelect: 1,
        values: ["political", "social", "cultural", "personal", "other"] },
      { name: "is_active", type: "bool" },
      { name: "sort_order", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
  });
  app.save(topics);
  const topicsId = topics.id;

  // ---------------------------------------------------------------------------
  // 2. OPINIONS (5-point scale; 3 = neutral. Strictly private to the owner.)
  // ---------------------------------------------------------------------------
  const opinions = new Collection({
    type: "base",
    name: "opinions",
    listRule:   "user = @request.auth.id",
    viewRule:   "user = @request.auth.id",
    createRule: "user = @request.auth.id",
    updateRule: "user = @request.auth.id",
    deleteRule: "user = @request.auth.id",
    fields: [
      { name: "user", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: true },
      { name: "topic", type: "relation", required: true, maxSelect: 1,
        collectionId: topicsId, cascadeDelete: true },
      { name: "stance", type: "number", required: true, onlyInt: true, min: 1, max: 5 },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_opinions_user_topic ON opinions (`user`, `topic`)",
    ],
  });
  app.save(opinions);

  // ---------------------------------------------------------------------------
  // 3. MATCHMAKING QUEUE (opt-in pool; the matcher hook reads it all)
  // ---------------------------------------------------------------------------
  const queue = new Collection({
    type: "base",
    name: "matchmaking_queue",
    listRule:   "user = @request.auth.id",
    viewRule:   "user = @request.auth.id",
    createRule: "user = @request.auth.id",
    updateRule: null,
    deleteRule: "user = @request.auth.id",
    fields: [
      { name: "user", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: true },
      { name: "joined_at", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_queue_user ON matchmaking_queue (`user`)",
    ],
  });
  app.save(queue);

  // ---------------------------------------------------------------------------
  // 4. DIALOGUES (auto-open; permanent pairing record -> never re-match)
  //    Created/ended by hooks. Participants can only read.
  // ---------------------------------------------------------------------------
  const dialogues = new Collection({
    type: "base",
    name: "dialogues",
    listRule: "participant_a = @request.auth.id || participant_b = @request.auth.id",
    viewRule: "participant_a = @request.auth.id || participant_b = @request.auth.id",
    createRule: null,
    updateRule: "(participant_a = @request.auth.id || participant_b = @request.auth.id) && status = 'active' && @request.data.status = 'ended' && @request.data.end_reason = 'left' && @request.data.ended_at != ''",
    deleteRule: null, // matcher/leave hooks and participant leave
    fields: [
      { name: "participant_a", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: false },
      { name: "participant_b", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: false },
      { name: "topic", type: "relation", required: true, maxSelect: 1,
        collectionId: topicsId, cascadeDelete: false },
      { name: "pair_key", type: "text", required: true }, // sorted "idA_idB"
      { name: "status", type: "select", maxSelect: 1, values: ["active", "ended"] },
      { name: "current_turn", type: "relation", maxSelect: 1,
        collectionId: usersId, cascadeDelete: false },
      { name: "collective_score", type: "number" }, // STUBBED (0 until scored)
      { name: "opened_at", type: "autodate", onCreate: true, onUpdate: false },
      { name: "expires_at", type: "date" },          // opened_at + X days (tunable)
      { name: "ended_at", type: "date" },
      { name: "end_reason", type: "select", maxSelect: 1,
        values: ["time_limit", "left", "moderation"] },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_dialogues_pair ON dialogues (pair_key)",
      "CREATE INDEX idx_dialogues_status_exp ON dialogues (status, expires_at)",
    ],
  });
  app.save(dialogues);
  const dialoguesId = dialogues.id;

  // ---------------------------------------------------------------------------
  // 5. MESSAGES (sender null = system bot/prompts; turn-taking enforced on create)
  // ---------------------------------------------------------------------------
  const messages = new Collection({
    type: "base",
    name: "messages",
    listRule: "dialogue.participant_a = @request.auth.id || dialogue.participant_b = @request.auth.id",
    viewRule: "dialogue.participant_a = @request.auth.id || dialogue.participant_b = @request.auth.id",
    // own message, dialogue active, and it's your turn:
    createRule: "sender = @request.auth.id && dialogue.status = 'active' && dialogue.current_turn = @request.auth.id",
    updateRule: null, deleteRule: null, // messages are immutable
    fields: [
      { name: "dialogue", type: "relation", required: true, maxSelect: 1,
        collectionId: dialoguesId, cascadeDelete: true },
      { name: "sender", type: "relation", maxSelect: 1,
        collectionId: usersId, cascadeDelete: false }, // null = system bot
      { name: "is_prompt", type: "bool" },
      { name: "body", type: "text", required: true, max: 10000 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE INDEX idx_messages_dialogue_created ON messages (dialogue, created)",
    ],
  });
  app.save(messages);
  const messagesId = messages.id;

  // ---------------------------------------------------------------------------
  // 6. INDIVIDUAL SCORES (PRIVATE to owner; per-turn live; STUBBED v1)
  // ---------------------------------------------------------------------------
  const partScores = new Collection({
    type: "base",
    name: "dialogue_participant_scores",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: null, updateRule: null, deleteRule: null, // scoring hook only
    fields: [
      { name: "dialogue", type: "relation", required: true, maxSelect: 1,
        collectionId: dialoguesId, cascadeDelete: true },
      { name: "user", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: true },
      { name: "curiosity", type: "number" },          // STUBBED
      { name: "constructiveness", type: "number" },   // STUBBED
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_part_scores_dialogue_user ON dialogue_participant_scores (dialogue, `user`)",
    ],
  });
  app.save(partScores);

  // ---------------------------------------------------------------------------
  // 7. SCORE EVENTS (per-turn "why your score moved"; user null = collective)
  // ---------------------------------------------------------------------------
  const scoreEvents = new Collection({
    type: "base",
    name: "score_events",
    // own events, OR collective events (empty user) if you're a participant:
    listRule: "user = @request.auth.id || (user = '' && (dialogue.participant_a = @request.auth.id || dialogue.participant_b = @request.auth.id))",
    viewRule: "user = @request.auth.id || (user = '' && (dialogue.participant_a = @request.auth.id || dialogue.participant_b = @request.auth.id))",
    createRule: null, updateRule: null, deleteRule: null, // scoring hook only
    fields: [
      { name: "dialogue", type: "relation", required: true, maxSelect: 1,
        collectionId: dialoguesId, cascadeDelete: true },
      { name: "message", type: "relation", maxSelect: 1,
        collectionId: messagesId, cascadeDelete: false }, // the turn that moved it
      { name: "user", type: "relation", maxSelect: 1,
        collectionId: usersId, cascadeDelete: true },      // null = collective
      { name: "dimension", type: "select", maxSelect: 1, required: true,
        values: ["curiosity", "constructiveness", "collective"] },
      { name: "delta", type: "number", required: true },
      { name: "reason", type: "text", max: 500 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE INDEX idx_score_events_dialogue_created ON score_events (dialogue, created)",
    ],
  });
  app.save(scoreEvents);

  // ---------------------------------------------------------------------------
  // 8. SCORE FEEDBACK (bilan: user reacts to their scores; ships with scoring)
  // ---------------------------------------------------------------------------
  const scoreFeedback = new Collection({
    type: "base",
    name: "score_feedback",
    listRule:   "user = @request.auth.id",
    viewRule:   "user = @request.auth.id",
    createRule: "user = @request.auth.id",
    updateRule: "user = @request.auth.id",
    deleteRule: null,
    fields: [
      { name: "dialogue", type: "relation", required: true, maxSelect: 1,
        collectionId: dialoguesId, cascadeDelete: true },
      { name: "user", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: true },
      { name: "target", type: "select", maxSelect: 1, required: true,
        values: ["individual", "collective"] },
      { name: "agreement", type: "number", onlyInt: true, min: 1, max: 5 },
      { name: "comment", type: "text", max: 2000 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_feedback_dialogue_user_target ON score_feedback (dialogue, `user`, target)",
    ],
  });
  app.save(scoreFeedback);

  // ---------------------------------------------------------------------------
  // 9. WEEKLY SCORES (public leaderboard, weekly reset)
  // ---------------------------------------------------------------------------
  const weekly = new Collection({
    type: "base",
    name: "weekly_scores",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: null, updateRule: null, deleteRule: null, // scoring hooks
    fields: [
      { name: "user", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: true },
      { name: "week_start", type: "date", required: true },
      { name: "curiosity", type: "number" },
      { name: "constructiveness", type: "number" },
      { name: "total", type: "number" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_weekly_user_week ON weekly_scores (`user`, week_start)",
      "CREATE INDEX idx_weekly_week_total ON weekly_scores (week_start, total)",
    ],
  });
  app.save(weekly);

  // ---------------------------------------------------------------------------
  // 10. GLOBAL SCORES (public leaderboard, all-time running total)
  // ---------------------------------------------------------------------------
  const global = new Collection({
    type: "base",
    name: "global_scores",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "user", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: true },
      { name: "curiosity", type: "number" },
      { name: "constructiveness", type: "number" },
      { name: "total", type: "number" },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_global_user ON global_scores (`user`)",
      "CREATE INDEX idx_global_total ON global_scores (total)",
    ],
  });
  app.save(global);

  // ---------------------------------------------------------------------------
  // 11. REPORTS (flags). Does nothing to the live convo. Superusers triage.
  // ---------------------------------------------------------------------------
  const reports = new Collection({
    type: "base",
    name: "reports",
    listRule:   "reporter = @request.auth.id",   // you see your own; superusers see all
    viewRule:   "reporter = @request.auth.id",
    createRule: "reporter = @request.auth.id",
    updateRule: null, deleteRule: null,          // triaged via dashboard
    fields: [
      { name: "reporter", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: false },
      { name: "dialogue", type: "relation", required: true, maxSelect: 1,
        collectionId: dialoguesId, cascadeDelete: false },
      { name: "message", type: "relation", maxSelect: 1,
        collectionId: messagesId, cascadeDelete: false }, // null = general behaviour
      { name: "reason", type: "text", required: true, max: 2000 },
      { name: "status", type: "select", maxSelect: 1,
        values: ["open", "action_taken", "no_action"] },
      { name: "reviewed_at", type: "date" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE INDEX idx_reports_status_created ON reports (status, created)",
    ],
  });
  app.save(reports);
  const reportsId = reports.id;

  // ---------------------------------------------------------------------------
  // 12. SANCTIONS (target sees own -> "told only if action taken")
  // ---------------------------------------------------------------------------
  const sanctions = new Collection({
    type: "base",
    name: "sanctions",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: null, updateRule: null, deleteRule: null, // superusers; appeals via hook
    fields: [
      { name: "user", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: true },
      { name: "report", type: "relation", maxSelect: 1,
        collectionId: reportsId, cascadeDelete: false },
      { name: "type", type: "select", maxSelect: 1, required: true,
        values: ["warning", "suspension", "ban"] },
      { name: "reason", type: "text", max: 2000 },
      { name: "expires_at", type: "date" }, // suspensions
      { name: "appeal_status", type: "select", maxSelect: 1,
        values: ["none", "requested", "upheld", "overturned"] },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE INDEX idx_sanctions_user ON sanctions (`user`)",
    ],
  });
  app.save(sanctions);
  const sanctionsId = sanctions.id;

  // ---------------------------------------------------------------------------
  // 13. BANNED EMAILS (survives new pseudonyms; checked at signup by a hook)
  // ---------------------------------------------------------------------------
  const banned = new Collection({
    type: "base",
    name: "banned_emails",
    listRule: null, viewRule: null,
    createRule: null, updateRule: null, deleteRule: null, // superusers/hooks only
    fields: [
      { name: "email", type: "email", required: true },
      { name: "reason", type: "text", max: 1000 },
      { name: "sanction", type: "relation", maxSelect: 1,
        collectionId: sanctionsId, cascadeDelete: false },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_banned_email ON banned_emails (email)",
    ],
  });
  app.save(banned);

  // ---------------------------------------------------------------------------
  // 14. NOTIFICATIONS (in-app store; email dispatched by a hook)
  // ---------------------------------------------------------------------------
  const notifications = new Collection({
    type: "base",
    name: "notifications",
    listRule:   "user = @request.auth.id",
    viewRule:   "user = @request.auth.id",
    createRule: null,
    updateRule: "user = @request.auth.id", // owner can mark read
    deleteRule: "user = @request.auth.id",
    fields: [
      { name: "user", type: "relation", required: true, maxSelect: 1,
        collectionId: usersId, cascadeDelete: true },
      { name: "type", type: "select", maxSelect: 1, required: true,
        values: ["match_found", "your_turn", "reply_received",
                 "dialogue_expiring", "dialogue_ended", "flag_resolved", "sanction_issued"] },
      { name: "payload", type: "json", maxSize: 50000 },
      { name: "read", type: "bool" },
      { name: "emailed", type: "bool" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE INDEX idx_notifications_user_read ON notifications (`user`, read, created)",
    ],
  });
  app.save(notifications);

}, (app) => {
  // ----------------------------- DOWN (revert) -------------------------------
  const drop = [
    "notifications", "banned_emails", "sanctions", "reports",
    "global_scores", "weekly_scores", "score_feedback", "score_events",
    "dialogue_participant_scores", "messages", "dialogues",
    "matchmaking_queue", "opinions", "topics",
  ];
  for (const name of drop) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (e) { /* noop */ }
  }
  // revert the users extensions
  try {
    const users = app.findCollectionByNameOrId("users");
    ["pseudonym", "onboarding_complete", "guidelines_accepted_at"].forEach((f) => {
      try { users.fields.removeByName(f); } catch (e) { /* noop */ }
    });
    app.save(users);
  } catch (e) { /* noop */ }
});
