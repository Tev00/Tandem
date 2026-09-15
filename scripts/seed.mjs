// Seed the admin-curated topics + N fake users with random opinions, so you can
// exercise matchmaking and dialogues without recruiting humans.
//
// Usage:
//   cd scripts && npm install
//   PB_URL=https://enlice.eu \
//   PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=secret \
//   SEED_USERS=20 npm run seed
import PocketBase from 'pocketbase'

const url = process.env.PB_URL || 'http://127.0.0.1:8090'
const email = process.env.PB_ADMIN_EMAIL
const password = process.env.PB_ADMIN_PASSWORD
const N = parseInt(process.env.SEED_USERS || '20', 10)

if (!email || !password) {
  console.error('Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD (a PocketBase superuser).')
  process.exit(1)
}

const TOPICS = [
  { label: "L'État devrait redistribuer les richesses plus agressivement", category: 'political' },
  { label: "L'immigration est globalement bénéfique pour le pays", category: 'political' },
  { label: 'La vie privée prime sur la sécurité publique', category: 'political' },
  { label: 'La décroissance est nécessaire face au climat', category: 'political' },
  { label: 'Le télétravail nuit à la cohésion des équipes', category: 'social' },
  { label: 'Les réseaux sociaux font plus de mal que de bien', category: 'social' },
  { label: 'Le mérite explique surtout la réussite', category: 'social' },
  { label: "Les œuvres générées par IA ont une vraie valeur artistique", category: 'cultural' },
  { label: 'Le sport de haut niveau est sur-valorisé', category: 'cultural' },
  { label: 'Les animaux devraient avoir des droits constitutionnels', category: 'cultural' },
]

const pb = new PocketBase(url)
pb.autoCancellation(false)

await pb.collection('_superusers').authWithPassword(email, password)
console.log('Authenticated as superuser.')

const topicIds = []
for (const t of TOPICS) {
  const rec = await pb.collection('topics').create({ ...t, is_active: true, sort_order: topicIds.length })
  topicIds.push(rec.id)
}
console.log(`Created ${topicIds.length} topics.`)

for (let i = 1; i <= N; i++) {
  const u = await pb.collection('users').create({
    email: `user${i}@enlice.test`,
    password: 'pilote-enlice-123',
    passwordConfirm: 'pilote-enlice-123',
    pseudonym: `penseur_${i}`,
    onboarding_complete: true,
    guidelines_accepted_at: new Date().toISOString(),
  })
  await pb.collection('users').update(u.id, { verified: true })
  for (const tid of topicIds) {
    await pb.collection('opinions').create({ user: u.id, topic: tid, stance: 1 + Math.floor(Math.random() * 5) })
  }
}
console.log(`Created ${N} users with opinions on all topics. Done.`)
