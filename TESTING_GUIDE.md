# Testing Guide: En Lice User Flows

## Quick Start Testing

### Prerequisites
```bash
# Build frontend
cd frontend && npm run build
# Builds into ../pb_public for PocketBase to serve

# Start PocketBase
./pocketbase serve
# Visit http://localhost:8090

# (Optional) Seed test data
cd scripts
PB_URL=http://localhost:8090 PB_ADMIN_EMAIL=admin@example.com \
PB_ADMIN_PASSWORD=admin123 SEED_USERS=5 npm run seed
```

---

## Test Flow 1: **Onboarding → Opinions → Home**

### Scenario: New user signs up

**Step 1: Sign Up**
- Navigate to `/inscription`
- Email: `alice@example.com`
- Password: `password123` (8+ chars)
- **Verify:** Password field is masked (bullet points, not text)

**Step 2: Set Pseudonym**
- After signup, stay on Inscription
- Set pseudonym: `alice_think`
- **Verify:** Can't proceed with <3 chars
- **Verify:** Duplicate pseudonym shows error

**Step 3: Accept Charter**
- Read 3 principles
- Click "J'accepte la charte"
- **Verify:** Auto-navigates to `/opinions`

**Step 4: Answer Opinions**
- See all active topics (should be ~5 default)
- Answer each on 1–5 scale
- **Verify:** Buttons highlight when clicked (clay background)
- **Verify:** Progress shows "X/5 répondues"
- **Verify:** "Terminer" button only enabled when all answered
- **Verify:** Clicking "Terminer" auto-navigates to `/` (home)

**Expected:** User now at home with "Accueil" tab active

---

## Test Flow 2: **Matching → Dialogue → Leave**

### Scenario: Two users match and chat

**Setup:** Create 2 accounts:
- `bob@example.com` / `bob_debate` → Opinions: [1, 3, 5, 2, 4]
- `carol@example.com` / `carol_curious` → Opinions: [5, 3, 1, 4, 2]

**Step 1: Bob Joins Queue**
- On Accueil, click "Trouver un adversaire"
- **Verify:** Button changes to "Annuler" (ghost variant)
- **Verify:** UI says "En attente…" / "On te trouve un adversaire"

**Step 2: Carol Joins Queue**
- Open separate browser/incognito for Carol
- On Accueil, click "Trouver un adversaire"
- **Verify:** Matcher finds pair (clash on topic, shared ground on other)
- **Verify:** Both auto-navigate to `/dialogue/:id`

**Step 3: Dialogue Loads**
- Header shows topic + opponent pseudonym
- Shows "à toi de répondre" or "au tour de X"
- Chat area empty, system prompts seeded
- **Verify:** Prompts say both names and explain the task

**Step 4: Turn-Based Exchange**
- Bob (participant_a) starts; field says "Ta réponse…"
- Bob types and sends (↑ button)
- **Verify:** Message appears on both sides, color-coded
- **Verify:** current_turn flips; Bob's field now disabled ("au tour de Carol…")
- **Verify:** Carol's field enabled ("Ta réponse…")
- Carol replies
- **Verify:** Turn flips back to Bob

**Step 5: Leave Mid-Dialogue**
- Bob sees new "Quitter ce dialogue" button
- Clicks it → confirmation: "Quitter ce dialogue ? Tu ne pourras pas revenir."
- Confirms
- **Verify:** Dialogue status → "ended" with `end_reason: "left"`
- **Verify:** Auto-navigates to `/bilan/:id`

**Expected:** Dialogue ended, scoring triggered async

---

## Test Flow 3: **Scoring Display (Bilan)**

### Scenario: Dialogue ends → scores display

**Step 1: Dialogue Auto-Ends (7 days)**
- (In production, set `DURATION_DAYS = 0` in [matchmaking.js](pb_hooks/lib/matchmaking.js) for testing)
- Or manually end: `dialogue.status = 'ended'` in admin panel
- **Verify:** Cron `dialogue_expiry` runs every minute

**Step 2: Scoring Happens Async**
- Dialogue.js calls `scoreDialogue()` → returns stub scores
- Writes to `dialogue_participant_scores` (private)
- Writes to `collective_criteria` (shared in dialogue record)

**Step 3: Bilan Page Loads**
- Navigate to `/bilan/:id`
- **Verify:** If dialogue still active: "Ce dialogue est encore en cours"
- **Verify:** If scoring in flight: "Notation en cours… Claude analyse" + Actualiser button
- **Verify:** Once scores exist: Shows radar charts

**Step 4: Radar Charts Display**
- Individual radar (6 axes): Respect, Clarté, Argumentation, Nuance, Écoute active, Fair Play
- **Verify:** Clay circle in center shows average (all 3.0 for stub)
- **Verify:** Breakdown grid shows each criterion with score
- Collective radar (2 axes): Clarification mutuelle, Construction du dialogue
- **Verify:** Same display for collective scores

**Step 5: Navigation Back**
- Click "Retour" button
- **Verify:** Returns to `/` (home)

**Expected:** Scoring UI complete and polished

---

## Test Flow 4: **Leaderboard (Empty Phase 0)**

### Scenario: Check leaderboard

**Step 1: Navigate to Classement**
- On any gated page, click "Classement" tab
- **Verify:** Page loads, shows disclaimer:
  "Le classement se remplira dès que la notation sera active et les premiers dialogues notés."
- **Verify:** List is empty (no `global_scores` yet)

**Expected:** Placeholder shown; ready for Phase 2

---

## Edge Cases & Error Handling

### Email/Password Edge Cases
| Input | Expected |
|-------|----------|
| `test@` (invalid email) | Form doesn't submit (browser validation) |
| `pass` (7 chars) | "d'au moins 8 caractères" error |
| `test@example.com` (new signup) | Account created ✅ |
| `test@example.com` (exists) | "e-mail déjà utilisé" error ✅ |

### Pseudonym Edge Cases
| Input | Expected |
|-------|----------|
| `ab` (2 chars) | "Au moins 3 caractères" error |
| `alice_think` (taken) | "Ce pseudonyme est déjà pris" error |
| `new_user` (unique) | ✅ Saved |

### Opinion Scale
| Action | Expected |
|--------|----------|
| Click 1 | Button highlights clay, value=1 |
| Press Tab then Enter | Button highlights (if focused) |
| Leave empty | Can't finish; "Encore 5" shows |
| Answer all 5 | "Terminer" button enabled |

### Dialogue Turn-Based
| Scenario | Expected |
|----------|----------|
| Send while not your turn | Send button disabled (opacity 0.4) |
| Type but don't send | Still on your turn |
| Leave dialog | Async scoring triggered |
| Receive message mid-typing | Message appears in transcript |
| 7 days pass | Dialogue auto-ends, scoring runs |

### Bilan Loading
| Scenario | Expected |
|----------|----------|
| Navigate to ended dialogue immediately | Polls for scores (up to 30s) |
| Refresh page mid-polling | Polls resume |
| Scores exist | Charts render immediately |
| Dialogue still active | "Ce dialogue est encore en cours" |

---

## Database Verification

After running tests, check PocketBase admin panel:

```
Collections to inspect:

✅ users
  - pseudonym: ✅ set and unique
  - onboarding_complete: ✅ flips to true
  - guidelines_accepted_at: ✅ ISO timestamp

✅ opinions
  - All users answered all active topics
  - stance: 1–5 values

✅ matchmaking_queue
  - Empty after match (auto-removed)

✅ dialogues
  - Status: 'active' or 'ended'
  - current_turn: flips between participants
  - pair_key: unique (never re-matched)
  - collective_criteria: {clarification_mutuelle, construction_dialogue, collective_avg}

✅ messages
  - Transcript stored in order
  - sender: populated (except system prompts)
  - is_prompt: true for seed messages

✅ dialogue_participant_scores
  - One record per user per dialogue
  - 6 criteria: respect, clarte, argumentation, nuance, ecoute_active, fair_play
  - individual_avg: 3.0 (stub)

✅ notifications
  - Types: match_found, your_turn, dialogue_ended
  - User: correct (both participants receive)
  - read: false initially
```

---

## Performance Notes

- **Polling removed:** Accueil now uses subscriptions (instant, no wasted requests)
- **Scoring async:** Doesn't block dialogue UI
- **Bilan polling:** 30s max, 1s intervals (reasonable for async API integration)
- **Bundle size:** Watch recharts (large dep); lazy-load if needed

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Password field shows plaintext | Missing `type="password"` | ✅ Fixed in Field component |
| Bilan shows blank charts | Scores not yet ready | ✅ Now polls with loading state |
| Matcher doesn't run | Cron not registered | ✅ Added to main.pb.js |
| Can't leave dialogue | No UI button | ✅ Added "Quitter ce dialogue" |
| Dialogues never auto-end | expireDialogues() not called | ✅ Added cron |
| Stuck on Opinions | opinion not created | Check user.id in filter; verify all topics are active |
| Queue doesn't clear | Dialogue creation fails | Check matcher logs in PocketBase admin |

---

## Debugging Tips

### Enable console logs in PocketBase
- Check [matchmaking.js](pb_hooks/lib/matchmaking.js) console outputs
- Check [dialogue.js](pb_hooks/dialogue.js) scoring logs
- Watch [main.pb.js](pb_hooks/main.pb.js) onBootstrap message

### Debug frontend state
- Open DevTools Console
- Check for errors in pb.js subscriptions
- Network tab → check `/api/collections/` calls

### Check database directly
- PocketBase admin panel: `http://localhost:8090/_`
- Export collections as JSON for inspection

---

## Sign-Off Checklist

- [ ] Onboarding flow complete (3 steps)
- [ ] Opinions required before home
- [ ] Two users can match
- [ ] Dialogue is turn-based
- [ ] Leave button works
- [ ] Bilan polls and displays
- [ ] Leaderboard page loads (empty is OK)
- [ ] No console errors
- [ ] Mobile layout responsive
- [ ] Deploy & seed test data

**Ready for deployment to production!**
