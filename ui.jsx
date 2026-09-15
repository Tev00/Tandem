import { KL } from './theme'

// App column: cream, mobile-first, centred.
export function Screen({ children, pad = 22 }) {
  return (
    <div style={{ minHeight: '100dvh', background: KL.cream, color: KL.umber, fontFamily: KL.disp }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: pad, display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100dvh' }}>
        {children}
      </div>
    </div>
  )
}

export function Mono({ children, color, size = 11, style }) {
  return <span style={{ fontFamily: KL.mono, fontSize: size, color: color || KL.umber55, ...style }}>{children}</span>
}

export function Card({ children, soft, style }) {
  return (
    <div style={{
      background: KL.sand, borderRadius: 22, padding: 18,
      boxShadow: soft ? '0 6px 18px rgba(58,45,36,0.05)' : '0 12px 30px rgba(58,45,36,0.06)',
      ...style,
    }}>{children}</div>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, full = true, style }) {
  const base = {
    border: 'none', borderRadius: 30, padding: '15px 20px', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: KL.disp, fontWeight: 600, fontSize: 15, width: full ? '100%' : 'auto',
    opacity: disabled ? 0.5 : 1, transition: 'transform .08s',
  }
  const variants = {
    primary: { background: KL.umber, color: KL.cream, boxShadow: '0 8px 20px rgba(58,45,36,0.18)' },
    clay: { background: KL.clay, color: KL.sand, boxShadow: '0 8px 20px rgba(200,117,90,0.3)' },
    ghost: { background: 'transparent', color: KL.umber, border: `1.5px solid ${KL.umber12}`, boxShadow: 'none' },
  }
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>
}

export function Pill({ children, active, onClick, style }) {
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: active ? KL.clay : KL.sand2, color: active ? KL.sand : KL.umber,
      borderRadius: 30, padding: '8px 14px', fontFamily: KL.mono, fontSize: 12,
      cursor: onClick ? 'pointer' : 'default', userSelect: 'none', ...style,
    }}>{children}</span>
  )
}

export function Meter({ pct, color = KL.clay, track = KL.sand2, height = 8, radius = 4 }) {
  return (
    <div style={{ height, background: track, borderRadius: radius, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: radius }} />
    </div>
  )
}

export function Avatar({ name = '?', active, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flex: 'none',
      background: active ? KL.clay : KL.sand2, color: active ? KL.sand : KL.umber,
      fontFamily: KL.disp, fontWeight: 700, fontSize: size * 0.42,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{(name[0] || '?').toUpperCase()}</div>
  )
}

export function Field({ value, onChange, placeholder, maxLength, type = 'text', onKeyDown }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} onKeyDown={onKeyDown}
      style={{
        width: '100%', border: `1.5px solid ${KL.umber12}`, background: KL.sand, color: KL.umber,
        borderRadius: 16, padding: '13px 15px', fontFamily: KL.disp, fontSize: 15, outline: 'none',
      }} />
  )
}

// The 5-point opinion scale (1..5, 3 = neutral).
export function Scale({ value, onChange }) {
  const labels = ['Pas du tout', '', 'Neutre', '', 'Tout à fait']
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)} title={labels[n - 1] || ''}
          style={{
            flex: 1, height: 38, borderRadius: 12, cursor: 'pointer',
            border: value === n ? 'none' : `1.5px solid ${KL.umber12}`,
            background: value === n ? KL.clay : 'transparent',
            color: value === n ? KL.sand : KL.umber55,
            fontFamily: KL.mono, fontSize: 13, fontWeight: 500,
          }}>{n}</button>
      ))}
    </div>
  )
}
