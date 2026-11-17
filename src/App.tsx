import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowLeft, ArrowUpRight, BookHeart, Flower2, Infinity, LockKeyhole,
  Mail, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type AuthMode = 'signin' | 'signup' | 'reset'

const pillars = [
  { icon: BookHeart, title: 'Stories', description: 'Preserve the moments, memories and lessons that make your life uniquely yours.' },
  { icon: Infinity, title: 'Legacy', description: 'Pass on the values, wishes and knowledge you want future generations to carry.' },
  { icon: ShieldCheck, title: 'Safekeeping', description: 'Keep what matters together, with privacy and control at the heart of the experience.' },
]

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? 'brand-art brand-art-large' : 'brand-art'} aria-hidden="true">
      <Flower2 strokeWidth={1.15} />
      <span className="brand-art-core" />
    </span>
  )
}

function AuthPanel({ onClose, onAuthenticated }: { onClose: () => void; onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function changeMode(next: AuthMode) {
    setMode(next)
    setMessage('')
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!supabase) {
      setError('SOOUL authentication is not configured yet. The Supabase project URL and publishable key must be added to Cloudflare environment variables.')
      return
    }
    if (mode !== 'reset' && password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (authError) throw authError
        if (data.session && data.user) {
          onAuthenticated(data.user)
        } else {
          setMessage('Your account request has been received. Check your email for the confirmation link, then return here to sign in.')
          setMode('signin')
          setPassword('')
          setConfirmPassword('')
        }
      } else if (mode === 'signin') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (authError) throw authError
        if (data.user) onAuthenticated(data.user)
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (authError) throw authError
        setMessage('If an account exists for that email, a password reset link has been sent.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const heading = mode === 'signup' ? 'Begin your legacy.' : mode === 'signin' ? 'Welcome back.' : 'Reset your password.'
  const submitLabel = mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Send reset link'

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <button className="icon-button auth-close" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <a className="brand auth-brand" href="/" onClick={(event) => { event.preventDefault(); onClose() }}>
          <BrandMark /><span>SOOUL</span>
        </a>
        <div className="eyebrow auth-eyebrow"><LockKeyhole size={14} /> YOUR PRIVATE SPACE</div>
        <h1>{heading}</h1>
        <p className="auth-intro">
          {mode === 'signup' ? 'Create a place for the things you want to keep and pass on.' : mode === 'signin' ? 'Continue building the story that matters.' : 'We will send you a secure link to choose a new password.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email address</label>
          <div className="auth-input-wrap"><Mail size={17} /><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>
          {mode !== 'reset' && <>
            <label htmlFor="auth-password">Password</label>
            <div className="auth-input-wrap"><LockKeyhole size={17} /><input id="auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div>
          </>}
          {mode === 'signup' && <>
            <label htmlFor="auth-confirm">Confirm password</label>
            <div className="auth-input-wrap"><LockKeyhole size={17} /><input id="auth-confirm" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></div>
          </>}
          {error && <p className="form-feedback form-error" role="alert">{error}</p>}
          {message && <p className="form-feedback form-success" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : submitLabel}<ArrowUpRight size={17} /></button>
        </form>

        <div className="auth-switches">
          {mode === 'signup' ? <span>Already have an account? <button type="button" onClick={() => changeMode('signin')}>Sign in</button></span>
            : mode === 'signin' ? <><span>New to SOOUL? <button type="button" onClick={() => changeMode('signup')}>Create an account</button></span><button type="button" onClick={() => changeMode('reset')}>Forgot password?</button></>
            : <button type="button" onClick={() => changeMode('signin')}><ArrowLeft size={14} /> Back to sign in</button>}
        </div>
        <p className="auth-footnote">Your story belongs to you. Always.</p>
      </div>
    </div>
  )
}

function MemberSpace({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <main className="member-shell">
      <header className="topbar">
        <a className="brand" href="/"><BrandMark /><span>SOOUL</span></a>
        <button className="signout-button" type="button" onClick={onSignOut}>Sign out</button>
      </header>
      <section className="member-welcome">
        <div className="eyebrow"><Sparkles size={15} /> YOUR PRIVATE SPACE</div>
        <h1>Welcome to your<br /><span>SOOUL.</span></h1>
        <p>You are signed in as <strong>{user.email}</strong>.</p>
        <div className="coming-card">
          <BrandMark large />
          <h2>Your legacy starts here.</h2>
          <p>Your private space is ready. We are building the tools to help you capture your stories, preserve your values and keep your wishes safe.</p>
          <span className="coming-label">STORIES · LEGACY · SAFEKEEPING</span>
        </div>
      </section>
    </main>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('signup')

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
  }

  if (user) return <MemberSpace user={user} onSignOut={signOut} />

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="SOOUL home">
          <BrandMark /><span>SOOUL</span>
        </a>
        <div className="topbar-actions">
          <span className="topbar-note">Your life. Your legacy.</span>
          <button className="signout-button" type="button" onClick={() => { setAuthMode('signin'); setAuthOpen(true) }}>Sign in</button>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy-block">
          <div className="eyebrow"><Sparkles size={15} /> A LEGACY THAT LIVES ON</div>
          <h1 id="hero-title">Your life.<br /><span>Your legacy.</span></h1>
          <p className="hero-copy">A thoughtful place for the stories, memories, values and wishes you want to preserve — and pass on beyond generations.</p>
          <button className="primary-link" type="button" onClick={() => { setAuthMode('signup'); setAuthOpen(true) }}>Begin your story <ArrowUpRight size={17} /></button>
        </div>
        <div className="hero-artwork" aria-label="SOOUL flower and infinity emblem">
          <div className="art-orbit art-orbit-outer" />
          <div className="art-orbit art-orbit-inner" />
          <div className="art-glow" />
          <BrandMark large />
          <div className="art-wordmark">SOOUL</div>
          <div className="art-tagline">YOUR LIFE · YOUR LEGACY · BEYOND GENERATIONS</div>
          <div className="art-rule"><span /></div>
        </div>
        <div className="hero-bottom-note">A living legacy, shaped by you.</div>
      </section>

      <section className="pillars" id="meaning" aria-labelledby="pillars-heading">
        <div className="section-heading">
          <span className="eyebrow">BUILT AROUND WHAT MATTERS</span>
          <h2 id="pillars-heading">Some things deserve to outlast us.</h2>
          <p>SOOUL is being built to help you keep them close and pass them forward.</p>
        </div>
        <div className="pillar-grid">
          {pillars.map(({ icon: Icon, title, description }, index) => (
            <article className="pillar-card" key={title}>
              <span className="pillar-index">0{index + 1}</span>
              <span className="pillar-icon"><Icon size={22} strokeWidth={1.7} /></span>
              <h3>{title}</h3><p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <a className="footer-brand" href="/">SOOUL<span>®</span></a>
        <span>© {new Date().getFullYear()} SOOUL. A legacy beyond generations.</span>
        <span className="connection"><span className={isSupabaseConfigured ? 'status-dot online' : 'status-dot'} />{isSupabaseConfigured ? 'Secure connection configured' : 'Backend configuration pending'}</span>
      </footer>
      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} onAuthenticated={(nextUser) => { setUser(nextUser); setAuthOpen(false) }} />}
    </main>
  )
}
