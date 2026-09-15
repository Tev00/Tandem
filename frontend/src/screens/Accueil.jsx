import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../pb'
import { useAuth } from '../auth'
import { KL } from '../theme'
import { Screen, Card, Button, Mono } from '../ui'
import { COPY } from '../copy'

const C = COPY.accueil

export default function Accueil() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [inQueue, setInQueue] = useState(false)
  const [dialogues, setDialogues] = useState([])
  const [queueId, setQueueId] = useState(null)

  useEffect(() => {
    let unsubDialogues
    ;(async () => {
      try {
        const q = await pb.collection('matchmaking_queue').getFirstListItem(`user = "${user.id}"`)
        setInQueue(true); setQueueId(q.id)
      } catch (_) { setInQueue(false) }

      const active = await pb.collection('dialogues').getFullList({
        filter: `status = "active" && (participant_a = "${user.id}" || participant_b = "${user.id}")`,
        expand: 'topic,participant_a,participant_b',
      })
      setDialogues(active)

      unsubDialogues = await pb.collection('dialogues').subscribe('*', (e) => {
        if (e.action === 'create' || e.action === 'update') {
          const record = e.record
          const isOurs = record.participant_a === user.id || record.participant_b === user.id
          if (isOurs && record.status === 'active') {
            if (!active.some((d) => d.id === record.id)) nav(`/dialogue/${record.id}`, { replace: true })
          }
        }
      }, { filter: `(participant_a = "${user.id}" || participant_b = "${user.id}")` })
    })()

    return () => { if (unsubDialogues) unsubDialogues() }
  }, [user.id, nav])

  async function joinQueue() {
    try {
      const q = await pb.collection('matchmaking_queue').create({ user: user.id })
      setQueueId(q.id); setInQueue(true)
    } catch (e) { alert(C.err_join) }
  }

  async function leaveQueue() {
    try {
      if (queueId) await pb.collection('matchmaking_queue').delete(queueId)
      setInQueue(false); setQueueId(null)
    } catch (e) { alert(C.err_leave) }
  }

  return (
    <Screen>
      <div style={{ marginBottom: 20 }}>
        <Mono color={KL.clay}>{C.tag}</Mono>
        <h1 style={{ fontWeight: 700, fontSize: 32, lineHeight: 1, marginTop: 4 }}>
          {inQueue ? C.headline_queue : C.headline_idle}
        </h1>
        <p style={{ fontFamily: KL.mono, fontSize: 13, color: KL.umber55, marginTop: 8, maxWidth: 320 }}>
          {inQueue ? C.subtitle_queue : C.subtitle_idle}
        </p>
      </div>

      {dialogues.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Mono color={KL.umber55} style={{ marginBottom: 8 }}>{C.section_dialogues}</Mono>
          {dialogues.map((d) => {
            const opp = d.participant_a === user.id ? d.expand?.participant_b : d.expand?.participant_a
            return (
              <Card key={d.id} soft style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => nav(`/dialogue/${d.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{d.expand?.topic?.label}</div>
                    <Mono style={{ marginTop: 4 }}>
                      avec {opp?.pseudonym} · {d.current_turn === user.id ? C.your_turn : C.their_turn}
                    </Mono>
                  </div>
                  <div style={{ fontSize: 20 }}>→</div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!inQueue
          ? <Button variant="clay" onClick={joinQueue}>{C.btn_find}</Button>
          : <Button variant="ghost" onClick={leaveQueue}>{C.btn_cancel}</Button>}
      </div>
    </Screen>
  )
}
