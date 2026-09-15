import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { pb } from '../pb'
import { useAuth } from '../auth'
import { KL } from '../theme'
import { useIsDesktop, Mono } from '../ui'
import { COPY } from '../copy'

export default function Dialogue() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const desktop = useIsDesktop()
  const [d, setD] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    let unsubDialogue, unsubMessages
    ;(async () => {
      const dialogue = await pb.collection('dialogues').getOne(id, { expand: 'participant_a,participant_b,topic' })
      setD(dialogue)
      if (dialogue.status === 'ended') { nav(`/bilan/${id}`, { replace: true }); return }

      unsubDialogue = await pb.collection('dialogues').subscribe(id, (e) => {
        if (e.action === 'update') {
          setD(e.record)
          if (e.record.status === 'ended') nav(`/bilan/${id}`, { replace: true })
        }
      })

      const initial = await pb.collection('messages').getFullList({
        filter: `dialogue = "${id}"`, sort: 'created', expand: 'sender',
      })
      setMsgs(initial)

      unsubMessages = await pb.collection('messages').subscribe('*', (e) => {
        if (e.action === 'create' && e.record.dialogue === id) setMsgs((m) => [...m, e.record])
      }, { filter: `dialogue = "${id}"` })
    })()

    return () => { if (unsubDialogue) unsubDialogue(); if (unsubMessages) unsubMessages() }
  }, [id, nav])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  if (!d) return (
    <div style={{ padding: 24, fontFamily: KL.mono, color: KL.umber }}>
      {COPY.dialogue.loading}
    </div>
  )

  const opp = d.participant_a === user.id ? d.expand?.participant_b : d.expand?.participant_a
  const active = d.status === 'active'
  const myTurn = active && d.current_turn === user.id

  async function send() {
    const body = text.trim()
    if (!body) return
    setSending(true)
    try {
      await pb.collection('messages').create({ dialogue: id, sender: user.id, body, is_prompt: false })
      setText('')
    } catch (e) { console.log('send error:', e) }
    setSending(false)
  }

  async function flag() {
    const reason = window.prompt(COPY.dialogue.prompt_report)
    if (!reason) return
    try {
      await pb.collection('reports').create({ reporter: user.id, dialogue: id, reason })
      alert(COPY.dialogue.report_sent)
    } catch (e) { console.log('flag error:', e) }
  }

  async function leave() {
    if (!window.confirm(COPY.dialogue.confirm_leave)) return
    try {
      await pb.send(`/api/dialogue/${id}/leave`, { method: 'POST' })
      nav(`/bilan/${id}`, { replace: true })
    } catch (e) {
      alert(COPY.dialogue.err_leave)
      console.log('leave error:', e)
    }
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (myTurn && text.trim() && !sending) send()
    }
  }

  const maxW = desktop ? 900 : 440
  const topPad = desktop ? 56 : 0

  return (
    <div style={{
      height: '100dvh',
      background: KL.cream,
      color: KL.umber,
      fontFamily: KL.disp,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: maxW,
      margin: '0 auto',
      paddingTop: topPad,
    }}>
      {/* header */}
      <div style={{
        padding: desktop ? '14px 24px 12px' : '16px 18px 10px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${KL.umber12}`,
      }}>
        <button onClick={() => nav('/')} style={{ border: 'none', background: 'transparent', fontFamily: KL.mono, color: KL.umber55, cursor: 'pointer', fontSize: 16 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: desktop ? 16 : 15, lineHeight: 1.1 }}>{d.expand?.topic?.label}</div>
          <Mono>
            avec {opp?.pseudonym} · {
              active
                ? (myTurn ? COPY.dialogue.my_turn_status : COPY.dialogue.their_turn_status(opp?.pseudonym))
                : COPY.dialogue.ended_status
            }
          </Mono>
        </div>
        <button onClick={flag} title="Signaler" style={{ border: 'none', background: 'transparent', color: KL.umber55, cursor: 'pointer', fontSize: 16 }}>⚑</button>
      </div>

      {/* transcript */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: desktop ? '20px 24px' : '16px 18px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {msgs.map((m) => {
          if (m.is_prompt || !m.sender) {
            return (
              <div key={m.id} style={{
                alignSelf: 'center', textAlign: 'center',
                maxWidth: desktop ? '70%' : '90%',
                background: KL.sand2, borderRadius: 16,
                padding: '10px 14px', fontFamily: KL.disp, fontSize: 14, color: KL.umber,
              }}>{m.body}</div>
            )
          }
          const mine = m.sender === user.id
          return (
            <div key={m.id} style={{
              alignSelf: mine ? 'flex-end' : 'flex-start',
              maxWidth: desktop ? '65%' : '82%',
              background: mine ? KL.clay : KL.sand,
              color: mine ? KL.sand : KL.umber,
              borderRadius: mine ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
              padding: '11px 14px',
              boxShadow: '0 4px 14px rgba(58,45,36,0.05)',
            }}>
              <div style={{ fontFamily: KL.disp, fontSize: desktop ? 15 : 14.5, lineHeight: 1.4 }}>{m.body}</div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* composer */}
      {active && (
        <div style={{
          padding: desktop ? '14px 24px 20px' : '12px 16px 18px',
          borderTop: `1px solid ${KL.umber12}`,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={desktop ? 3 : 1}
              placeholder={myTurn ? COPY.dialogue.placeholder_my_turn : COPY.dialogue.placeholder_waiting(opp?.pseudonym)}
              disabled={!myTurn}
              style={{
                flex: 1,
                resize: 'none',
                border: `1.5px solid ${KL.umber12}`,
                background: myTurn ? KL.sand : 'transparent',
                color: KL.umber,
                borderRadius: 18,
                padding: '12px 14px',
                fontFamily: KL.disp,
                fontSize: 15,
                outline: 'none',
                opacity: myTurn ? 1 : 0.6,
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={send}
              disabled={!myTurn || sending || !text.trim()}
              style={{
                border: 'none', background: KL.umber, color: KL.cream,
                width: 46, height: 46, borderRadius: '50%',
                cursor: myTurn ? 'pointer' : 'not-allowed',
                opacity: myTurn && text.trim() ? 1 : 0.4, fontSize: 18,
                flexShrink: 0,
              }}>↑</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={leave} style={{
              border: 'none', background: 'transparent', color: KL.umber55,
              fontFamily: KL.mono, fontSize: 12, cursor: 'pointer', padding: '4px 0',
            }}>{COPY.dialogue.btn_leave}</button>
            {desktop && myTurn && (
              <span style={{ fontFamily: KL.mono, fontSize: 11, color: KL.umber55 }}>
                {COPY.dialogue.send_hint}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
