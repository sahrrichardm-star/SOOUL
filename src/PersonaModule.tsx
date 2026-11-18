import { useEffect, useState, type FormEvent } from 'react'
import { BrainCircuit, CheckCircle2, LockKeyhole, Save } from 'lucide-react'
import { supabase } from './lib/supabase'

type Source = { id: string; title: string; source_type: 'story' | 'legacy_entry' }
type ChatMessage = { role: 'user' | 'assistant'; content: string; sources?: { id: string; type: string; title: string }[] }

export function PersonaModule({ userId }: { userId: string }) {
  const [name, setName] = useState('')
  const [biography, setBiography] = useState('')
  const [style, setStyle] = useState('warm and thoughtful')
  const [sources, setSources] = useState<Source[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [consented, setConsented] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatPrompt, setChatPrompt] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [chatBusy, setChatBusy] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) return
      setLoading(true)
      setError('')
      try {
        const [profile, stories, legacy, approvals, consent] = await Promise.all([
          supabase.from('persona_profiles').select('display_name,biography,response_style,is_enabled').eq('user_id', userId).maybeSingle(),
          supabase.from('stories').select('id,title').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('legacy_entries').select('id,title').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('persona_sources').select('source_type,source_id').eq('user_id', userId).eq('is_enabled', true),
          supabase.from('persona_consents').select('id').eq('user_id', userId).eq('consent_type', 'text_persona').is('revoked_at', null).limit(1),
        ])
        const failed = profile.error || stories.error || legacy.error || approvals.error || consent.error
        if (failed) throw failed
        if (!active) return
        setName(profile.data?.display_name ?? '')
        setBiography(profile.data?.biography ?? '')
        setStyle(profile.data?.response_style ?? 'warm and thoughtful')
        setEnabled(profile.data?.is_enabled ?? false)
        setSources([
          ...(stories.data ?? []).map(item => ({ ...item, source_type: 'story' as const })),
          ...(legacy.data ?? []).map(item => ({ ...item, source_type: 'legacy_entry' as const })),
        ])
        setSelected((approvals.data ?? []).map(item => item.source_id))
        setConsented((consent.data ?? []).length > 0)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load persona settings.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [userId])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || saving) return
    if (!consented) {
      setError('You must explicitly agree to text-persona processing before saving.')
      return
    }
    if (selected.length === 0) {
      setError('Select at least one story or legacy entry as approved source material.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const { error: profileError } = await supabase.from('persona_profiles').upsert({
        user_id: userId,
        display_name: name.trim(),
        biography: biography.trim(),
        response_style: style,
        is_enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (profileError) throw profileError

      const { error: clearError } = await supabase.from('persona_sources').delete().eq('user_id', userId)
      if (clearError) throw clearError
      const rows = sources.filter(source => selected.includes(source.id)).map(source => ({
        user_id: userId, source_type: source.source_type, source_id: source.id, is_enabled: true,
      }))
      const { error: sourceError } = await supabase.from('persona_sources').insert(rows)
      if (sourceError) throw sourceError

      if (!consented) throw new Error('Consent is required.')
      const { data: existing, error: consentReadError } = await supabase.from('persona_consents')
        .select('id').eq('user_id', userId).eq('consent_type', 'text_persona').is('revoked_at', null).limit(1)
      if (consentReadError) throw consentReadError
      if (!existing?.length) {
        const { error: consentError } = await supabase.from('persona_consents').insert({
          user_id: userId, consent_type: 'text_persona', policy_version: '2026-11-18',
        })
        if (consentError) throw consentError
      }
      setEnabled(true)
      setMessage('Persona settings and approved sources saved. AI conversations will become available after the secure model service is configured.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save persona settings.')
    } finally {
      setSaving(false)
    }
  }

  async function revoke() {
    if (!supabase || !window.confirm('Disable your text persona and revoke its processing consent?')) return
    setSaving(true)
    setError('')
    try {
      const now = new Date().toISOString()
      const [profile, consent] = await Promise.all([
        supabase.from('persona_profiles').update({ is_enabled: false, updated_at: now }).eq('user_id', userId),
        supabase.from('persona_consents').update({ revoked_at: now }).eq('user_id', userId).eq('consent_type', 'text_persona').is('revoked_at', null),
      ])
      if (profile.error) throw profile.error
      if (consent.error) throw consent.error
      setEnabled(false)
      setConsented(false)
      setMessage('Text persona disabled and consent revoked. Your original stories remain unchanged.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke consent.')
    } finally {
      setSaving(false)
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !chatPrompt.trim() || chatBusy) return
    const prompt = chatPrompt.trim()
    setChatPrompt('')
    setChatBusy(true)
    setError('')
    setChatMessages(current => [...current, { role: 'user', content: prompt }])
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('persona-chat', { body: { prompt, conversationId } })
      if (invokeError) throw invokeError
      if (!data?.answer) throw new Error(data?.error || 'AI response is unavailable.')
      setConversationId(data.conversationId)
      setChatMessages(current => [...current, { role: 'assistant', content: data.answer, sources: data.sources ?? [] }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AI conversation could not be completed.')
    } finally {
      setChatBusy(false)
    }
  }

  if (loading) return <section className="stories-empty"><span className="loading-ring" />Loading AI legacy settings…</section>

  return <section className="stories-section">
    <div className="stories-toolbar">
      <div><span className="eyebrow">YOUR LEGACY, YOUR CONTROL</span><h2>AI legacy persona</h2></div>
      <span className="stat-icon"><BrainCircuit size={20} /></span>
    </div>
    <p className="vault-intro">Prepare a text-based AI representation grounded only in the memories and legacy entries you approve. This does not clone your voice or generate your likeness.</p>
    <div className="vault-security-note"><LockKeyhole size={17} /><span>Your source material stays private. Only entries you select below are approved for future persona responses.</span></div>
    {error && <p className="form-feedback form-error" role="alert">{error}</p>}
    {message && <p className="form-feedback form-success" role="status">{message}</p>}
    <form className="vault-form" onSubmit={save}>
      <label>Persona name<input value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="Name shown to family" required /></label>
      <label>About this person<textarea value={biography} onChange={e => setBiography(e.target.value)} maxLength={4000} rows={4} placeholder="A short introduction, values and background" /></label>
      <label>Response style<select value={style} onChange={e => setStyle(e.target.value)}><option value="warm and thoughtful">Warm and thoughtful</option><option value="direct and practical">Direct and practical</option><option value="gentle and encouraging">Gentle and encouraging</option><option value="formal and reflective">Formal and reflective</option></select></label>
      <div className="vault-form-section"><h3>Approved source material</h3><p>Select exactly which stories and legacy entries may inform this persona.</p>
        {sources.length === 0 ? <p>No stories or legacy entries yet. Add them first, then return here.</p> : sources.map(source => {
          const key = source.id
          return <label className="vault-check-row" key={source.source_type + key}><input type="checkbox" checked={selected.includes(key)} onChange={e => setSelected(current => e.target.checked ? [...current, key] : current.filter(id => id !== key))} /><span><strong>{source.title}</strong><small>{source.source_type === 'story' ? 'Life story' : 'Legacy entry'}</small></span></label>
        })}
      </div>
      <label className="vault-check-row"><input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)} /><span><strong>I consent to text-based AI processing</strong><small>I understand only selected entries may be processed to generate AI responses. I can revoke this consent at any time. This consent does not cover voice or likeness generation.</small></span></label>
      <button className="dashboard-primary" type="submit" disabled={saving || sources.length === 0 || !consented}><Save size={16} />{saving ? 'Saving…' : 'Save persona settings'}</button>
    </form>
    {enabled && <div className="vault-security-note"><CheckCircle2 size={17} /><span>Persona profile is configured. AI chat requires the secure model service credentials to be configured.</span><button type="button" className="text-button" onClick={() => void revoke()} disabled={saving}>Revoke consent and disable</button></div>}
    {enabled && <section className="persona-chat-panel">
      <h3>Talk with the AI legacy companion</h3>
      <p>Responses are AI-generated and based only on the entries you approved. The companion does not claim to be the real person.</p>
      <div className="persona-chat-history" aria-live="polite">
        {chatMessages.length === 0 ? <p>Your conversation will appear here once the AI model service is configured.</p> : chatMessages.map((item, index) => <article className={item.role === 'user' ? 'persona-chat-user' : 'persona-chat-assistant'} key={index}><strong>{item.role === 'user' ? 'You' : 'SOOULL AI'}</strong><p>{item.content}</p>{item.sources?.length ? <small>Sources: {item.sources.map(source => source.title).join(', ')}</small> : null}</article>)}
      </div>
      <form className="persona-chat-compose" onSubmit={sendMessage}><textarea value={chatPrompt} onChange={e => setChatPrompt(e.target.value)} rows={2} maxLength={4000} placeholder="Ask about the memories you approved…" /><button className="dashboard-primary" type="submit" disabled={chatBusy || !chatPrompt.trim()}>{chatBusy ? 'Thinking…' : 'Send'}</button></form>
    </section>}
  </section>
}
