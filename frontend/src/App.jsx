import { useEffect, useState } from 'react'
import { createHashRouter, RouterProvider, NavLink, Navigate } from 'react-router-dom'
import { KL } from './theme'
import { useIsDesktop, Screen, Button, Mono } from './ui'
import { useAuth } from './auth'
import { COPY } from './copy'
import Inscription from './screens/Inscription.jsx'
import Opinions from './screens/Opinions.jsx'
import Accueil from './screens/Accueil.jsx'
import Dialogue from './screens/Dialogue.jsx'
import Bilan from './screens/Bilan.jsx'
import Classement from './screens/Classement.jsx'
import Profil from './screens/Profil.jsx'
import Admin from './screens/Admin.jsx'

const TABS = [
  ['/',            COPY.nav.home],
  ['/classement',  COPY.nav.leaderboard],
  ['/profil',      COPY.nav.profile],
]

function Nav() {
  const desktop = useIsDesktop()

  if (desktop) {
    return (
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', gap: 4,
        background: KL.sand, padding: '0 32px', height: 56,
        boxShadow: '0 1px 0 rgba(58,45,36,0.08)',
      }}>
        <img src="./logo-tandem.png" alt="Tandem" width={28} height={28} style={{ borderRadius: 6, marginRight: 8 }} />
        <span style={{ fontFamily: KL.mono, fontSize: 12, color: KL.clay, marginRight: 20, letterSpacing: 0.5 }}>
          {COPY.app.name}
        </span>
        {TABS.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            fontFamily: KL.mono, fontSize: 12, textDecoration: 'none',
            padding: '6px 14px', borderRadius: 16,
            color: isActive ? KL.sand : KL.umber55,
            background: isActive ? KL.clay : 'transparent',
          })}>{label}</NavLink>
        ))}
      </nav>
    )
  }

  return (
    <nav style={{
      position: 'sticky', bottom: 0, marginTop: 'auto',
      display: 'flex', justifyContent: 'space-around', gap: 8,
      background: KL.sand, borderRadius: 24, padding: '10px 8px',
      boxShadow: '0 -2px 20px rgba(58,45,36,0.06)',
    }}>
      {TABS.map(([to, label]) => (
        <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
          fontFamily: KL.mono, fontSize: 12, textDecoration: 'none', padding: '6px 12px',
          borderRadius: 16, color: isActive ? KL.sand : KL.umber55,
          background: isActive ? KL.clay : 'transparent',
        })}>{label}</NavLink>
      ))}
    </nav>
  )
}

function DeactivatedScreen() {
  const { logout } = useAuth()
  return (
    <Screen>
      <Mono>{COPY.app.name}</Mono>
      <p style={{ fontFamily: KL.disp, fontSize: 16, color: KL.umber, lineHeight: 1.6, marginTop: 12 }}>
        {COPY.app.account_deactivated}
      </p>
      <div style={{ marginTop: 'auto' }}>
        <Button variant="ghost" onClick={logout}>Se déconnecter</Button>
      </div>
    </Screen>
  )
}

function Gate({ children, tabs = true }) {
  const { isValid, user } = useAuth()
  if (!isValid) return <Navigate to="/inscription" replace />
  if (!user?.pseudonym || !user?.guidelines_accepted_at) return <Navigate to="/inscription" replace />
  if (user?.is_active === false) return <DeactivatedScreen />
  if (!user?.onboarding_complete) return <Navigate to="/opinions" replace />
  return <>{children}{tabs && <Nav />}</>
}

const router = createHashRouter([
  { path: '/inscription', element: <Inscription /> },
  { path: '/opinions',    element: <Opinions /> },
  { path: '/',            element: <Gate><Accueil /></Gate> },
  { path: '/dialogue/:id', element: <Gate tabs={false}><Dialogue /></Gate> },
  { path: '/bilan/:id',   element: <Gate tabs={false}><Bilan /></Gate> },
  { path: '/classement',  element: <Gate><Classement /></Gate> },
  { path: '/profil',      element: <Gate><Profil /></Gate> },
  { path: '/admin',       element: <Admin /> },
])

export default function App() {
  const { refresh } = useAuth()
  const [ready, setReady] = useState(false)
  useEffect(() => { refresh().finally(() => setReady(true)) }, [])
  if (!ready) return null
  return <RouterProvider router={router} />
}
