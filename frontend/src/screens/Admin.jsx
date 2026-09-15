import { useState, useEffect, useCallback, useRef } from 'react'
import { pb } from '../pb'
import { KL } from '../theme'

const BASE = pb.baseUrl

// ─── helpers ────────────────────────────────────────────────────────────────

function ago(iso) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1)   return 'à l\'instant'
  if (m < 60)  return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `il y a ${h} h`
  return `il y a ${Math.floor(h / 24)} j`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
}

function fmtTimestamp(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function scoreColor(v) {
  if (v >= 4) return '#4CAF50'
  if (v >= 2.5) return KL.clay
  return '#e57373'
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StageBadge({ stage }) {
  const map = {
    in_dialogue:       { label: 'en dialogue',    bg: KL.clay,   fg: KL.sand },
    ever_matched:      { label: 'a dialogué',     bg: '#7CB9A8', fg: '#fff' },
    onboarding_complete: { label: 'prêt',         bg: '#8DAF6E', fg: '#fff' },
    has_pseudo:        { label: 'pseudo ok',      bg: KL.sand2,  fg: KL.umber },
    signed_up:         { label: 'inscrit',        bg: KL.sand2,  fg: KL.umber55 },
  }
  const { label, bg, fg } = map[stage] || { label: stage, bg: KL.sand2, fg: KL.umber }
  return (
    <span style={{
      display: 'inline-block', borderRadius: 20, padding: '2px 10px',
      background: bg, color: fg, fontFamily: KL.mono, fontSize: 10,
    }}>{label}</span>
  )
}

function ScoreBar({ label, value }) {
  const pct = (value / 5) * 100
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55 }}>{label}</span>
        <span style={{ fontFamily: KL.mono, fontSize: 10, color: scoreColor(value), fontWeight: 600 }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 4, background: KL.sand2, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: scoreColor(value), borderRadius: 2 }} />
      </div>
    </div>
  )
}

function ShadowModal({ shadow, onClose }) {
  if (!shadow) return null
  const messages = shadow.messages || []
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(58,45,36,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: KL.cream, borderRadius: 20, width: '100%', maxWidth: 600,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(58,45,36,0.25)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${KL.umber12}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, color: KL.umber, fontSize: 15 }}>{shadow.pseudo_a} × {shadow.pseudo_b}</div>
            <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginTop: 2 }}>{shadow.topic}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: KL.umber55, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55, textAlign: 'center', padding: 20 }}>Aucun message</div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{
              background: m.is_prompt ? 'transparent' : KL.sand,
              border: m.is_prompt ? `1px dashed ${KL.umber12}` : 'none',
              borderRadius: 12, padding: '8px 12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: KL.mono, fontSize: 10, color: m.is_prompt ? KL.umber55 : KL.clay, fontWeight: 600 }}>
                  {m.is_prompt ? 'prompt' : m.sender_pseudo}
                </span>
                <span style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55 }}>{fmtTimestamp(m.created)}</span>
              </div>
              <div style={{ fontSize: 14, color: KL.umber, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BilanModal({ dialogue, onClose }) {
  if (!dialogue) return null
  const { pseudo_a, pseudo_b, topic, scores, collective } = dialogue

  const criteria = [
    ['respect', 'Respect'], ['clarte', 'Clarté'], ['argumentation', 'Argumentation'],
    ['nuance', 'Nuance'], ['ecoute_active', 'Écoute active'], ['fair_play', 'Fair-play'],
  ]

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(58,45,36,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: KL.cream, borderRadius: 20, width: '100%', maxWidth: 680,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(58,45,36,0.3)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${KL.umber12}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, color: KL.umber, fontSize: 16 }}>{pseudo_a} × {pseudo_b}</div>
            <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginTop: 2 }}>bilan · {topic}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: KL.umber55, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {scores.length === 0 && (
            <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55, textAlign: 'center', padding: 24 }}>Aucun score disponible</div>
          )}
          {/* Individual scores side by side */}
          {scores.length > 0 && (
            <div>
              <div style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55, marginBottom: 12 }}>scores individuels</div>
              <div style={{ display: 'grid', gridTemplateColumns: scores.length >= 2 ? '1fr 1fr' : '1fr', gap: 20 }}>
                {scores.map(s => (
                  <div key={s.user} style={{ background: KL.sand, borderRadius: 16, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontWeight: 700, color: KL.umber, fontSize: 14 }}>{s.pseudo}</span>
                      <span style={{ fontFamily: KL.mono, fontSize: 13, color: KL.clay, fontWeight: 700 }}>{s.avg.toFixed(2)}<span style={{ fontSize: 10, opacity: 0.7 }}>/5</span></span>
                    </div>
                    {criteria.map(([key, label]) => <ScoreBar key={key} label={label} value={s[key] || 0} />)}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Collective */}
          {collective && (
            <div>
              <div style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55, marginBottom: 12 }}>qualité collective</div>
              <div style={{ background: KL.sand, borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontWeight: 700, color: KL.umber, fontSize: 14 }}>Échange</span>
                  <span style={{ fontFamily: KL.mono, fontSize: 13, color: KL.clay, fontWeight: 700 }}>
                    {(collective.collective_avg || 0).toFixed(2)}<span style={{ fontSize: 10, opacity: 0.7 }}>/5</span>
                  </span>
                </div>
                <ScoreBar label="Clarification mutuelle" value={collective.clarification_mutuelle || 0} />
                <ScoreBar label="Construction du dialogue" value={collective.construction_dialogue || 0} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── sections ───────────────────────────────────────────────────────────────

function Controls({ stats, token, onRefresh, onShadow, onEnd }) {
  const [ending, setEnding] = useState(false)

  async function toggle() {
    await fetch(`${BASE}/api/admin/matchmaking/toggle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    onRefresh()
  }

  async function endAll() {
    if (!confirm(`Terminer tous les dialogues actifs (${stats.dialogues.active.length}) ?`)) return
    setEnding(true)
    const res = await fetch(`${BASE}/api/admin/dialogues/end-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setEnding(false)
    alert(`${data.ended} dialogue(s) terminé(s).`)
    onRefresh()
  }

  const on = stats.matchmaking_enabled

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          ['Matchmaking', on ? 'Actif' : 'En pause', on ? '#8DAF6E' : KL.clay],
          ['File d\'attente', `${stats.queue_size} user${stats.queue_size !== 1 ? 's' : ''}`, KL.umber55],
          ['Dialogues actifs', stats.dialogues.active.length, KL.umber55],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: KL.sand, borderRadius: 16, padding: '16px 18px' }}>
            <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginBottom: 6 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: 20, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={toggle} style={{
          border: 'none', borderRadius: 20, padding: '12px 20px', cursor: 'pointer',
          background: on ? KL.sand2 : '#8DAF6E', color: on ? KL.umber : '#fff',
          fontFamily: KL.disp, fontWeight: 600, fontSize: 14,
        }}>
          {on ? '⏸ Pause matchmaking' : '▶ Activer matchmaking'}
        </button>
        <button onClick={endAll} disabled={ending || stats.dialogues.active.length === 0} style={{
          border: 'none', borderRadius: 20, padding: '12px 20px', cursor: ending ? 'not-allowed' : 'pointer',
          background: KL.clay, color: KL.sand,
          fontFamily: KL.disp, fontWeight: 600, fontSize: 14,
          opacity: stats.dialogues.active.length === 0 ? 0.4 : 1,
        }}>
          {ending ? 'En cours…' : '⏹ Terminer tous les dialogues'}
        </button>
      </div>

      {/* Active dialogues quick list */}
      {stats.dialogues.active.length > 0 && (
        <div>
          <div style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55, marginBottom: 8 }}>dialogues actifs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.dialogues.active.map(d => (
              <div key={d.id} style={{ background: KL.sand, borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <span style={{ fontWeight: 600, color: KL.umber, fontSize: 14 }}>{d.pseudo_a} × {d.pseudo_b}</span>
                  <span style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginLeft: 10 }}>{d.topic}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55 }}>{ago(d.started)}</span>
                  <button onClick={() => onShadow(d)} style={{ border: `1px solid ${KL.umber12}`, borderRadius: 10, padding: '4px 10px', background: 'transparent', cursor: 'pointer', fontFamily: KL.mono, fontSize: 10, color: KL.umber55 }}>voir</button>
                  <button onClick={() => onEnd(d.id)} style={{ border: 'none', borderRadius: 10, padding: '4px 10px', background: KL.clay, cursor: 'pointer', fontFamily: KL.mono, fontSize: 10, color: KL.sand }}>fin</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Users({ stats, onToggleActive }) {
  const [search, setSearch] = useState('')

  const total = stats.users.length
  const stages = [
    ['in_dialogue',       'en dialogue'],
    ['ever_matched',      'a dialogué'],
    ['onboarding_complete', 'prêt'],
    ['has_pseudo',        'pseudo ok'],
    ['signed_up',         'inscrit'],
  ]

  const filtered = stats.users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.pseudo.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Funnel */}
      <div style={{ background: KL.sand, borderRadius: 16, padding: '16px 18px' }}>
        <div style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55, marginBottom: 12 }}>entonnoir ({total} utilisateurs)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stages.map(([key, label]) => {
            const count = stats.funnel[key] || 0
            const pct = total ? (count / total) * 100 : 0
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber }}>{label}</span>
                  <span style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55 }}>{count}</span>
                </div>
                <div style={{ height: 6, background: KL.sand2, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: KL.clay, borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Search + list */}
      <div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrer par pseudo ou e-mail…"
          style={{
            width: '100%', border: `1px solid ${KL.umber12}`, background: KL.sand,
            borderRadius: 14, padding: '10px 14px', fontFamily: KL.disp, fontSize: 14,
            color: KL.umber, outline: 'none', marginBottom: 10,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(u => (
            <div key={u.id} style={{ background: KL.sand, borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <span style={{ fontWeight: 600, color: KL.umber, fontSize: 14 }}>{u.pseudo}</span>
                <span style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginLeft: 8 }}>{u.email}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <StageBadge stage={u.stage} />
                <span style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55 }}>{fmtDate(u.created)}</span>
                <button
                  onClick={() => onToggleActive(u.id, u.is_active)}
                  style={{
                    border: 'none', borderRadius: 10, padding: '3px 10px', cursor: 'pointer',
                    fontFamily: KL.mono, fontSize: 10,
                    background: u.is_active ? KL.sand2 : KL.clay,
                    color: u.is_active ? KL.umber55 : KL.sand,
                  }}
                >{u.is_active ? 'Désactiver' : 'Réactiver'}</button>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55, textAlign: 'center', padding: 20 }}>Aucun résultat</div>
        )}
      </div>
    </div>
  )
}

function Dialogues({ stats, token, onShadow, onEnd, onBilan }) {
  const [tab, setTab] = useState('active')
  const [expandedScores, setExpandedScores] = useState({})

  function toggleScores(id) {
    setExpandedScores(s => ({ ...s, [id]: !s[id] }))
  }

  const criteria = [
    ['respect', 'Respect'], ['clarte', 'Clarté'], ['argumentation', 'Argumentation'],
    ['nuance', 'Nuance'], ['ecoute_active', 'Écoute active'], ['fair_play', 'Fair-play'],
  ]

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['active', `Actifs (${stats.dialogues.active.length})`], ['ended', `Terminés (${stats.dialogues.ended.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            border: 'none', borderRadius: 20, padding: '8px 16px', cursor: 'pointer',
            background: tab === key ? KL.clay : KL.sand,
            color: tab === key ? KL.sand : KL.umber55,
            fontFamily: KL.mono, fontSize: 12,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.dialogues.active.length === 0 && (
            <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55, textAlign: 'center', padding: 24 }}>Aucun dialogue actif</div>
          )}
          {stats.dialogues.active.map(d => (
            <div key={d.id} style={{ background: KL.sand, borderRadius: 16, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, color: KL.umber, fontSize: 15 }}>{d.pseudo_a} × {d.pseudo_b}</div>
                  <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginTop: 2 }}>{d.topic}</div>
                  <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.clay, marginTop: 4 }}>tour de {d.current_turn_pseudo} · {ago(d.started)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => onShadow(d)} style={{
                    border: `1px solid ${KL.umber12}`, borderRadius: 12, padding: '6px 12px',
                    background: 'transparent', cursor: 'pointer', fontFamily: KL.mono, fontSize: 11, color: KL.umber,
                    whiteSpace: 'nowrap',
                  }}>👁 Shadow</button>
                  <button onClick={() => onEnd(d.id)} style={{
                    border: 'none', borderRadius: 12, padding: '6px 12px',
                    background: KL.clay, cursor: 'pointer', fontFamily: KL.mono, fontSize: 11, color: KL.sand,
                    whiteSpace: 'nowrap',
                  }}>⏹ Fin</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'ended' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.dialogues.ended.length === 0 && (
            <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55, textAlign: 'center', padding: 24 }}>Aucun dialogue terminé</div>
          )}
          {stats.dialogues.ended.map(d => (
            <div key={d.id} style={{ background: KL.sand, borderRadius: 16, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, color: KL.umber, fontSize: 15 }}>{d.pseudo_a} × {d.pseudo_b}</div>
                  <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginTop: 2 }}>{d.topic}</div>
                  <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginTop: 2 }}>
                    terminé {fmtDate(d.ended)} · {d.end_reason || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {d.scores.length > 0 && (
                    <button onClick={() => toggleScores(d.id)} style={{
                      border: `1px solid ${KL.umber12}`, borderRadius: 12, padding: '6px 12px',
                      background: expandedScores[d.id] ? KL.sand2 : 'transparent',
                      cursor: 'pointer', fontFamily: KL.mono, fontSize: 11, color: KL.umber,
                    }}>Scores</button>
                  )}
                  <button onClick={() => onShadow(d)} style={{
                    border: `1px solid ${KL.umber12}`, borderRadius: 12, padding: '6px 12px',
                    background: 'transparent', cursor: 'pointer', fontFamily: KL.mono, fontSize: 11, color: KL.umber,
                  }}>👁 Shadow</button>
                  {d.scores.length > 0 && (
                    <button onClick={() => onBilan(d)} style={{
                      border: `1px solid ${KL.umber12}`, borderRadius: 12, padding: '6px 12px',
                      background: 'transparent', cursor: 'pointer', fontFamily: KL.mono, fontSize: 11, color: KL.umber,
                    }}>Bilan</button>
                  )}
                </div>
              </div>

              {expandedScores[d.id] && d.scores.length > 0 && (
                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: d.scores.length >= 2 ? '1fr 1fr' : '1fr', gap: 16 }}>
                  {d.scores.map(s => (
                    <div key={s.user}>
                      <div style={{ fontFamily: KL.mono, fontSize: 11, color: KL.clay, marginBottom: 8, fontWeight: 600 }}>
                        {s.pseudo} — moy {s.avg.toFixed(2)}/5
                      </div>
                      {criteria.map(([key, label]) => (
                        <ScoreBar key={key} label={label} value={s[key] || 0} />
                      ))}
                    </div>
                  ))}
                  {d.collective && (
                    <div style={{ gridColumn: d.scores.length >= 2 ? '1 / -1' : undefined, marginTop: 4, paddingTop: 12, borderTop: `1px solid ${KL.umber12}` }}>
                      <div style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55, marginBottom: 8 }}>collectif</div>
                      {[['clarification_mutuelle', 'Clarification mutuelle'], ['construction_dialogue', 'Construction du dialogue']].map(([key, label]) =>
                        d.collective[key] ? <ScoreBar key={key} label={label} value={d.collective[key].score || 0} /> : null
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ManualMatch({ stats, token, onRefresh }) {
  const [userA, setUserA] = useState('')
  const [userB, setUserB] = useState('')
  const [preview, setPreview] = useState(null)  // null | 'loading' | { data }
  const [matching, setMatching] = useState(false)
  const [matchMsg, setMatchMsg] = useState('')

  const eligible = (stats.users || []).filter(u =>
    u.is_active && ['in_dialogue', 'ever_matched', 'onboarding_complete'].includes(u.stage)
  )

  useEffect(() => {
    if (!userA || !userB) { setPreview(null); return }
    setPreview('loading')
    setMatchMsg('')
    fetch(`${BASE}/api/admin/match-preview/${userA}/${userB}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setPreview(data))
      .catch(() => setPreview(null))
  }, [userA, userB, token])

  async function forceMatch() {
    if (!preview || preview === 'loading' || !preview.can_match) return
    const pA = eligible.find(u => u.id === userA)?.pseudo
    const pB = eligible.find(u => u.id === userB)?.pseudo
    if (!confirm(`Apparier ${pA} et ${pB} ?`)) return
    setMatching(true)
    setMatchMsg('')
    try {
      const res = await fetch(`${BASE}/api/admin/match-force`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: userA, b: userB }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setMatchMsg(`Dialogue créé — ${data.topic}`)
      setUserA(''); setUserB(''); setPreview(null)
      onRefresh()
    } catch (err) {
      setMatchMsg(err.message || 'Erreur')
    } finally {
      setMatching(false)
    }
  }

  const tierColor = (t) => t >= 3 ? '#8DAF6E' : t >= 2 ? KL.clay : KL.umber55
  const tierLabel = (t) => t >= 3 ? 'désaccord profond' : t >= 2 ? 'désaccord notable' : t >= 1 ? 'désaccord faible' : 'aucun désaccord'

  const sel = {
    width: '100%', border: `1px solid ${KL.umber12}`, background: KL.sand,
    borderRadius: 14, padding: '10px 14px', fontFamily: KL.disp, fontSize: 14,
    color: KL.umber, outline: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55 }}>
        {eligible.length} utilisateur{eligible.length !== 1 ? 's' : ''} éligibles (onboarding terminé · actifs)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[['Participant A', userA, setUserA, userB], ['Participant B', userB, setUserB, userA]].map(([label, val, set, exclude]) => (
          <div key={label}>
            <div style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55, marginBottom: 6 }}>{label}</div>
            <select value={val} onChange={e => set(e.target.value)} style={sel}>
              <option value="">— sélectionner —</option>
              {eligible.filter(u => u.id !== exclude).map(u => (
                <option key={u.id} value={u.id}>{u.pseudo}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {preview === 'loading' && (
        <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55 }}>Analyse en cours…</div>
      )}

      {preview && preview !== 'loading' && (
        <div style={{ background: KL.sand, borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              ['Désaccord max', `${preview.clash_max}/4`, preview.clash_max >= 2 ? tierColor(preview.tier) : KL.umber55],
              ['Tier', `${preview.tier} — ${tierLabel(preview.tier)}`, tierColor(preview.tier)],
              ['Sujets communs', `${preview.common} · ${preview.shared} proches`, KL.umber55],
            ].map(([lbl, val, color]) => (
              <div key={lbl} style={{ background: KL.cream, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginBottom: 4 }}>{lbl}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color, lineHeight: 1.3 }}>{val}</div>
              </div>
            ))}
          </div>

          {preview.clash_topic_label && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55 }}>Sujet le plus clivant :</span>
              <span style={{ fontWeight: 600, color: KL.umber, fontSize: 14 }}>{preview.clash_topic_label}</span>
            </div>
          )}

          {!preview.clash_topic_label && preview.common === 0 && (
            <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55 }}>Aucun sujet en commun — le dialogue sera sans topic prédéfini.</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-block', borderRadius: 20, padding: '4px 14px',
              background: preview.already_matched ? KL.clay : '#8DAF6E',
              color: preview.already_matched ? KL.sand : '#fff',
              fontFamily: KL.mono, fontSize: 11,
            }}>
              {preview.already_matched ? 'Déjà appariés' : 'Jamais appariés'}
            </span>
            {preview.can_match && (
              <button onClick={forceMatch} disabled={matching} style={{
                border: 'none', borderRadius: 20, padding: '8px 22px',
                background: KL.umber, color: KL.cream, cursor: matching ? 'not-allowed' : 'pointer',
                fontFamily: KL.disp, fontWeight: 600, fontSize: 14, opacity: matching ? 0.6 : 1,
              }}>
                {matching ? 'Appariement…' : '⚡ Apparier maintenant'}
              </button>
            )}
          </div>
        </div>
      )}

      {matchMsg && (
        <div style={{ fontFamily: KL.mono, fontSize: 12, color: matchMsg.startsWith('Dialogue') ? '#8DAF6E' : KL.clay }}>
          {matchMsg}
        </div>
      )}
    </div>
  )
}

// ─── scoring lab ────────────────────────────────────────────────────────────

const IND_CRITERIA = ['respect', 'clarte', 'argumentation', 'nuance', 'ecoute_active', 'fair_play']
const IND_LABELS = { respect: 'Respect', clarte: 'Clarté', argumentation: 'Argumentation', nuance: 'Nuance', ecoute_active: 'Écoute active', fair_play: 'Fair-play' }
const COLL_CRITERIA = ['clarification_mutuelle', 'construction_dialogue']
const COLL_LABELS = { clarification_mutuelle: 'Clarification mutuelle', construction_dialogue: 'Construction du dialogue' }

const PROVIDER_PRESETS = {
  anthropic: { endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', api_key_env: 'ANTHROPIC_API_KEY' },
  openai: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', api_key_env: 'OPENAI_API_KEY' },
  mistral: { endpoint: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest', api_key_env: 'MISTRAL_API_KEY' },
}

function statOf(values) {
  if (values.length === 0) return null
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length
  return { avg, min: Math.min(...values), max: Math.max(...values), stdev: Math.sqrt(variance), n: values.length }
}

function stabilityFor(runs) {
  const ok = runs.filter(r => r.ok && r.result)
  const out = { A: {}, B: {}, collective: {} }
  for (const c of IND_CRITERIA) {
    out.A[c] = statOf(ok.map(r => r.result.participantA && r.result.participantA[c] && r.result.participantA[c].score).filter(v => v != null))
    out.B[c] = statOf(ok.map(r => r.result.participantB && r.result.participantB[c] && r.result.participantB[c].score).filter(v => v != null))
  }
  for (const c of COLL_CRITERIA) {
    out.collective[c] = statOf(ok.map(r => r.result.collective && r.result.collective[c] && r.result.collective[c].score).filter(v => v != null))
  }
  return out
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const labInput = {
  width: '100%', border: `1px solid ${KL.umber12}`, background: KL.cream,
  borderRadius: 12, padding: '9px 12px', fontFamily: KL.disp, fontSize: 13,
  color: KL.umber, outline: 'none',
}
const labLabel = { fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginBottom: 5, display: 'block' }
const labBtn = (bg, fg) => ({
  border: 'none', borderRadius: 14, padding: '9px 16px', cursor: 'pointer',
  background: bg, color: fg, fontFamily: KL.disp, fontWeight: 600, fontSize: 13,
})

function StabilityTable({ label, stats, criteria, labels }) {
  const rows = criteria.filter(c => stats[c])
  if (rows.length === 0) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: KL.mono, fontSize: 11, color: KL.clay, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {rows.map(c => {
        const s = stats[c]
        const spread = s.max - s.min
        return (
          <div key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${KL.umber12}` }}>
            <span style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber }}>{labels[c]}</span>
            <span style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55 }}>
              moy {s.avg.toFixed(2)} · écart-type {s.stdev.toFixed(2)}
              <span style={{ color: spread > 0.5 ? '#e57373' : KL.umber55, marginLeft: 8 }}>[{s.min.toFixed(1)}–{s.max.toFixed(1)}]</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RunResults({ batch }) {
  if (!batch) return null
  const stability = stabilityFor(batch.runs)
  const okCount = batch.runs.filter(r => r.ok).length
  return (
    <div style={{ background: KL.sand, borderRadius: 16, padding: 18, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: KL.umber, fontSize: 14 }}>{batch.pseudo_a} × {batch.pseudo_b}</div>
        <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55 }}>{okCount}/{batch.runs.length} réussi{okCount > 1 ? 's' : ''}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 8 }}>
        <StabilityTable label={`${batch.pseudo_a} (stabilité)`} stats={stability.A} criteria={IND_CRITERIA} labels={IND_LABELS} />
        <StabilityTable label={`${batch.pseudo_b} (stabilité)`} stats={stability.B} criteria={IND_CRITERIA} labels={IND_LABELS} />
      </div>
      <StabilityTable label="Collectif (stabilité)" stats={stability.collective} criteria={COLL_CRITERIA} labels={COLL_LABELS} />

      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginBottom: 8 }}>détail des {batch.runs.length} lancement{batch.runs.length > 1 ? 's' : ''}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {batch.runs.map(r => (
            <div key={r.run_index} style={{ fontFamily: KL.mono, fontSize: 10, color: r.ok ? KL.umber55 : '#e57373', display: 'flex', gap: 10 }}>
              <span>#{r.run_index}</span>
              <span>{r.duration_ms ? `${r.duration_ms}ms` : '—'}</span>
              <span>{r.ok ? 'ok' : `erreur: ${r.error}`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScoringLab({ stats, token }) {
  const [promptData, setPromptData] = useState(null)
  const [promptDraft, setPromptDraft] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)

  const [apis, setApis] = useState([])
  const [showAddApi, setShowAddApi] = useState(false)
  const [newApi, setNewApi] = useState({ name: '', provider: 'anthropic', model: '', endpoint: 'https://api.anthropic.com/v1/messages', api_key_env: '' })

  const [dialogueId, setDialogueId] = useState('')
  const [apiId, setApiId] = useState('')
  const [runsCount, setRunsCount] = useState(3)
  const [running, setRunning] = useState(false)
  const [lastBatch, setLastBatch] = useState(null)
  const [runError, setRunError] = useState('')

  const [history, setHistory] = useState([])
  const [expandedBatch, setExpandedBatch] = useState(null)

  const [exportScope, setExportScope] = useState('dialogue') // all | dialogue | batch
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const [gsheets, setGsheets] = useState(null)
  const [showGsheetsConfig, setShowGsheetsConfig] = useState(false)
  const [gsheetsForm, setGsheetsForm] = useState({ client_id: '', client_secret: '', refresh_token: '', spreadsheet_id: '', sheet_name: '' })
  const gsheetsConfigRef = useRef(null)

  function toggleGsheetsConfig() {
    setShowGsheetsConfig(s => {
      const next = !s
      if (next) setTimeout(() => gsheetsConfigRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
      return next
    })
  }

  const authHeaders = { Authorization: `Bearer ${token}` }
  const authJson = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const loadPrompt = useCallback(async () => {
    const res = await fetch(`${BASE}/api/admin/scoring/prompt`, { headers: authHeaders })
    const data = await res.json()
    setPromptData(data)
    setPromptDraft(data.prompt)
  }, [token])

  const loadApis = useCallback(async () => {
    const res = await fetch(`${BASE}/api/admin/scoring/apis`, { headers: authHeaders })
    const data = await res.json()
    setApis(data.apis || [])
    if (!apiId) {
      const def = (data.apis || []).find(a => a.is_default) || data.apis?.[0]
      if (def) setApiId(def.id)
    }
  }, [token])

  const loadGsheets = useCallback(async () => {
    const res = await fetch(`${BASE}/api/admin/integrations/google-sheets`, { headers: authHeaders })
    setGsheets(await res.json())
  }, [token])

  useEffect(() => { loadPrompt(); loadApis(); loadGsheets() }, [loadPrompt, loadApis, loadGsheets])

  const loadHistory = useCallback(async (id) => {
    if (!id) { setHistory([]); return }
    const res = await fetch(`${BASE}/api/admin/scoring/runs/${id}`, { headers: authHeaders })
    const data = await res.json()
    setHistory(data.batches || [])
  }, [token])

  useEffect(() => { loadHistory(dialogueId) }, [dialogueId, loadHistory])

  async function savePrompt() {
    setSavingPrompt(true)
    try {
      const res = await fetch(`${BASE}/api/admin/scoring/prompt`, { method: 'POST', headers: authJson, body: JSON.stringify({ prompt: promptDraft }) })
      if (!res.ok) throw new Error((await res.json()).message)
      await loadPrompt()
    } catch (err) { alert(err.message || 'Erreur') }
    setSavingPrompt(false)
  }

  async function resetPrompt() {
    if (!confirm('Revenir au prompt par défaut ? (utilisé aussi en production)')) return
    await fetch(`${BASE}/api/admin/scoring/prompt/reset`, { method: 'POST', headers: authHeaders })
    await loadPrompt()
  }

  async function createApi(e) {
    e.preventDefault()
    try {
      const res = await fetch(`${BASE}/api/admin/scoring/apis`, { method: 'POST', headers: authJson, body: JSON.stringify(newApi) })
      if (!res.ok) throw new Error((await res.json()).message)
      setNewApi({ name: '', provider: 'anthropic', model: '', endpoint: 'https://api.anthropic.com/v1/messages', api_key_env: '' })
      setShowAddApi(false)
      await loadApis()
    } catch (err) { alert(err.message || 'Erreur') }
  }

  async function setDefaultApi(id) {
    await fetch(`${BASE}/api/admin/scoring/apis/${id}/set-default`, { method: 'POST', headers: authHeaders })
    await loadApis()
  }

  async function deleteApi(id) {
    if (!confirm('Supprimer cette config API ?')) return
    await fetch(`${BASE}/api/admin/scoring/apis/${id}`, { method: 'DELETE', headers: authHeaders })
    await loadApis()
  }

  async function runScoring() {
    if (!dialogueId || !apiId) return
    setRunning(true)
    setRunError('')
    try {
      const res = await fetch(`${BASE}/api/admin/scoring/run`, {
        method: 'POST', headers: authJson,
        body: JSON.stringify({ dialogueId, apiId, prompt: promptDraft, runs: runsCount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setLastBatch(data)
      await loadHistory(dialogueId)
    } catch (err) { setRunError(err.message || 'Erreur') }
    setRunning(false)
  }

  function scopeBody() {
    if (exportScope === 'batch' && lastBatch) return { dialogueId, batchId: lastBatch.batch_id }
    if (exportScope === 'dialogue' && dialogueId) return { dialogueId }
    return {}
  }

  async function exportCsv() {
    setExporting(true); setExportMsg('')
    try {
      const res = await fetch(`${BASE}/api/admin/scoring/export`, { method: 'POST', headers: authJson, body: JSON.stringify(scopeBody()) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      downloadFile(data.filename, data.csv, 'text/csv;charset=utf-8;')
      setExportMsg(`${data.row_count} ligne(s) exportée(s).`)
    } catch (err) { setExportMsg(err.message || 'Erreur') }
    setExporting(false)
  }

  async function exportToSheets() {
    setExporting(true); setExportMsg('')
    try {
      const res = await fetch(`${BASE}/api/admin/scoring/export/google-sheets`, { method: 'POST', headers: authJson, body: JSON.stringify(scopeBody()) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setExportMsg(`${data.appended_rows} ligne(s) envoyée(s) vers Google Sheets.`)
    } catch (err) { setExportMsg(err.message || 'Erreur') }
    setExporting(false)
  }

  async function saveGsheetsConfig(e) {
    e.preventDefault()
    try {
      const res = await fetch(`${BASE}/api/admin/integrations/google-sheets`, { method: 'POST', headers: authJson, body: JSON.stringify(gsheetsForm) })
      if (!res.ok) throw new Error((await res.json()).message)
      setGsheetsForm({ client_id: '', client_secret: '', refresh_token: '', spreadsheet_id: '', sheet_name: '' })
      await loadGsheets()
      setExportMsg('Configuration Google Sheets enregistrée.')
      setShowGsheetsConfig(false)
    } catch (err) { alert(err.message || 'Erreur') }
  }

  const endedDialogues = stats.dialogues.ended
  const dirty = promptData && promptDraft !== promptData.prompt

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Prompt */}
      <div>
        <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber, fontWeight: 600, marginBottom: 10 }}>
          Prompt de notation {promptData?.is_custom && <span style={{ color: KL.clay }}>· personnalisé (actif en production)</span>}
        </div>
        <textarea
          value={promptDraft}
          onChange={e => setPromptDraft(e.target.value)}
          rows={12}
          style={{ ...labInput, fontFamily: KL.mono, fontSize: 12, lineHeight: 1.5, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={savePrompt} disabled={!dirty || savingPrompt} style={{ ...labBtn(KL.umber, KL.cream), opacity: !dirty || savingPrompt ? 0.5 : 1 }}>
            {savingPrompt ? 'Enregistrement…' : 'Enregistrer (production)'}
          </button>
          <button onClick={resetPrompt} style={labBtn(KL.sand2, KL.umber)}>Réinitialiser au défaut</button>
        </div>
        <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginTop: 6 }}>
          Les lancements de test ci-dessous utilisent le texte affiché ici, même non enregistré. Seul "Enregistrer" change ce qui est utilisé en production.
        </div>
      </div>

      {/* APIs */}
      <div>
        <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber, fontWeight: 600, marginBottom: 10 }}>APIs de notation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {apis.map(a => (
            <div key={a.id} style={{ background: KL.sand, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <span style={{ fontWeight: 600, color: KL.umber, fontSize: 13 }}>{a.name}</span>
                <span style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginLeft: 8 }}>{a.provider} · {a.model}</span>
              </div>
              {a.is_default
                ? <span style={{ fontFamily: KL.mono, fontSize: 10, color: KL.clay }}>par défaut</span>
                : <button onClick={() => setDefaultApi(a.id)} style={{ ...labBtn(KL.sand2, KL.umber), padding: '4px 10px', fontSize: 11 }}>Définir par défaut</button>}
              <button onClick={() => deleteApi(a.id)} style={{ ...labBtn('transparent', KL.umber55), border: `1px solid ${KL.umber12}`, padding: '4px 10px', fontSize: 11 }}>Supprimer</button>
            </div>
          ))}
        </div>
        {!showAddApi && (
          <button onClick={() => setShowAddApi(true)} style={{ ...labBtn(KL.sand2, KL.umber), marginTop: 10 }}>+ Ajouter une API</button>
        )}
        {showAddApi && (
          <form onSubmit={createApi} style={{ background: KL.sand, borderRadius: 14, padding: 16, marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labLabel}>Nom</label><input required style={labInput} value={newApi.name} onChange={e => setNewApi({ ...newApi, name: e.target.value })} /></div>
            <div>
              <label style={labLabel}>Provider</label>
              <select style={{ ...labInput, cursor: 'pointer' }} value={newApi.provider} onChange={e => {
                const provider = e.target.value
                const preset = PROVIDER_PRESETS[provider] || { endpoint: '', model: '', api_key_env: '' }
                setNewApi({ ...newApi, provider, endpoint: preset.endpoint, model: newApi.model || preset.model, api_key_env: newApi.api_key_env || preset.api_key_env })
              }}>
                <option value="anthropic">anthropic</option>
                <option value="openai">openai</option>
                <option value="mistral">mistral</option>
              </select>
            </div>
            <div><label style={labLabel}>Modèle</label><input required style={labInput} value={newApi.model} onChange={e => setNewApi({ ...newApi, model: e.target.value })} /></div>
            <div><label style={labLabel}>Endpoint</label><input required style={labInput} value={newApi.endpoint} onChange={e => setNewApi({ ...newApi, endpoint: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labLabel}>Variable d'env. contenant la clé API</label>
              <input required style={labInput} placeholder="ex. ANTHROPIC_API_KEY" value={newApi.api_key_env} onChange={e => setNewApi({ ...newApi, api_key_env: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" style={labBtn(KL.umber, KL.cream)}>Créer</button>
              <button type="button" onClick={() => setShowAddApi(false)} style={labBtn(KL.sand2, KL.umber)}>Annuler</button>
            </div>
          </form>
        )}
        <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginTop: 8 }}>
          anthropic, openai et mistral sont pris en charge. La clé API doit être présente comme variable d'environnement du serveur (ex. OPENAI_API_KEY) — jamais stockée ici.
        </div>
      </div>

      {/* Run */}
      <div>
        <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber, fontWeight: 600, marginBottom: 10 }}>Re-notation (test de stabilité)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={labLabel}>Dialogue terminé</label>
            <select style={{ ...labInput, cursor: 'pointer' }} value={dialogueId} onChange={e => { setDialogueId(e.target.value); setLastBatch(null) }}>
              <option value="">— sélectionner —</option>
              {endedDialogues.map(d => (
                <option key={d.id} value={d.id}>{d.pseudo_a} × {d.pseudo_b} — {d.topic}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labLabel}>API</label>
            <select style={{ ...labInput, cursor: 'pointer' }} value={apiId} onChange={e => setApiId(e.target.value)}>
              {apis.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labLabel}>Nombre de lancements</label>
            <input type="number" min={1} max={10} style={labInput} value={runsCount} onChange={e => setRunsCount(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))} />
          </div>
        </div>
        <button onClick={runScoring} disabled={!dialogueId || !apiId || running} style={{ ...labBtn(KL.clay, KL.sand), marginTop: 12, opacity: !dialogueId || !apiId || running ? 0.5 : 1 }}>
          {running ? `Notation en cours (${runsCount})…` : `⚡ Lancer ${runsCount} notation${runsCount > 1 ? 's' : ''}`}
        </button>
        {runError && <div style={{ color: '#e57373', fontFamily: KL.mono, fontSize: 12, marginTop: 8 }}>{runError}</div>}

        <RunResults batch={lastBatch} />

        {history.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55, marginBottom: 8 }}>historique des lancements pour ce dialogue</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map(b => (
                <div key={b.batch_id}>
                  <div
                    onClick={() => setExpandedBatch(expandedBatch === b.batch_id ? null : b.batch_id)}
                    style={{ background: KL.sand, borderRadius: 12, padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontFamily: KL.mono, fontSize: 11, color: KL.umber }}
                  >
                    <span>{fmtTimestamp(b.created)} · {b.api_name} · {b.runs.length} run{b.runs.length > 1 ? 's' : ''}</span>
                    <span style={{ color: KL.umber55 }}>{expandedBatch === b.batch_id ? '▲' : '▼'}</span>
                  </div>
                  {expandedBatch === b.batch_id && (
                    <RunResults batch={{ pseudo_a: endedDialogues.find(d => d.id === dialogueId)?.pseudo_a, pseudo_b: endedDialogues.find(d => d.id === dialogueId)?.pseudo_b, runs: b.runs.map(r => ({ ...r, ok: !r.error && !!r.result })) }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Export */}
      <div>
        <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber, fontWeight: 600, marginBottom: 10 }}>Export</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {[['batch', 'Dernier lancement'], ['dialogue', 'Ce dialogue'], ['all', 'Toutes les données']].map(([key, label]) => (
            <button key={key} onClick={() => setExportScope(key)} disabled={key === 'batch' && !lastBatch} style={{
              border: 'none', borderRadius: 14, padding: '6px 14px', cursor: 'pointer',
              background: exportScope === key ? KL.clay : KL.sand2,
              color: exportScope === key ? KL.sand : KL.umber55,
              fontFamily: KL.mono, fontSize: 11, opacity: key === 'batch' && !lastBatch ? 0.4 : 1,
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={exportCsv} disabled={exporting} style={labBtn(KL.umber, KL.cream)}>{exporting ? '…' : '⇩ Exporter CSV / Excel'}</button>
          <button onClick={exportToSheets} disabled={exporting || !gsheets?.configured} style={{ ...labBtn(KL.sand2, KL.umber), opacity: gsheets?.configured ? 1 : 0.5 }}>
            {exporting ? '…' : '📤 Envoyer vers Google Sheets'}
          </button>
          <button onClick={toggleGsheetsConfig} style={{
            ...labBtn(showGsheetsConfig ? KL.sand2 : 'transparent', KL.umber55),
            border: `1px solid ${KL.umber12}`,
          }}>
            {showGsheetsConfig ? '▲ Fermer la configuration' : gsheets?.configured ? '⚙ Google Sheets configuré' : '⚙ Configurer Google Sheets'}
          </button>
        </div>
        {exportMsg && <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55, marginTop: 8 }}>{exportMsg}</div>}

        {showGsheetsConfig && (
          <form ref={gsheetsConfigRef} onSubmit={saveGsheetsConfig} style={{ background: KL.sand, borderRadius: 14, padding: 16, marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1', fontFamily: KL.mono, fontSize: 10, color: KL.umber55 }}>
              Nécessite un client OAuth Google (type "Desktop app") avec l'API Sheets activée, et un refresh token obtenu une fois via OAuth Playground avec le scope https://www.googleapis.com/auth/spreadsheets. Laisser un champ vide pour ne pas le modifier.
            </div>
            <div><label style={labLabel}>Client ID</label><input style={labInput} value={gsheetsForm.client_id} placeholder={gsheets?.client_id || ''} onChange={e => setGsheetsForm({ ...gsheetsForm, client_id: e.target.value })} /></div>
            <div><label style={labLabel}>Client secret</label><input type="password" style={labInput} placeholder={gsheets?.client_secret_set ? '••••••••' : ''} value={gsheetsForm.client_secret} onChange={e => setGsheetsForm({ ...gsheetsForm, client_secret: e.target.value })} /></div>
            <div><label style={labLabel}>Refresh token</label><input type="password" style={labInput} placeholder={gsheets?.refresh_token_set ? '••••••••' : ''} value={gsheetsForm.refresh_token} onChange={e => setGsheetsForm({ ...gsheetsForm, refresh_token: e.target.value })} /></div>
            <div><label style={labLabel}>Spreadsheet ID</label><input style={labInput} placeholder={gsheets?.spreadsheet_id || ''} value={gsheetsForm.spreadsheet_id} onChange={e => setGsheetsForm({ ...gsheetsForm, spreadsheet_id: e.target.value })} /></div>
            <div><label style={labLabel}>Nom de l'onglet</label><input style={labInput} placeholder={gsheets?.sheet_name || 'Scoring runs'} value={gsheetsForm.sheet_name} onChange={e => setGsheetsForm({ ...gsheetsForm, sheet_name: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><button type="submit" style={labBtn(KL.umber, KL.cream)}>Enregistrer</button></div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token') || null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [section, setSection] = useState('controls')
  const [shadow, setShadow] = useState(null)
  const [bilan, setBilan] = useState(null)

  const fetchStats = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 403) { setToken(null); sessionStorage.removeItem('admin_token'); return }
      setStats(await res.json())
    } catch (_) {}
    setLoading(false)
  }, [token])

  useEffect(() => { fetchStats() }, [fetchStats])

  async function login(e) {
    e.preventDefault()
    setLoginError('')
    try {
      const res = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      sessionStorage.setItem('admin_token', data.token)
      setToken(data.token)
    } catch (err) {
      setLoginError(err.message || 'Identifiants incorrects.')
    }
  }

  async function openShadow(d) {
    const res = await fetch(`${BASE}/api/admin/dialogue/${d.id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setShadow({ ...d, messages: data.messages || [] })
  }

  async function toggleUserActive(id, currentlyActive) {
    await fetch(`${BASE}/api/admin/user/${id}/toggle-active`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchStats()
  }

  async function endDialogue(id) {
    if (!confirm('Terminer ce dialogue ?')) return
    await fetch(`${BASE}/api/admin/dialogue/${id}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchStats()
  }

  // ── Login form ──
  if (!token) {
    return (
      <div style={{ minHeight: '100dvh', background: KL.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KL.disp, padding: 20 }}>
        <form onSubmit={login} style={{ background: KL.sand, borderRadius: 24, padding: 32, width: '100%', maxWidth: 360, boxShadow: '0 12px 40px rgba(58,45,36,0.12)' }}>
          <div style={{ fontFamily: KL.mono, fontSize: 10, color: KL.umber55, marginBottom: 6 }}>admin</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: KL.umber, marginBottom: 24 }}>Tandem</div>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail"
            required autoFocus
            style={{ width: '100%', border: `1px solid ${KL.umber12}`, background: KL.cream, borderRadius: 14, padding: '12px 14px', fontFamily: KL.disp, fontSize: 15, color: KL.umber, outline: 'none', marginBottom: 10 }}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe"
            required
            style={{ width: '100%', border: `1px solid ${KL.umber12}`, background: KL.cream, borderRadius: 14, padding: '12px 14px', fontFamily: KL.disp, fontSize: 15, color: KL.umber, outline: 'none', marginBottom: loginError ? 8 : 16 }}
          />
          {loginError && <div style={{ fontSize: 13, color: KL.clay, marginBottom: 12 }}>{loginError}</div>}
          <button type="submit" style={{ width: '100%', border: 'none', borderRadius: 20, padding: '14px', cursor: 'pointer', background: KL.umber, color: KL.cream, fontFamily: KL.disp, fontWeight: 700, fontSize: 15 }}>
            Se connecter
          </button>
        </form>
      </div>
    )
  }

  // ── Dashboard ──
  const SECTIONS = [['controls', 'Contrôles'], ['users', 'Utilisateurs'], ['dialogues', 'Dialogues'], ['match', 'Appariement'], ['scoring', 'Labo de notation']]

  return (
    <div style={{ minHeight: '100dvh', background: KL.cream, fontFamily: KL.disp }}>
      {/* Header */}
      <div style={{ background: KL.sand, borderBottom: `1px solid ${KL.umber12}`, padding: '0 24px', display: 'flex', alignItems: 'center', height: 52, gap: 16 }}>
        <span style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55 }}>admin</span>
        <span style={{ fontWeight: 700, color: KL.umber, fontSize: 16 }}>Tandem</span>
        <div style={{ flex: 1 }} />
        <button onClick={fetchStats} disabled={loading} style={{ border: `1px solid ${KL.umber12}`, borderRadius: 12, padding: '5px 12px', background: 'transparent', cursor: 'pointer', fontFamily: KL.mono, fontSize: 11, color: KL.umber55 }}>
          {loading ? '…' : '↻ Rafraîchir'}
        </button>
        <button onClick={() => { setToken(null); sessionStorage.removeItem('admin_token') }} style={{ border: 'none', borderRadius: 12, padding: '5px 12px', background: 'transparent', cursor: 'pointer', fontFamily: KL.mono, fontSize: 11, color: KL.umber55 }}>
          Déconnexion
        </button>
      </div>

      {/* Section nav */}
      <div style={{ background: KL.sand, borderBottom: `1px solid ${KL.umber12}`, padding: '0 24px', display: 'flex', gap: 4 }}>
        {SECTIONS.map(([key, label]) => (
          <button key={key} onClick={() => setSection(key)} style={{
            border: 'none', background: 'none', cursor: 'pointer', padding: '12px 14px',
            fontFamily: KL.mono, fontSize: 12, color: section === key ? KL.clay : KL.umber55,
            borderBottom: section === key ? `2px solid ${KL.clay}` : '2px solid transparent',
            fontWeight: section === key ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px' }}>
        {!stats && loading && (
          <div style={{ fontFamily: KL.mono, fontSize: 13, color: KL.umber55, textAlign: 'center', paddingTop: 60 }}>Chargement…</div>
        )}
        {stats && section === 'controls'  && <Controls stats={stats} token={token} onRefresh={fetchStats} onShadow={openShadow} onEnd={endDialogue} />}
        {stats && section === 'users'     && <Users stats={stats} onToggleActive={toggleUserActive} />}
        {stats && section === 'dialogues' && <Dialogues stats={stats} token={token} onShadow={openShadow} onEnd={endDialogue} onBilan={setBilan} />}
        {stats && section === 'match'     && <ManualMatch stats={stats} token={token} onRefresh={fetchStats} />}
        {stats && section === 'scoring'   && <ScoringLab stats={stats} token={token} />}
      </div>

      <ShadowModal shadow={shadow} onClose={() => setShadow(null)} />
      <BilanModal dialogue={bilan} onClose={() => setBilan(null)} />
    </div>
  )
}
