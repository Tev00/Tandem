import { useEffect, useState } from 'react'
import { pb } from '../pb'
import { KL } from '../theme'
import { Screen, Card, Mono, Avatar } from '../ui'
import { COPY } from '../copy'

const C = COPY.classement

export default function Classement() {
  const [rows, setRows] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const r = await pb.collection('global_scores').getList(1, 20, { sort: '-total', expand: 'user' })
        setRows(r.items)
      } catch {}
      setLoaded(true)
    })()
  }, [])

  return (
    <Screen>
      <div style={{ marginTop: 8 }}>
        <Mono color={KL.clay}>{C.tag}</Mono>
        <h1 style={{ fontWeight: 700, fontSize: 30, letterSpacing: -1, margin: '6px 0 0' }}>{C.headline}</h1>
        <Mono>{C.subtitle}</Mono>
      </div>

      {loaded && rows.length === 0 ? (
        <Card soft>
          <div style={{ fontFamily: KL.mono, fontSize: 13, color: KL.umber55, lineHeight: 1.5 }}>{C.empty}</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => (
            <Card key={r.id} soft>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Mono style={{ width: 18 }}>{i + 1}</Mono>
                <Avatar name={r.expand?.user?.pseudonym} active={i === 0} />
                <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{r.expand?.user?.pseudonym || '—'}</div>
                <span style={{ fontFamily: KL.disp, fontWeight: 700, fontSize: 22 }}>{r.total}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  )
}
