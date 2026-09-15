import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { pb } from '../pb'
import { useAuth } from '../auth'
import { KL } from '../theme'
import { Screen, Button, Mono } from '../ui'
import { COPY } from '../copy'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

const C = COPY.bilan

export default function Bilan() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [d, setD] = useState(null)
  const [myScore, setMyScore] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [scoreLoading, setScoreLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const dialog = await pb.collection('dialogues').getOne(id, { expand: 'topic' })
        setD(dialog)
        if (dialog.status === 'active') { setLoaded(true); return }

        setScoreLoading(true)
        let attempts = 0
        while (attempts < 30) {
          let score = null
          let fresh = null
          try {
            score = await pb.collection('dialogue_participant_scores').getFirstListItem(
              `dialogue = "${id}" && user = "${user.id}"`
            )
          } catch (_) {}
          try { fresh = await pb.collection('dialogues').getOne(id, { expand: 'topic' }) } catch (_) {}

          if (score && fresh?.collective_criteria) {
            setD(fresh)
            setMyScore(score)
            setScoreLoading(false)
            break
          }
          attempts++
          if (attempts < 30) await new Promise((r) => setTimeout(r, 1000))
        }
        setScoreLoading(false)
      } catch (err) { console.log('bilan error:', err) }
      setLoaded(true)
    })()
  }, [id, user.id])

  if (!loaded) return <Screen><Mono>{COPY.app.loading}</Mono></Screen>
  if (!d) return <Screen><Mono>{C.not_found}</Mono></Screen>

  if (d.status === 'active') {
    return (
      <Screen>
        <Mono>{C.still_active}</Mono>
        <p style={{ fontFamily: KL.disp, fontSize: 14, lineHeight: 1.6, marginTop: 12, color: KL.umber55 }}>{C.still_active_hint}</p>
        <Button variant="primary" onClick={() => nav('/')} style={{ marginTop: 'auto' }}>{C.btn_back}</Button>
      </Screen>
    )
  }

  if (scoreLoading || !myScore) {
    return (
      <Screen>
        <Mono>{C.scoring_progress}</Mono>
        <p style={{ fontFamily: KL.disp, fontSize: 14, lineHeight: 1.6, marginTop: 12, color: KL.umber55 }}>{C.scoring_hint}</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <Button variant="primary" onClick={() => window.location.reload()}>{C.btn_refresh}</Button>
          <Button variant="ghost" onClick={() => nav('/')}>{C.btn_back}</Button>
        </div>
      </Screen>
    )
  }

  const collective = d.collective_criteria
  const individualAvg = myScore?.individual_avg || 0

  const individualData = [
    { name: 'Respect',       value: myScore.respect        || 0 },
    { name: 'Clarté',        value: myScore.clarte         || 0 },
    { name: 'Argumentation', value: myScore.argumentation  || 0 },
    { name: 'Nuance',        value: myScore.nuance         || 0 },
    { name: 'Écoute active', value: myScore.ecoute_active  || 0 },
    { name: 'Fair Play',     value: myScore.fair_play      || 0 },
  ]

  // 4 symmetric points so the radar forms a cross-diamond:
  //   top/bottom = clarification (Y axis), right/left = construction (X axis)
  const clarif = collective?.clarification_mutuelle || 0
  const constr  = collective?.construction_dialogue  || 0
  const collectiveData = [
    { name: 'Clarif.',  value: clarif },   // top
    { name: 'Constr.',  value: constr },   // right
    { name: ' ',        value: clarif },   // bottom (mirror, label hidden)
    { name: '  ',       value: constr },   // left   (mirror, label hidden)
  ]

  return (
    <Screen pad={16}>
      <Mono>{C.tag}</Mono>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10, flex: 1 }}>

        {/* LEFT — individual */}
        {myScore && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{C.section_individual}</div>
            <div style={{
              background: KL.sand, borderRadius: 18, padding: 10,
              boxShadow: '0 4px 12px rgba(58,45,36,0.06)',
              position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={individualData}>
                  <PolarGrid stroke={KL.umber12} />
                  <PolarAngleAxis dataKey="name" stroke={KL.umber55} style={{ fontSize: 10, fontFamily: KL.mono }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} stroke={KL.umber12} style={{ fontSize: 9 }} tick={false} />
                  <Radar name="Score" dataKey="value" stroke={KL.clay} fill={KL.clay} fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
              <div style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                background: KL.clay, color: KL.sand, borderRadius: '50%', width: 60, height: 60,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(200,117,90,0.3)', pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 10, fontFamily: KL.mono, opacity: 0.9 }}>{C.avg_label}</div>
                <div style={{ fontWeight: 700, fontSize: 22, lineHeight: 1 }}>{individualAvg.toFixed(1)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                ['Respect',       myScore.respect],
                ['Clarté',        myScore.clarte],
                ['Argumentation', myScore.argumentation],
                ['Nuance',        myScore.nuance],
                ['Écoute active', myScore.ecoute_active],
                ['Fair Play',     myScore.fair_play],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: KL.mono }}>
                  <span style={{ color: KL.umber55 }}>{label}</span>
                  <span style={{ color: KL.clay, fontWeight: 600 }}>{(val || 0).toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RIGHT — collective */}
        {collective ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{C.section_collective}</div>
            <div style={{
              background: KL.sand, borderRadius: 18, padding: 10,
              boxShadow: '0 4px 12px rgba(58,45,36,0.06)',
              position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={collectiveData}>
                  <PolarGrid stroke={KL.umber12} />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={({ payload, x, y, textAnchor }) => {
                      const text = payload.value.trim()
                      if (!text) return null
                      return (
                        <text x={x} y={y} textAnchor={textAnchor} fill={KL.umber55} fontSize={10} fontFamily="DM Mono, monospace">{text}</text>
                      )
                    }}
                  />
                  <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                  <Radar name="Score" dataKey="value" stroke={KL.clay} fill={KL.clay} fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
              <div style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                background: KL.clay, color: KL.sand, borderRadius: '50%', width: 60, height: 60,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(200,117,90,0.3)', pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 10, fontFamily: KL.mono, opacity: 0.9 }}>{C.total_label}</div>
                <div style={{ fontWeight: 700, fontSize: 22, lineHeight: 1 }}>{(collective.collective_avg || 0).toFixed(1)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                ['Clarification', collective.clarification_mutuelle],
                ['Construction',  collective.construction_dialogue],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: KL.mono }}>
                  <span style={{ color: KL.umber55 }}>{label}</span>
                  <span style={{ color: KL.clay, fontWeight: 600 }}>{(val || 0).toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mono style={{ textAlign: 'center', fontSize: 11 }}>Score collectif non disponible</Mono>
          </div>
        )}
      </div>

      {/* Advice for criteria scored below 3 */}
      {myScore && (() => {
        const items = [
          ['respect',       myScore.respect],
          ['clarte',        myScore.clarte],
          ['argumentation', myScore.argumentation],
          ['nuance',        myScore.nuance],
          ['ecoute_active', myScore.ecoute_active],
          ['fair_play',     myScore.fair_play],
        ].filter(([key, val]) => (val || 0) < 3 && C.advice[key])
        if (!items.length) return null
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {items.map(([key]) => (
              <p key={key} style={{ margin: 0, fontFamily: KL.disp, fontSize: 12, color: KL.umber55, lineHeight: 1.5 }}>
                {C.advice[key]}
              </p>
            ))}
          </div>
        )
      })()}

      <div style={{ paddingTop: 12 }}>
        <Button variant="primary" onClick={() => nav('/')}>{C.btn_back}</Button>
      </div>
    </Screen>
  )
}
