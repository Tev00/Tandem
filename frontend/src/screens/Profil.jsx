import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../pb'
import { useAuth } from '../auth'
import { KL } from '../theme'
import { Screen, Card, Button, Mono, Avatar } from '../ui'
import { COPY } from '../copy'

const C = COPY.profil

export default function Profil() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [opinions, setOpinions] = useState([])
  useEffect(() => {
    (async () => {
      const o = await pb.collection('opinions').getFullList({ filter: `user = "${user.id}"`, expand: 'topic', sort: 'topic.sort_order' })
      setOpinions(o)
    })()
  }, [])

  return (
    <Screen>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
        <Avatar name={user?.pseudonym} active size={56} />
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 24, margin: 0 }}>{user?.pseudonym}</h1>
          <Mono>{C.role}</Mono>
        </div>
      </div>

      <Mono>{C.section_opinions}</Mono>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {opinions.map((o) => (
          <Card key={o.id} soft>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{o.expand?.topic?.label}</div>
              <Mono color={KL.clay} style={{ whiteSpace: 'nowrap' }}>{C.stances[o.stance]}</Mono>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button variant="ghost" onClick={() => nav('/opinions')}>{C.btn_edit_opinions}</Button>
        <Button variant="ghost" onClick={() => { logout(); nav('/inscription') }}>{C.btn_logout}</Button>
      </div>
    </Screen>
  )
}
