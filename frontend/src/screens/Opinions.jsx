import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../pb'
import { useAuth } from '../auth'
import { KL } from '../theme'
import { Screen, Card, Button, Mono, Scale } from '../ui'
import { COPY } from '../copy'

const C = COPY.opinions

export default function Opinions() {
  const { user, refresh } = useAuth()
  const nav = useNavigate()
  const [topics, setTopics] = useState([])
  const [byTopic, setByTopic] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const t = await pb.collection('topics').getFullList({ filter: 'is_active = true', sort: 'sort_order' })
      const mine = await pb.collection('opinions').getFullList({ filter: `user = "${user.id}"` })
      const map = {}
      mine.forEach((o) => { map[o.topic] = { id: o.id, stance: o.stance } })
      setTopics(t); setByTopic(map); setLoading(false)
    })()
  }, [])

  async function setStance(topicId, stance) {
    setByTopic((m) => ({ ...m, [topicId]: { ...m[topicId], stance } }))
    const existing = byTopic[topicId]
    try {
      if (existing?.id) {
        await pb.collection('opinions').update(existing.id, { stance })
      } else {
        const rec = await pb.collection('opinions').create({ user: user.id, topic: topicId, stance })
        setByTopic((m) => ({ ...m, [topicId]: { id: rec.id, stance } }))
      }
    } catch (e) { /* surfaced by the disabled finish button */ }
  }

  const answered = topics.filter((t) => byTopic[t.id]?.stance).length
  const done = topics.length > 0 && answered === topics.length

  async function finish() {
    setBusy(true)
    await refresh()
    setBusy(false)
    nav('/', { replace: true })
  }

  if (loading) return <Screen><Mono>{COPY.app.loading}</Mono></Screen>

  return (
    <Screen>
      <div style={{ marginTop: 8 }}>
        <Mono color={KL.clay}>{C.tag}</Mono>
        <h1 style={{ fontWeight: 700, fontSize: 34, lineHeight: 1, letterSpacing: -1, margin: '6px 0 0' }}>{C.headline}</h1>
        <p style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55, marginTop: 10 }}>
          {C.scale_hint} {answered}/{topics.length} répondues.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {topics.map((t) => (
          <Card key={t.id} soft style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.25 }}>{t.label}</div>
            <Scale value={byTopic[t.id]?.stance || 0} onChange={(n) => setStance(t.id, n)} />
          </Card>
        ))}
      </div>

      <div style={{ position: 'sticky', bottom: 16, marginTop: 8 }}>
        <Button variant="clay" disabled={!done || busy} onClick={finish}>
          {done ? C.btn_finish : C.btn_remaining(topics.length - answered)}
        </Button>
      </div>
    </Screen>
  )
}
