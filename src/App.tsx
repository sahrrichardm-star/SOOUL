import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowLeft, ArrowUpRight, BookHeart, BookOpen, CalendarDays, Heart, Infinity, LockKeyhole,
  Mail, Pencil, Plus, Search, ShieldCheck, Sparkles, Trash2, X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type AuthMode = 'signin' | 'signup' | 'reset' | 'update-password'
type StoryCategory = 'life' | 'family' | 'milestones' | 'lessons' | 'other'
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
      setError('SOOULL authentication is not configured yet. The Supabase project URL and publishable key must be added to Cloudflare environment variables.')
      return
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

        <form className="auth-form" onSubmit={handleSubmit}>
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

function MemberSpace({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [stories, setStories] = useState<Story[]>([])
  const [loadingStories, setLoadingStories] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<StoryCategory>('life')
  const [storyDate, setStoryDate] = useState('')

  async function loadStories() {
    if (!supabase) {
      setError('The Supabase connection is not configured. Check the Cloudflare build variables.')
      setLoadingStories(false)
      return
    }
    setLoadingStories(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('stories')
      .select('id,user_id,title,content,category,story_date,is_favorite,created_at,updated_at')
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else setStories((data ?? []) as Story[])
    setLoadingStories(false)
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
    const values = {
      title: title.trim(),
      content: content.trim(),
      category,
      story_date: storyDate || null,
    }
    const result = editingStory
      ? await supabase.from('stories').update(values).eq('id', editingStory.id).select().single()
      : await supabase.from('stories').insert({ ...values, user_id: user.id }).select().single()

    if (result.error) {
      setError(result.error.message)
    } else {
      const saved = result.data as Story
      setStories((current) => editingStory
        ? current.map((story) => story.id === saved.id ? saved : story)
        : [saved, ...current])
      setEditorOpen(false)
    }
    setSaving(false)
  }

  async function removeStory(story: Story) {
    if (!supabase || !window.confirm(`Delete “${story.title}”? This cannot be undone.`)) return
    const { error: deleteError } = await supabase.from('stories').delete().eq('id', story.id)
    if (deleteError) setError(deleteError.message)
    else setStories((current) => current.filter((item) => item.id !== story.id))
  }

  async function toggleFavorite(story: Story) {
    if (!supabase) return
    const nextValue = !story.is_favorite
    const { error: updateError } = await supabase.from('stories').update({ is_favorite: nextValue }).eq('id', story.id)
    if (updateError) setError(updateError.message)
    else setStories((current) => current.map((item) => item.id === story.id ? { ...item, is_favorite: nextValue } : item))
  }

  const visibleStories = stories.filter((story) =>
    `${story.title} ${story.content} ${story.category}`.toLowerCase().includes(search.toLowerCase()),
  )
  const displayName = user.email?.split('@')[0] ?? 'Member'

  return (
    <main className="member-shell">
      <header className="topbar member-topbar">
        <a className="brand" href="/"><BrandMark /><span>SOOULLL</span></a>
        <div className="member-top-actions">
          <span className="member-email">{user.email}</span>
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

      <footer className="dashboard-footer"><span>SOOULLL · YOUR LIFE. YOUR LEGACY.</span><span>Private by design.</span></footer>

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
            <textarea className="story-field story-content-field" id="story-content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Start wherever feels right…" rows={7} />
            {error && <p className="form-feedback form-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : editingStory ? 'Save changes' : 'Save story'}<ArrowUpRight size={17} /></button>
          </form>
        </section>
      </div>}
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

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
  }

  if (user) return <MemberSpace user={user} onSignOut={signOut} />

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
