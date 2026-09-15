import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../pb'
import { useAuth } from '../auth'
import { KL } from '../theme'
import { Screen, Card, Button, Field, Mono } from '../ui'
import { COPY } from '../copy'

const C = COPY.inscription

export default function Inscription() {
  const { isValid, user, refresh } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isValid && user?.pseudonym && user?.guidelines_accepted_at) {
      nav(user?.onboarding_complete ? '/' : '/opinions', { replace: true })
    }
  }, [isValid, user])

  async function submitAuth() {
    setErr('')
    if (!email.trim() || password.length < 8) { setErr(C.err_fields); return }
    setBusy(true)
    try {
      if (mode === 'signup') {
        await pb.collection('users').create({ email: email.trim(), password, passwordConfirm: password, is_active: true })
      }
      await pb.collection('users').authWithPassword(email.trim(), password)
      await refresh()
    } catch (e) {
      setErr(mode === 'signup' ? C.err_signup_failed : C.err_login_failed)
    }
    setBusy(false)
  }

  async function savePseudo() {
    const v = pseudo.trim()
    if (v.length < 3) { setErr(C.err_pseudo_short); return }
    setErr(''); setBusy(true)
    try {
      await pb.collection('users').update(user.id, { pseudonym: v })
      await refresh()
    } catch (e) { setErr(C.err_pseudo_taken) }
    setBusy(false)
  }

  async function acceptCharte() {
    setBusy(true)
    await pb.collection('users').update(user.id, { guidelines_accepted_at: new Date().toISOString() })
    await refresh()
    setBusy(false)
    nav('/opinions', { replace: true })
  }

  const step = !isValid ? 'auth' : !user?.pseudonym ? 'pseudo' : 'charte'
  const onEnter = (e) => { if (e.key === 'Enter') submitAuth() }

  return (
    <Screen>
      <div style={{ marginTop: 36 }}>
        <Mono color={KL.clay}>{C.tag}</Mono>
        <h1 style={{ fontWeight: 700, fontSize: 48, lineHeight: 0.96, letterSpacing: -1.5, margin: '8px 0 0' }}>
          {step === 'auth'  && C.headline_auth}
          {step === 'pseudo' && C.headline_pseudo}
          {step === 'charte' && C.headline_charte}
        </h1>
        <p style={{ fontFamily: KL.mono, fontSize: 13, color: KL.umber55, lineHeight: 1.55, marginTop: 14, maxWidth: 320 }}>
          {step === 'auth'  && C.subtitle_auth}
          {step === 'pseudo' && C.subtitle_pseudo}
          {step === 'charte' && C.subtitle_charte}
        </p>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {err && <Mono color={KL.clay}>{err}</Mono>}

        {step === 'auth' && (<>
          <Field value={email} onChange={setEmail} placeholder={C.placeholder_email} type="email" onKeyDown={onEnter} />
          <Field value={password} onChange={setPassword} placeholder={C.placeholder_password} type="password" onKeyDown={onEnter} />
          <Button variant="clay" disabled={busy} onClick={submitAuth}>
            {mode === 'signup' ? C.btn_signup : C.btn_login}
          </Button>
          <div style={{ textAlign: 'center' }}>
            <span onClick={() => { setErr(''); setMode(mode === 'signup' ? 'login' : 'signup') }}
              style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55, cursor: 'pointer' }}>
              {mode === 'signup' ? C.link_to_login : C.link_to_signup}
            </span>
          </div>
        </>)}

        {step === 'pseudo' && (<>
          <Field value={pseudo} onChange={setPseudo} placeholder={C.placeholder_pseudo} maxLength={40} />
          <Button variant="clay" disabled={busy} onClick={savePseudo}>{C.btn_pseudo}</Button>
        </>)}

        {step === 'charte' && (<>
          <Card soft style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {C.charte_items.map(([t, dsc]) => (
              <div key={t}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{t}</div>
                <div style={{ fontFamily: KL.mono, fontSize: 12, color: KL.umber55, marginTop: 2 }}>{dsc}</div>
              </div>
            ))}
          </Card>
          <Button variant="clay" disabled={busy} onClick={acceptCharte}>{C.btn_charte}</Button>
        </>)}
      </div>
    </Screen>
  )
}
