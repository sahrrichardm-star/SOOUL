import { lazy, Suspense, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowLeft, ArrowUpRight, BookHeart, BookOpen, CalendarDays, Download, Heart, Infinity, LockKeyhole,
  Mail, Pencil, Plus, Search, Settings, ShieldCheck, Sparkles, Trash2, X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
const LegacyModule = lazy(() => import('./PrivateCollections').then(module => ({ default: module.LegacyModule })))
const SafekeepingModule = lazy(() => import('./PrivateCollections').then(module => ({ default: module.SafekeepingModule })))
const VaultModule = lazy(() => import('./VaultModule').then(module => ({ default: module.VaultModule })))
const PersonaModule = lazy(() => import('./PersonaModule').then(module => ({ default: module.PersonaModule })))

type AuthMode = 'signin' | 'signup' | 'reset' | 'update-password'
type StoryCategory = 'life' | 'family' | 'milestones' | 'lessons' | 'other'
function normalizeInternationalPhone(value: string) {
  return value.replace(/[\s().-]/g, '')
}

function isValidInternationalPhone(value: string) {
  return /^\\+[1-9]\\d{7,14}$/.test(value)
}

type Story = { id: string; user_id: string; title: string; content: string; category: StoryCategory; story_date: string | null; is_favorite: boolean; created_at: string; updated_at: string }

const pillars = [
  { icon: BookHeart, title: 'Stories', description: 'Preserve the moments, memories and lessons that make your life uniquely yours.' },
  { icon: Infinity, title: 'Legacy', description: 'Pass on the values, wishes and knowledge you want future generations to carry.' },
  { icon: ShieldCheck, title: 'Safekeeping', description: 'Keep what matters together, with privacy and control at the heart of the experience.' },
]

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? 'brand-art brand-art-large' : 'brand-art'} aria-hidden="true">
      <svg viewBox="0 0 200 200" role="presentation">
        <path d="M100 154 C65 127 64 86 100 38 C136 86 135 127 100 154Z" fill="#d99b35" stroke="#ffe19a" strokeWidth="2.2" />
        <path d="M91 153 C55 145 28 113 28 73 C67 79 91 111 100 154Z" fill="#0757b9" stroke="#63b8ff" strokeWidth="2.2" />
        <path d="M109 153 C145 145 172 113 172 73 C133 79 109 111 100 154Z" fill="#0757b9" stroke="#63b8ff" strokeWidth="2.2" />
        <path d="M100 155 C73 135 45 133 17 145 C45 177 74 177 100 155Z" fill="#d99b35" stroke="#ffe19a" strokeWidth="2.2" />
        <path d="M100 155 C127 135 155 133 183 145 C155 177 126 177 100 155Z" fill="#d99b35" stroke="#ffe19a" strokeWidth="2.2" />
        <path d="M38 111 C58 83 80 101 100 124 C120 147 142 163 162 133 C180 106 149 88 127 108 C111 123 88 148 72 137 C56 126 50 104 38 111Z" fill="none" stroke="#f2c66e" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M100 124 L100 181 M100 166 C82 152 69 157 61 170 M100 166 C118 152 131 157 139 170" fill="none" stroke="#dca64b" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="89" r="10" fill="#fff0b5" stroke="#e9b95e" strokeWidth="3" />
        <path d="M100 9V29 M94 19H106" stroke="#ffe29a" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="brand-art-core" />
    </span>
  )
}

function AuthPanel({ onClose, onAuthenticated, initialMode = 'signup' }: { onClose: () => void; onAuthenticated: (user: User) => void; initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [address, setAddress] = useState('')
  const [country, setCountry] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
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

  async function handleGoogleSignIn() {
    setError('')
    setMessage('')
    if (!supabase) {
      setError('SOOULL authentication is not configured. Check the Vercel environment variables.')
      return
    }
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (authError) {
      setError(authError.message)
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!supabase) {
      setError('SOOULL authentication is not configured yet. The Supabase project URL and publishable key must be added to Vercel environment variables.')
      return
    }
    if (mode === 'signup') {
      const normalizedPhone = phone.replace(/[\s().-]/g, '')
      if (!firstName.trim() || !lastName.trim() || !address.trim() || !country.trim() || !normalizedPhone || !dateOfBirth) {
        setError('Enter your first name, last name, residential address, country, phone number and date of birth.')
        return
      }
      if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
        setError('Enter your phone number in international format, including + and country calling code (for example, +232...).')
        return
      }
      if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
        setError('Date of birth cannot be in the future.')
        return
      }
    }
    if (mode !== 'reset' && password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if ((mode === 'signup' || mode === 'update-password') && password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              first_name: firstName.trim(),
              middle_name: middleName.trim(),
              last_name: lastName.trim(),
              full_name: [firstName, middleName, lastName].map((part) => part.trim()).filter(Boolean).join(' '),
              residential_address: address.trim(),
              country: country.trim(),
              phone: phone.replace(/[\s().-]/g, ''),
              date_of_birth: dateOfBirth,
            },
          },
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
      } else if (mode === 'reset') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (authError) throw authError
        setMessage('If an account exists for that email, a password reset link has been sent.')
      } else {
        const { data, error: authError } = await supabase.auth.updateUser({ password })
        if (authError) throw authError
        if (data.user) onAuthenticated(data.user)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const heading = mode === 'signup' ? 'Begin your legacy.' : mode === 'signin' ? 'Welcome back.' : mode === 'reset' ? 'Reset your password.' : 'Choose a new password.'
  const submitLabel = mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : 'Update password'

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <button className="icon-button auth-close" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <a className="brand auth-brand" href="/" onClick={(event) => { event.preventDefault(); onClose() }}>
          <BrandMark /><span>SOOULL</span>
        </a>
        <div className="eyebrow auth-eyebrow"><LockKeyhole size={14} /> YOUR PRIVATE SPACE</div>
        <h1>{heading}</h1>
        <p className="auth-intro">
          {mode === 'signup' ? 'Create a place for the things you want to keep and pass on.' : mode === 'signin' ? 'Continue building the story that matters.' : mode === 'reset' ? 'We will send you a secure link to choose a new password.' : 'Set a new password to secure your SOOULL account.'}
        </p>

        {mode !== 'reset' && mode !== 'update-password' && <div className="google-auth-section">
          <button className="auth-submit google-auth-button" type="button" onClick={() => void handleGoogleSignIn()} disabled={loading}>
            <svg viewBox="0 0 48 48" aria-hidden="true" width="18" height="18"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 18Z"/><path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>
            Continue with Google
          </button>
          <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>
        </div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && <>
            <div className="auth-name-grid">
              <div><label htmlFor="auth-first-name">First name</label><input className="story-field" id="auth-first-name" autoComplete="given-name" maxLength={80} required value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" /></div>
              <div><label htmlFor="auth-middle-name">Middle name <span className="optional-label">Optional</span></label><input className="story-field" id="auth-middle-name" autoComplete="additional-name" maxLength={80} value={middleName} onChange={(event) => setMiddleName(event.target.value)} placeholder="Middle name" /></div>
              <div><label htmlFor="auth-last-name">Last name</label><input className="story-field" id="auth-last-name" autoComplete="family-name" maxLength={80} required value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" /></div>
            </div>
            <label htmlFor="auth-address">Residential address</label>
            <input className="story-field" id="auth-address" autoComplete="street-address" maxLength={300} required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="House number, street, town/city" />
            <label htmlFor="auth-country">Country</label>
            <input className="story-field" id="auth-country" autoComplete="country-name" maxLength={100} required value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country of residence" />
            <label htmlFor="auth-phone">Phone number</label>
            <input className="story-field" id="auth-phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={24} required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+232XXXXXXXX" />
            <label htmlFor="auth-dob">Date of birth</label>
            <input className="story-field" id="auth-dob" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} required value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
          </>}
          {mode !== 'update-password' && <>
            <label htmlFor="auth-email">Email address</label>
            <div className="auth-input-wrap"><Mail size={17} /><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>
          </>}
          {mode !== 'reset' && <>
            <label htmlFor="auth-password">Password</label>
            <div className="auth-input-wrap"><LockKeyhole size={17} /><input id="auth-password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div>
          </>}
          {(mode === 'signup' || mode === 'update-password') && <>
            <label htmlFor="auth-confirm">Confirm password</label>
            <div className="auth-input-wrap"><LockKeyhole size={17} /><input id="auth-confirm" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></div>
          </>}
          {error && <p className="form-feedback form-error" role="alert">{error}</p>}
          {message && <p className="form-feedback form-success" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : submitLabel}<ArrowUpRight size={17} /></button>
        </form>

        <div className="auth-switches">
          {mode === 'signup' ? <span>Already have an account? <button type="button" onClick={() => changeMode('signin')}>Sign in</button></span>
            : mode === 'signin' ? <><span>New to SOOULL? <button type="button" onClick={() => changeMode('signup')}>Create an account</button></span><button type="button" onClick={() => changeMode('reset')}>Forgot password?</button></>
            : <button type="button" onClick={() => changeMode('signin')}><ArrowLeft size={14} /> Back to sign in</button>}
        </div>
        <p className="auth-footnote">Your story belongs to you. Always.</p>
      </div>
    </div>
  )
}

function ProfileCompletion({ user, onComplete, onSignOut }: { user: User; onComplete: (user: User) => void; onSignOut: () => void }) {
  const metadata = user.user_metadata ?? {}
  const googleName = String(metadata.full_name ?? metadata.name ?? '').trim().split(/\s+/).filter(Boolean)
  const [firstName, setFirstName] = useState(String(metadata.first_name ?? googleName[0] ?? ''))
  const [middleName, setMiddleName] = useState(String(metadata.middle_name ?? ''))
  const [lastName, setLastName] = useState(String(metadata.last_name ?? (googleName.length > 1 ? googleName.slice(1).join(' ') : '')))
  const [address, setAddress] = useState(String(metadata.residential_address ?? ''))
  const [country, setCountry] = useState(String(metadata.country ?? ''))
  const [phone, setPhone] = useState(String(metadata.phone ?? ''))
  const [dateOfBirth, setDateOfBirth] = useState(String(metadata.date_of_birth ?? ''))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('SOOULL is not connected to its secure database.'); setLoading(false); return }
      try {
        const { data, error: queryError } = await supabase.from('profiles')
          .select('first_name,middle_name,last_name,residential_address,country,phone,date_of_birth')
          .eq('id', user.id).maybeSingle()
        if (queryError) throw queryError
        if (!active) return
        if (data) {
          setFirstName(data.first_name || String(metadata.first_name ?? googleName[0] ?? ''))
          setMiddleName(data.middle_name || String(metadata.middle_name ?? ''))
          setLastName(data.last_name || String(metadata.last_name ?? (googleName.length > 1 ? googleName.slice(1).join(' ') : '')))
          setAddress(data.residential_address || String(metadata.residential_address ?? ''))
          setCountry(data.country || String(metadata.country ?? ''))
          setPhone(data.phone || String(metadata.phone ?? ''))
          setDateOfBirth(data.date_of_birth || String(metadata.date_of_birth ?? ''))
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to check your personal profile.')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [user.id])

  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || saving) return
    const normalizedPhone = phone.replace(/[\s().-]/g, '')
    if (!firstName.trim() || !lastName.trim() || !address.trim() || !country.trim() || !dateOfBirth) {
      setError('Complete every required field before continuing.')
      return
    }
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError('Enter your phone number in international format, including + and country calling code.')
      return
    }
    if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
      setError('Date of birth cannot be in the future.')
      return
    }
    setSaving(true); setError('')
    try {
      const profile = {
        id: user.id,
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        residential_address: address.trim(),
        country: country.trim(),
        phone: normalizedPhone,
        date_of_birth: dateOfBirth,
        updated_at: new Date().toISOString(),
      }
      const { error: profileError } = await supabase.from('profiles').upsert(profile)
      if (profileError) throw profileError
      // The private profiles row is the source of truth for profile completion.
      // Do not make successful saving depend on a second Auth metadata write.
      onComplete(user)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your personal details.')
    } finally { setSaving(false) }
  }

  if (loading) return <main className="auth-screen"><section className="auth-panel"><div className="loading-ring" /><h1>Preparing your account.</h1><p className="auth-intro">Checking your personal details…</p></section></main>

  return <main className="auth-screen"><section className="auth-panel profile-completion-panel">
    <div className="brand auth-brand"><BrandMark /><span>SOOULL</span></div>
    <div className="eyebrow auth-eyebrow"><ShieldCheck size={14} /> COMPLETE YOUR PROFILE</div>
    <h1>Let’s get to know you.</h1>
    <p className="auth-intro">Before entering your private space, complete these details. Your information is stored in your private profile.</p>
    <form className="auth-form" onSubmit={complete}>
      <div className="auth-name-grid">
        <div><label htmlFor="complete-first">First name</label><input className="story-field" id="complete-first" autoComplete="given-name" maxLength={80} required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></div>
        <div><label htmlFor="complete-middle">Middle name <span className="optional-label">Optional</span></label><input className="story-field" id="complete-middle" autoComplete="additional-name" maxLength={80} value={middleName} onChange={(event) => setMiddleName(event.target.value)} /></div>
        <div><label htmlFor="complete-last">Last name</label><input className="story-field" id="complete-last" autoComplete="family-name" maxLength={80} required value={lastName} onChange={(event) => setLastName(event.target.value)} /></div>
      </div>
      <label htmlFor="complete-address">Residential address</label><input className="story-field" id="complete-address" autoComplete="street-address" maxLength={300} required value={address} onChange={(event) => setAddress(event.target.value)} />
      <label htmlFor="complete-country">Country</label><input className="story-field" id="complete-country" autoComplete="country-name" maxLength={100} required value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country of residence" />
      <label htmlFor="complete-phone">Phone number (international format)</label><input className="story-field" id="complete-phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={24} required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+232XXXXXXXX" aria-describedby="complete-phone-help" /><p className="account-settings-note" id="complete-phone-help">Start with +, then your country calling code and full number. Examples: +232 (Sierra Leone), +1 (US/Canada), +44 (UK). Use the worldwide international format, not a local area code.</p>
      <label htmlFor="complete-dob">Date of birth</label><input className="story-field" id="complete-dob" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} required value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
      {error && <p className="form-feedback form-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save and continue'}<ArrowUpRight size={17} /></button>
    </form>
    <button className="account-secondary-button" type="button" onClick={onSignOut}>Sign out</button>
  </section></main>
}

function ProfileSettings({ user }: { user: User }) {
  const metadata = user.user_metadata ?? {}
  const [firstName, setFirstName] = useState(String(metadata.first_name ?? ''))
  const [middleName, setMiddleName] = useState(String(metadata.middle_name ?? ''))
  const [lastName, setLastName] = useState(String(metadata.last_name ?? ''))
  const [address, setAddress] = useState(String(metadata.residential_address ?? ''))
  const [country, setCountry] = useState(String(metadata.country ?? ''))
  const [phone, setPhone] = useState(String(metadata.phone ?? ''))
  const [dateOfBirth, setDateOfBirth] = useState(String(metadata.date_of_birth ?? ''))
  const [avatarPath, setAvatarPath] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const initials = [firstName, lastName].map((part) => part.trim().charAt(0)).filter(Boolean).join('').toUpperCase() || 'S'

  useEffect(() => {
    let active = true
    async function loadProfile() {
      if (!supabase) { setLoading(false); return }
      try {
        const { data, error: profileError } = await supabase.from('profiles').select('first_name,middle_name,last_name,residential_address,country,phone,date_of_birth,avatar_path').eq('id', user.id).maybeSingle()
        if (profileError) throw profileError
        if (!active || !data) return
        setFirstName(data.first_name || '')
        setMiddleName(data.middle_name || '')
        setLastName(data.last_name || '')
        setAddress(data.residential_address || '')
        setCountry(data.country || '')
        setPhone(data.phone || '')
        setDateOfBirth(data.date_of_birth || '')
        setAvatarPath(data.avatar_path || '')
        if (data.avatar_path) {
          const { data: signed, error: signedError } = await supabase.storage.from('private-assets').createSignedUrl(data.avatar_path, 3600)
          if (signedError) throw signedError
          if (active) setAvatarUrl(signed.signedUrl)
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load your profile.')
      } finally { if (active) setLoading(false) }
    }
    void loadProfile()
    return () => { active = false }
  }, [user.id])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || saving) return
    const normalizedPhone = phone.replace(/[\s().-]/g, '')
    if (!firstName.trim() || !lastName.trim() || !address.trim() || !country.trim() || !normalizedPhone || !dateOfBirth || dateOfBirth > new Date().toISOString().slice(0, 10)) {
      setError('Enter a valid name, address, country, phone number and date of birth.')
      return
    }
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError('Enter your phone number in international format, including + and country calling code.')
      return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      const profile = {
        id: user.id,
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        residential_address: address.trim(),
        country: country.trim(),
        phone: normalizedPhone,
        date_of_birth: dateOfBirth,
        avatar_path: avatarPath || null,
        updated_at: new Date().toISOString(),
      }
      const { error: saveError } = await supabase.from('profiles').upsert(profile)
      if (saveError) throw saveError
      const { error: metadataError } = await supabase.auth.updateUser({ data: {
        first_name: profile.first_name,
        middle_name: profile.middle_name,
        last_name: profile.last_name,
        full_name: [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' '),
        residential_address: profile.residential_address,
        country: profile.country,
        phone: profile.phone,
        date_of_birth: profile.date_of_birth,
      } })
      if (metadataError) throw metadataError
      setMessage('Your personal details have been updated.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your profile.')
    } finally { setSaving(false) }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !supabase) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Choose a JPG, PNG or WebP image up to 10 MB.')
      return
    }
    setError(''); setMessage('')
    try {
      const path = user.id + '/avatar/' + crypto.randomUUID() + '.' + (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg')
      const { data: uploaded, error: uploadError } = await supabase.storage.from('private-assets').upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError
      const { error: updateError } = await supabase.from('profiles').upsert({ id: user.id, avatar_path: uploaded.path, updated_at: new Date().toISOString() })
      if (updateError) {
        await supabase.storage.from('private-assets').remove([uploaded.path])
        throw updateError
      }
      if (avatarPath) await supabase.storage.from('private-assets').remove([avatarPath])
      const { data: signed, error: signedError } = await supabase.storage.from('private-assets').createSignedUrl(uploaded.path, 3600)
      if (signedError) throw signedError
      setAvatarPath(uploaded.path)
      setAvatarUrl(signed.signedUrl)
      setMessage('Profile photo updated.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload your profile photo.')
    }
  }

  return <section className="account-profile-card">
    <div className="collection-heading"><div><span className="eyebrow">YOUR IDENTITY</span><h2>Personal profile</h2><p>Keep your name and personal details accurate. Your profile photo is stored privately.</p></div></div>
    <div className="profile-avatar-row">
      {avatarUrl ? <img className="profile-avatar" src={avatarUrl} alt="Your profile" /> : <div className="profile-avatar profile-avatar-initials" aria-label="Profile initials">{initials}</div>}
      <label className="account-secondary-button profile-avatar-upload">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadAvatar(event)} /></label>
    </div>
    {loading ? <p className="account-settings-note">Loading personal details…</p> : <form className="vault-wallet-form profile-form" onSubmit={saveProfile}>
      <label>First name<input className="story-field" maxLength={80} required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
      <label>Middle name <span className="optional-label">Optional</span><input className="story-field" maxLength={80} value={middleName} onChange={(event) => setMiddleName(event.target.value)} /></label>
      <label>Last name<input className="story-field" maxLength={80} required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
      <label>Residential address<input className="story-field" maxLength={300} required value={address} onChange={(event) => setAddress(event.target.value)} /></label>
      <label>Country<input className="story-field" maxLength={100} required value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country of residence" /></label>
      <label>Phone number<input className="story-field" type="tel" autoComplete="tel" inputMode="tel" maxLength={24} required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+232XXXXXXXX" /></label>
      <label>Date of birth<input className="story-field" type="date" max={new Date().toISOString().slice(0, 10)} required value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></label>
      <p className="account-settings-note">Your date of birth, address, country and phone number are private account details. Only your authenticated account can access this profile.</p>
      {error && <p className="form-feedback form-error" role="alert">{error}</p>}
      {message && <p className="form-feedback form-success" role="status">{message}</p>}
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save personal profile'}</button>
    </form>}
  </section>
}

function AccountSettings({ user }: { user: User }) {
  const [email, setEmail] = useState(user.email ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [mfaFactors, setMfaFactors] = useState<Array<{ id: string; friendly_name?: string; status: string }>>([])
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaBusy, setMfaBusy] = useState(false)
  const [mfaError, setMfaError] = useState('')
  const [mfaMessage, setMfaMessage] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaQr, setMfaQr] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaCode, setMfaCode] = useState('')

  useEffect(() => {
    let active = true
    async function loadMfaFactors() {
      if (!supabase) { setMfaLoading(false); return }
      try {
        const { data, error } = await supabase.auth.mfa.listFactors()
        if (error) throw error
        if (active) setMfaFactors(data.totp.map((factor) => ({ id: factor.id, friendly_name: factor.friendly_name, status: factor.status })))
      } catch (caught) {
        if (active) setMfaError(caught instanceof Error ? caught.message : 'Unable to load authenticator settings.')
      } finally {
        if (active) setMfaLoading(false)
      }
    }
    void loadMfaFactors()
    return () => { active = false }
  }, [])

  async function beginMfaEnrollment() {
    if (!supabase || mfaBusy) return
    setMfaBusy(true); setMfaError(''); setMfaMessage('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'SOOULL authenticator' })
      if (error) throw error
      setMfaFactorId(data.id)
      setMfaQr(data.totp.qr_code)
      setMfaSecret(data.totp.secret)
      setMfaCode('')
    } catch (caught) {
      setMfaError(caught instanceof Error ? caught.message : 'Unable to start authenticator setup.')
    } finally { setMfaBusy(false) }
  }

  async function verifyMfaEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !mfaFactorId || mfaBusy) return
    setMfaBusy(true); setMfaError(''); setMfaMessage('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode.trim() })
      if (verifyError) throw verifyError
      setMfaFactorId(''); setMfaQr(''); setMfaSecret(''); setMfaCode('')
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      setMfaFactors(data.totp.map((factor) => ({ id: factor.id, friendly_name: factor.friendly_name, status: factor.status })))
      setMfaMessage('Authenticator verification complete. Two-factor authentication is now enabled for this account. Other active sessions may need to sign in again.')
    } catch (caught) {
      setMfaError(caught instanceof Error ? caught.message : 'Authenticator verification failed. Check the code and try again.')
    } finally { setMfaBusy(false) }
  }

  async function cancelMfaEnrollment() {
    if (!supabase || !mfaFactorId || mfaBusy) { setMfaFactorId(''); setMfaQr(''); setMfaSecret(''); return }
    setMfaBusy(true)
    try { await supabase.auth.mfa.unenroll({ factorId: mfaFactorId }) } catch { /* Unverified factors may be removed automatically by Supabase. */ }
    setMfaFactorId(''); setMfaQr(''); setMfaSecret(''); setMfaCode('')
    setMfaBusy(false)
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || emailLoading) return
    const nextEmail = email.trim().toLowerCase()
    setEmailError('')
    setEmailMessage('')
    if (!nextEmail || nextEmail === (user.email ?? '').toLowerCase()) {
      setEmailError('Enter a different email address.')
      return
    }
    setEmailLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: nextEmail })
      if (updateError) throw updateError
      setEmailMessage('Email change requested. Follow the confirmation instructions sent by Supabase before the new address becomes active.')
    } catch (caught) {
      setEmailError(caught instanceof Error ? caught.message : 'Unable to update your email. Please try again.')
    } finally {
      setEmailLoading(false)
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || passwordLoading) return
    setPasswordError('')
    setPasswordMessage('')
    if (newPassword.length < 8) {
      setPasswordError('Use a password with at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Your passwords do not match.')
      return
    }
    setPasswordLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Your password has been updated.')
    } catch (caught) {
      setPasswordError(caught instanceof Error ? caught.message : 'Unable to update your password. Please try again.')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <section className="collection-section account-settings">
      <ProfileSettings user={user} />
      <div className="collection-heading">
        <div><span className="eyebrow">MEMBER PROFILE</span><h2>Account settings</h2><p>Manage the email address and password used to access your SOOULL account.</p></div>
      </div>
      <section className="account-mfa-card">
        <div className="account-settings-icon"><ShieldCheck size={19} /></div>
        <h3>Two-factor authentication</h3>
        <p>Add an authenticator app as a second verification step when signing in. Compatible apps include Google Authenticator, Microsoft Authenticator and 1Password.</p>
        {mfaLoading ? <p className="account-settings-note">Checking authenticator status…</p> : <>
          {mfaFactors.filter((factor) => factor.status === 'verified').length > 0
            ? <p className="form-feedback form-success" role="status">Authenticator protection is enabled.</p>
            : <p className="account-settings-note">Authenticator protection is currently not enabled.</p>}
          {mfaFactors.filter((factor) => factor.status === 'verified').map((factor) => <div className="mfa-factor-row" key={factor.id}><span>{factor.friendly_name || 'Authenticator app'} · Active</span><button type="button" className="account-delete-button" disabled={mfaBusy} onClick={async () => {
            if (!supabase || mfaBusy || !window.confirm('Remove this authenticator? Your account will no longer require this second factor.')) return
            setMfaBusy(true); setMfaError(''); setMfaMessage('')
            try {
              const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
              if (error) throw error
              const { data, error: listError } = await supabase.auth.mfa.listFactors()
              if (listError) throw listError
              setMfaFactors(data.totp.map((item) => ({ id: item.id, friendly_name: item.friendly_name, status: item.status })))
              setMfaMessage('Authenticator removed.')
            } catch (caught) { setMfaError(caught instanceof Error ? caught.message : 'Unable to remove authenticator.') }
            finally { setMfaBusy(false) }
          }}>Remove authenticator</button></div>)}
          {mfaFactorId ? <form className="mfa-enrollment" onSubmit={verifyMfaEnrollment}>
            <p>1. Scan this QR code using your authenticator app. If scanning is unavailable, enter the setup key manually.</p>
            {mfaQr && <img className="mfa-qr" src={mfaQr.startsWith('data:') ? mfaQr : `data:image/svg+xml;utf8,${encodeURIComponent(mfaQr)}`} alt="Authenticator setup QR code" />}
            <label htmlFor="mfa-secret">Manual setup key</label><input id="mfa-secret" className="story-field" readOnly value={mfaSecret} onFocus={(event) => event.currentTarget.select()} />
            <label htmlFor="mfa-enrol-code">2. Enter the six-digit code from your app</label><input id="mfa-enrol-code" className="story-field" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\\D/g, '').slice(0, 6))} />
            <button className="dashboard-primary" type="submit" disabled={mfaBusy || mfaCode.length !== 6}>{mfaBusy ? 'Verifying…' : 'Verify and enable'}</button>
            <button className="account-secondary-button" type="button" disabled={mfaBusy} onClick={() => void cancelMfaEnrollment()}>Cancel setup</button>
          </form> : mfaFactors.some((factor) => factor.status === 'verified') ? null : <button className="dashboard-primary" type="button" disabled={mfaBusy} onClick={() => void beginMfaEnrollment()}>{mfaBusy ? 'Preparing…' : 'Set up authenticator'}</button>}
        </>}
        {mfaError && <p className="form-feedback form-error" role="alert">{mfaError}</p>}
        {mfaMessage && <p className="form-feedback form-success" role="status">{mfaMessage}</p>}
        <p className="account-settings-note">Keep access to your authenticator app. Supabase currently supports TOTP factors; SOOULL does not yet provide recovery codes.</p>
      </section>
      <div className="account-settings-grid">
        <form className="account-settings-card" onSubmit={updateEmail}>
          <div className="account-settings-icon"><Mail size={19} /></div>
          <h3>Email address</h3>
          <p>Current address: <strong>{user.email ?? 'Not available'}</strong></p>
          <label htmlFor="account-new-email">New email address</label>
          <input className="story-field" id="account-new-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          {emailError && <p className="form-feedback form-error" role="alert">{emailError}</p>}
          {emailMessage && <p className="form-feedback form-success" role="status">{emailMessage}</p>}
          <button className="dashboard-primary" type="submit" disabled={emailLoading}>{emailLoading ? 'Sending…' : 'Request email change'}</button>
          <p className="account-settings-note">Supabase may require confirmation from your current and new email addresses.</p>
        </form>
        <form className="account-settings-card" onSubmit={updatePassword}>
          <div className="account-settings-icon"><LockKeyhole size={19} /></div>
          <h3>Password</h3>
          <p>Use a unique password that you do not reuse on other services.</p>
          <label htmlFor="account-new-password">New password</label>
          <input className="story-field" id="account-new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" />
          <label htmlFor="account-confirm-password">Confirm new password</label>
          <input className="story-field" id="account-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" />
          {passwordError && <p className="form-feedback form-error" role="alert">{passwordError}</p>}
          {passwordMessage && <p className="form-feedback form-success" role="status">{passwordMessage}</p>}
          <button className="dashboard-primary" type="submit" disabled={passwordLoading}>{passwordLoading ? 'Updating…' : 'Update password'}</button>
          <p className="account-settings-note">If your security settings require recent authentication, sign out and sign in again before retrying.</p>
        </form>
      </div>
      <section className="account-danger-zone">
        <div><span className="eyebrow">PERMANENT ACTION</span><h3>Delete your SOOULL account</h3><p>This permanently removes your account and its associated stories, legacy entries and safekeeping records. This cannot be undone. Export your data first if you want to keep a copy.</p></div>
        <label htmlFor="delete-account-confirmation">Type DELETE to confirm</label>
        <input className="story-field" id="delete-account-confirmation" value={deleteConfirmation} onChange={(event) => { setDeleteConfirmation(event.target.value); setDeleteError('') }} autoComplete="off" />
        {deleteError && <p className="form-feedback form-error" role="alert">{deleteError}</p>}
        <button className="account-delete-button" type="button" disabled={deleteLoading || deleteConfirmation !== 'DELETE'} onClick={async () => {
          if (!supabase || deleteLoading || deleteConfirmation !== 'DELETE') return
          const confirmed = window.confirm('Permanently delete your SOOULL account and all associated data? This cannot be undone.')
          if (!confirmed) return
          setDeleteLoading(true)
          setDeleteError('')
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            if (sessionError) throw sessionError
            if (!session) throw new Error('Your session has expired. Sign in again.')
            const { data, error: functionError } = await supabase.functions.invoke('delete-account', {
              body: { confirmation: 'DELETE' },
            })
            if (functionError) throw functionError
            if (data?.error) throw new Error(data.error)
            await supabase.auth.signOut()
            window.location.assign('/')
          } catch (caught) {
            setDeleteError(caught instanceof Error ? caught.message : 'Account deletion failed. Please try again.')
            setDeleteLoading(false)
          }
        }}>{deleteLoading ? 'Deleting account…' : 'Permanently delete account'}</button>
        <p className="account-settings-note">For security, deletion requires a session refreshed by signing in within the last 10 minutes. Your data is not deleted if this check fails.</p>
      </section>
    </section>
  )
}


function MfaChallenge({ onVerified, onSignOut }: { onVerified: () => void; onSignOut: () => void }) {
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    async function loadFactor() {
      if (!supabase) return
      const { data, error: factorError } = await supabase.auth.mfa.listFactors()
      if (factorError) { if (active) setError(factorError.message); return }
      const factor = data.totp.find((item) => item.status === 'verified')
      if (active && factor) setFactorId(factor.id)
      else if (active) setError('No verified authenticator was found. Contact support to recover account access.')
    }
    void loadFactor()
    return () => { active = false }
  }, [])

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !factorId || loading) return
    setLoading(true); setError('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() })
      if (verifyError) throw verifyError
      onVerified()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The verification code was not accepted.') }
    finally { setLoading(false) }
  }

  return <main className="auth-screen"><section className="auth-panel">
    <div className="eyebrow"><ShieldCheck size={14} /> ACCOUNT SECURITY</div>
    <h1>Verify it’s you.</h1>
    <p className="auth-intro">Enter the current six-digit code from your authenticator app to continue to SOOULL.</p>
    <form className="auth-form" onSubmit={verify}>
      <label htmlFor="mfa-login-code">Authenticator code</label>
      <input id="mfa-login-code" className="story-field" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\\D/g, '').slice(0, 6))} />
      {error && <p className="form-feedback form-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={loading || !factorId || code.length !== 6}>{loading ? 'Verifying…' : 'Verify and continue'}<ArrowUpRight size={17} /></button>
    </form>
    <div className="auth-switches"><button type="button" onClick={onSignOut}>Sign out</button></div>
  </section></main>
}

function MemberSpace({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [stories, setStories] = useState<Story[]>([])
  const [activeSection, setActiveSection] = useState<'stories' | 'legacy' | 'safekeeping' | 'vault' | 'persona' | 'account'>('stories')
  const [loadingStories, setLoadingStories] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<StoryCategory>('life')
  const [storyDate, setStoryDate] = useState('')

  async function exportMyData() {
    if (!supabase || exporting) return
    setExporting(true)
    setError('')
    try {
      const [storyResult, legacyResult, safeResult, assetResult, walletResult, profileResult] = await Promise.all([
        supabase.from('stories').select('id,title,content,category,story_date,is_favorite,created_at,updated_at').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('legacy_entries').select('id,title,content,entry_type,recipient,is_featured,created_at,updated_at').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('safekeeping_records').select('id,title,record_type,institution,notes,review_date,created_at,updated_at').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('assets').select('id,title,asset_type,mime_type,file_size_bytes,created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('wallet_records').select('id,title,record_type,institution,account_label,account_last_four,notes,created_at,updated_at').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('profiles').select('first_name,middle_name,last_name,residential_address,country,phone,date_of_birth,created_at,updated_at').eq('id', user.id).maybeSingle(),
      ])
      const failed = storyResult.error || legacyResult.error || safeResult.error || assetResult.error || walletResult.error || profileResult.error
      if (failed) throw failed
      const backup = {
        application: 'SOOULL',
        format_version: 1,
        exported_at: new Date().toISOString(),
        account: { email: user.email ?? null, profile: profileResult.data ?? null },
        collections: {
          stories: storyResult.data ?? [],
          legacy: legacyResult.data ?? [],
          safekeeping: safeResult.data ?? [],
          assets: assetResult.data ?? [],
          wallet: walletResult.data ?? [],
        },
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sooull-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Your backup could not be created. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  async function loadStories() {
    if (!supabase) {
      setError('The Supabase connection is not configured. Check the Vercel build variables.')
      setLoadingStories(false)
      return
    }
    setLoadingStories(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase
        .from('stories')
        .select('id,user_id,title,content,category,story_date,is_favorite,created_at,updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (queryError) throw queryError
      setStories((data ?? []) as Story[])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your stories. Please try again.')
    } finally {
      setLoadingStories(false)
    }
  }

  useEffect(() => { void loadStories() }, [])

  function openNewStory() {
    setEditingStory(null)
    setTitle('')
    setContent('')
    setCategory('life')
    setStoryDate('')
    setError('')
    setEditorOpen(true)
  }

  function openEditStory(story: Story) {
    setEditingStory(story)
    setTitle(story.title)
    setContent(story.content)
    setCategory(story.category)
    setStoryDate(story.story_date ?? '')
    setError('')
    setEditorOpen(true)
  }

  async function saveStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setSaving(true)
    setError('')
    try {
      const values = {
        title: title.trim(),
        content: content.trim(),
        category,
        story_date: storyDate || null,
      }
      const result = editingStory
        ? await supabase.from('stories').update(values).eq('id', editingStory.id).eq('user_id', user.id).select().single()
        : await supabase.from('stories').insert({ ...values, user_id: user.id }).select().single()
      if (result.error) throw result.error
      const saved = result.data as Story
      setStories((current) => editingStory
        ? current.map((story) => story.id === saved.id ? saved : story)
        : [saved, ...current])
      setEditorOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your story. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function removeStory(story: Story) {
    if (!supabase || !window.confirm(`Delete “${story.title}”? This cannot be undone.`)) return
    setError('')
    try {
      const { error: deleteError } = await supabase.from('stories').delete().eq('id', story.id).eq('user_id', user.id)
      if (deleteError) throw deleteError
      setStories((current) => current.filter((item) => item.id !== story.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this story. Please try again.')
    }
  }

  async function toggleFavorite(story: Story) {
    if (!supabase) return
    const nextValue = !story.is_favorite
    setError('')
    try {
      const { error: updateError } = await supabase.from('stories').update({ is_favorite: nextValue }).eq('id', story.id).eq('user_id', user.id)
      if (updateError) throw updateError
      setStories((current) => current.map((item) => item.id === story.id ? { ...item, is_favorite: nextValue } : item))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update this favourite. Please try again.')
    }
  }

  const visibleStories = stories.filter((story) =>
    `${story.title} ${story.content} ${story.category}`.toLowerCase().includes(search.toLowerCase()),
  )
  const metadata = user.user_metadata ?? {}
  const displayName = [metadata.first_name, metadata.middle_name, metadata.last_name].filter((part) => typeof part === 'string' && part.trim()).join(' ')
    || (typeof metadata.full_name === 'string' ? metadata.full_name : '')
    || 'Member'

  return (
    <main className="member-shell">
      <header className="topbar member-topbar">
        <a className="brand" href="/"><BrandMark /><span>SOOULL</span></a>
        <div className="member-top-actions">
          <span className="member-email">{user.email}</span>
          <button className="member-export-button" type="button" onClick={() => void exportMyData()} disabled={exporting} title="Download a backup of all your SOOULL entries"><Download size={15} /> {exporting ? 'Preparing…' : 'Export data'}</button>
          <button className="signout-button" type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <section className="dashboard-heading">
        <div>
          <div className="eyebrow"><Sparkles size={14} /> YOUR PRIVATE SPACE</div>
          <h1>Welcome back, <span>{displayName}.</span></h1>
          <p>Your stories are yours to keep. Add a memory whenever you're ready.</p>
        </div>
        <button className="dashboard-primary" type="button" onClick={openNewStory}><Plus size={17} /> Write a story</button>
      </section>

      {error && activeSection !== 'stories' && <p className="form-feedback form-error" role="alert">{error}</p>}
      <nav className="member-nav" aria-label="Your SOOULL collections">
        <button type="button" className={activeSection === 'stories' ? 'active' : ''} onClick={() => setActiveSection('stories')}><BookOpen size={16} /> Stories</button>
        <button type="button" className={activeSection === 'legacy' ? 'active' : ''} onClick={() => setActiveSection('legacy')}><Infinity size={16} /> Legacy</button>
        <button type="button" className={activeSection === 'safekeeping' ? 'active' : ''} onClick={() => setActiveSection('safekeeping')}><ShieldCheck size={16} /> Safekeeping</button>
        <button type="button" className={activeSection === 'vault' ? 'active' : ''} onClick={() => setActiveSection('vault')}><LockKeyhole size={16} /> Assets & Wallet</button>
        <button type="button" className={activeSection === 'persona' ? 'active' : ''} onClick={() => setActiveSection('persona')}><Sparkles size={16} /> AI Legacy</button>
        <button type="button" className={activeSection === 'account' ? 'active' : ''} onClick={() => setActiveSection('account')}><Settings size={16} /> Account</button>
      </nav>

      {activeSection === 'stories' && <>
      <section className="dashboard-stats" aria-label="Your story summary">
        <div className="dashboard-stat"><span className="stat-icon"><BookOpen size={18} /></span><strong>{stories.length}</strong><span>Stories saved</span></div>
        <div className="dashboard-stat"><span className="stat-icon"><Heart size={18} /></span><strong>{stories.filter((story) => story.is_favorite).length}</strong><span>Favourites</span></div>
        <div className="dashboard-stat"><span className="stat-icon"><CalendarDays size={18} /></span><strong>{stories.filter((story) => story.story_date).length}</strong><span>Dated memories</span></div>
      </section>

      <section className="stories-section">
        <div className="stories-toolbar">
          <div><span className="eyebrow">YOUR COLLECTION</span><h2>Life stories</h2></div>
          <label className="story-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your stories" /></label>
        </div>

        {error && <p className="form-feedback form-error" role="alert">{error}</p>}

        {loadingStories ? <div className="stories-empty"><span className="loading-ring" />Loading your stories…</div>
          : visibleStories.length === 0 ? <div className="stories-empty">
              <span className="empty-icon"><BookHeart size={25} /></span>
              <h3>{search ? 'No matching stories.' : 'Your story collection starts here.'}</h3>
              <p>{search ? 'Try another word or clear your search.' : 'Capture a moment, a lesson, a person or a memory you never want to lose.'}</p>
              {!search && <button className="dashboard-primary" type="button" onClick={openNewStory}><Plus size={16} /> Write your first story</button>}
            </div>
          : <div className="story-grid">{visibleStories.map((story) => (
              <article className="story-card" key={story.id}>
                <div className="story-card-top"><span className="story-category">{story.category}</span><button className={story.is_favorite ? 'favorite-button active' : 'favorite-button'} type="button" onClick={() => void toggleFavorite(story)} aria-label={story.is_favorite ? 'Remove from favourites' : 'Add to favourites'}><Heart size={17} fill={story.is_favorite ? 'currentColor' : 'none'} /></button></div>
                <h3>{story.title}</h3>
                <p>{story.content || 'A story saved for another day. Add the details whenever you are ready.'}</p>
                <div className="story-card-bottom"><span>{story.story_date ? new Date(`${story.story_date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : new Date(story.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span><div><button type="button" onClick={() => openEditStory(story)} aria-label={`Edit ${story.title}`}><Pencil size={15} /></button><button type="button" onClick={() => void removeStory(story)} aria-label={`Delete ${story.title}`}><Trash2 size={15} /></button></div></div>
              </article>
            ))}</div>}
      </section>

      </>}
      {activeSection === 'legacy' && <Suspense fallback={<section className="stories-empty">Loading legacy records…</section>}><LegacyModule userId={user.id} /></Suspense>}
      {activeSection === 'safekeeping' && <Suspense fallback={<section className="stories-empty">Loading safekeeping…</section>}><SafekeepingModule userId={user.id} /></Suspense>}
      {activeSection === 'vault' && <Suspense fallback={<section className="stories-empty">Loading assets and wallet…</section>}><VaultModule userId={user.id} /></Suspense>}
      {activeSection === 'persona' && <Suspense fallback={<section className="stories-empty">Loading AI legacy…</section>}><PersonaModule userId={user.id} /></Suspense>}
      {activeSection === 'account' && <AccountSettings user={user} />}

      <footer className="dashboard-footer"><span>SOOULL · YOUR LIFE. YOUR LEGACY.</span><span>Private by design.</span></footer>

      {editorOpen && <div className="auth-screen story-editor-screen" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false) }}>
        <section className="auth-panel story-editor" role="dialog" aria-modal="true" aria-labelledby="story-editor-title">
          <button className="icon-button auth-close" type="button" onClick={() => setEditorOpen(false)} aria-label="Close"><X size={19} /></button>
          <div className="eyebrow"><BookHeart size={14} /> PRESERVE A MEMORY</div>
          <h2 id="story-editor-title">{editingStory ? 'Edit your story.' : 'A story worth keeping.'}</h2>
          <p className="auth-intro">Write in your own words. You can return and change this whenever you wish.</p>
          <form className="auth-form" onSubmit={saveStory}>
            <label htmlFor="story-title">Story title</label>
            <input className="story-field" id="story-title" maxLength={160} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Give this memory a name" />
            <label htmlFor="story-category">Category</label>
            <select className="story-field" id="story-category" value={category} onChange={(event) => setCategory(event.target.value as StoryCategory)}>
              <option value="life">Life</option><option value="family">Family</option><option value="milestones">Milestones</option><option value="lessons">Lessons</option><option value="other">Other</option>
            </select>
            <label htmlFor="story-date">When did it happen? <span className="optional-label">Optional</span></label>
            <input className="story-field" id="story-date" type="date" value={storyDate} onChange={(event) => setStoryDate(event.target.value)} />
            <label htmlFor="story-content">Your story</label>
            <textarea className="story-field story-content-field" id="story-content" maxLength={20000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Start wherever feels right…" rows={7} />
            {error && <p className="form-feedback form-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : editingStory ? 'Save changes' : 'Save story'}<ArrowUpRight size={17} /></button>
          </form>
        </section>
      </div>}
    </main>
  )
}

function ProfileGate({ user, onComplete, onSignOut }: { user: User; onComplete: (user: User) => void; onSignOut: () => void }) {
  const [complete, setComplete] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    async function check() {
      if (!supabase) { if (active) setComplete(false); return }
      const { data, error } = await supabase.from('profiles')
        .select('first_name,last_name,residential_address,country,phone,date_of_birth')
        .eq('id', user.id).maybeSingle()
      if (!active) return
      setComplete(!error && Boolean(data?.first_name?.trim() && data?.last_name?.trim() && data?.residential_address?.trim() && data?.country?.trim() && data?.phone?.trim() && data?.date_of_birth))
    }
    void check()
    return () => { active = false }
  }, [user.id])
  if (complete === null) return <main className="auth-screen"><section className="auth-panel"><div className="loading-ring" /><h1>Preparing your account.</h1><p className="auth-intro">Checking your personal details…</p></section></main>
  if (!complete) return <ProfileCompletion user={user} onComplete={(updated) => { onComplete(updated); setComplete(true) }} onSignOut={onSignOut} />
  return <MemberSpace user={user} onSignOut={onSignOut} />
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [mfaState, setMfaState] = useState<'checking' | 'required' | 'clear' | 'error'>('checking')
  const [mfaCheckAttempt, setMfaCheckAttempt] = useState(0)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('signup')

  useEffect(() => {
    if (!supabase) { setMfaState('clear'); return }
    let active = true
    let recoveringPassword = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') {
        recoveringPassword = true
        setUser(null)
        setAuthMode('update-password')
        setAuthOpen(true)
        return
      }
      setUser(session?.user ?? null)
    })
    supabase.auth.getUser().then(({ data }) => {
      if (active && !recoveringPassword) setUser(data.user)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    async function checkMfa() {
      if (!user || !supabase) { setMfaState('clear'); return }
      setMfaState('checking')
      try {
        const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ])
        if (assuranceError) throw assuranceError
        if (factorsError) throw factorsError
        const verifiedTotp = factors.totp.some((factor) => factor.status === 'verified')
        if (active) setMfaState(verifiedTotp && assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2' ? 'required' : 'clear')
      } catch {
        // Fail closed: never grant member access when the MFA status cannot be verified.
        if (active) setMfaState('error')
      }
    }
    void checkMfa()
    return () => { active = false }
  }, [user?.id, mfaCheckAttempt])


  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
  }

  if (user && mfaState === 'checking') return <main className="auth-screen"><section className="auth-panel"><div className="loading-ring" /><h1>Securing your session.</h1><p className="auth-intro">Checking your account protection…</p></section></main>
  if (user && mfaState === 'required') return <MfaChallenge onVerified={() => setMfaState('clear')} onSignOut={signOut} />
  if (user && mfaState === 'error') return <main className="auth-screen"><section className="auth-panel"><div className="eyebrow"><ShieldCheck size={14} /> ACCOUNT SECURITY</div><h1>Security check unavailable.</h1><p className="auth-intro">SOOULL could not verify your authenticator status. Member data remains locked until this check succeeds. Check your connection and try again.</p><button className="auth-submit" type="button" onClick={() => setMfaCheckAttempt((attempt) => attempt + 1)}>Retry security check</button><button className="account-secondary-button" type="button" onClick={() => void signOut()}>Sign out</button></section></main>
  if (user) return <ProfileGate user={user} onComplete={setUser} onSignOut={signOut} />;

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="SOOULL home">
          <BrandMark /><span>SOOULL</span>
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
        <div className="hero-artwork" aria-label="SOOULL flower and infinity emblem">
          <div className="art-orbit art-orbit-outer" />
          <div className="art-orbit art-orbit-inner" />
          <div className="art-glow" />
          <BrandMark large />
          <div className="art-wordmark">SOOULL</div>
          <div className="art-tagline">YOUR LIFE · YOUR LEGACY · BEYOND GENERATIONS</div>
          <div className="art-rule"><span /></div>
        </div>
        <div className="hero-bottom-note">A living legacy, shaped by you.</div>
      </section>

      <section className="pillars" id="meaning" aria-labelledby="pillars-heading">
        <div className="section-heading">
          <span className="eyebrow">BUILT AROUND WHAT MATTERS</span>
          <h2 id="pillars-heading">Some things deserve to outlast us.</h2>
          <p>SOOULL is being built to help you keep them close and pass them forward.</p>
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
        <a className="footer-brand" href="/">SOOULL<span>®</span></a>
        <span>© {new Date().getFullYear()} SOOULL. A legacy beyond generations.</span>
        <span className="connection"><span className={isSupabaseConfigured ? 'status-dot online' : 'status-dot'} />{isSupabaseConfigured ? 'Secure connection configured' : 'Backend configuration pending'}</span>
      </footer>
      {authOpen && <AuthPanel initialMode={authMode} onClose={() => setAuthOpen(false)} onAuthenticated={(nextUser) => { setUser(nextUser); setAuthOpen(false) }} />}
    </main>
  )
}
