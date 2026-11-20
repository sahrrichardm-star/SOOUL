import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BellRing, CalendarClock, CheckCircle2, Clock3, FileText, HeartHandshake, KeyRound, ShieldCheck, Users } from 'lucide-react'
import { supabase } from './lib/supabase'

type Plan = { life_event_enabled: boolean; inactivity_enabled: boolean; inactivity_days: number; last_confirmed_at: string }
type Contact = { id: string; full_name: string; email: string | null; relationship: string | null }
type Recipient = { id: string; trusted_contact_id: string; recipient_email: string; invitation_status: string; recipient_user_id: string | null }
type Item = { id: string; title: string; content_type: 'story' | 'legacy_entry' | 'safekeeping_record' | 'asset'; detail: string }

export default function LegacyAccessModule({ userId }: { userId: string }) {
  const [plan, setPlan] = useState<Plan>({ life_event_enabled: false, inactivity_enabled: false, inactivity_days: 7, last_confirmed_at: new Date().toISOString() })
  const [contacts, setContacts] = useState<Contact[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [grants, setGrants] = useState<Array<{ recipient_id: string; content_type: string; content_id: string }>>([])
  const [selectedRecipient, setSelectedRecipient] = useState('')
  const [selectedContent, setSelectedContent] = useState<string[]>([])
  const [newContactId, setNewContactId] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setError('SOOULL is not connected to its secure database.'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const [planResult, contactResult, recipientResult, grantResult, storyResult, legacyResult, safeResult, assetResult] = await Promise.all([
        supabase.from('legacy_access_plans').select('life_event_enabled,inactivity_enabled,inactivity_days,last_confirmed_at').eq('owner_id', userId).maybeSingle(),
        supabase.from('trusted_contacts').select('id,full_name,email,relationship').eq('user_id', userId).order('full_name'),
        supabase.from('legacy_access_recipients').select('id,trusted_contact_id,recipient_email,invitation_status,recipient_user_id').eq('owner_id', userId).order('created_at'),
        supabase.from('legacy_access_grants').select('recipient_id,content_type,content_id').eq('owner_id', userId),
        supabase.from('stories').select('id,title').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('legacy_entries').select('id,title').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('safekeeping_records').select('id,title').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('assets').select('id,title,asset_type').eq('user_id', userId).order('created_at', { ascending: false }),
      ])
      for (const result of [planResult, contactResult, recipientResult, grantResult, storyResult, legacyResult, safeResult, assetResult]) {
        if (result.error) throw result.error
      }
      if (planResult.data) setPlan(planResult.data as Plan)
      setContacts((contactResult.data ?? []) as Contact[])
      setRecipients((recipientResult.data ?? []) as Recipient[])
      setGrants((grantResult.data ?? []) as Array<{ recipient_id: string; content_type: string; content_id: string }>)
      setItems([
        ...((storyResult.data ?? []).map(item => ({ id: item.id, title: item.title, content_type: 'story' as const, detail: 'Story' }))),
        ...((legacyResult.data ?? []).map(item => ({ id: item.id, title: item.title, content_type: 'legacy_entry' as const, detail: 'Legacy entry' }))),
        ...((safeResult.data ?? []).map(item => ({ id: item.id, title: item.title, content_type: 'safekeeping_record' as const, detail: 'Safekeeping record' }))),
        ...((assetResult.data ?? []).map(item => ({ id: item.id, title: item.title, content_type: 'asset' as const, detail: item.asset_type || 'Private file' }))),
      ])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load future access settings.')
    } finally { setLoading(false) }
  }, [userId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const recipientGrants = grants.filter(grant => grant.recipient_id === selectedRecipient)
    setSelectedContent(recipientGrants.map(grant => grant.content_type + ':' + grant.content_id))
  }, [selectedRecipient, grants])

  const selectedContact = useMemo(() => contacts.find(contact => contact.id === newContactId), [contacts, newContactId])

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || saving) return
    if (!plan.life_event_enabled && !plan.inactivity_enabled) {
      setError('Enable at least one future-access trigger, or leave the settings unsaved.')
      return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      const { error: saveError } = await supabase.from('legacy_access_plans').upsert({
        owner_id: userId,
        life_event_enabled: plan.life_event_enabled,
        inactivity_enabled: plan.inactivity_enabled,
        inactivity_days: Math.min(7, Math.max(1, Number(plan.inactivity_days) || 7)),
        ...(plan.inactivity_enabled ? { last_confirmed_at: new Date().toISOString(), warning_sent_at: null, inactivity_triggered_at: null } : {}),
        updated_at: new Date().toISOString(),
      })
      if (saveError) throw saveError
      setMessage('Future access settings saved. Inactivity starts a verification process; it never releases content automatically.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save future access settings.')
    } finally { setSaving(false) }
  }

  async function confirmActivity() {
    if (!supabase || saving) return
    setSaving(true); setError(''); setMessage('')
    try {
      const { data, error: confirmError } = await supabase.rpc('confirm_legacy_activity')
      if (confirmError) throw confirmError
      setPlan(current => ({ ...current, last_confirmed_at: String(data ?? new Date().toISOString()) }))
      setMessage('Your activity has been confirmed. The inactivity timer has been reset.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to confirm activity.')
    } finally { setSaving(false) }
  }

  async function addRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || saving || !newContactId || !recipientEmail.trim()) return
    setSaving(true); setError(''); setMessage('')
    try {
      const { error: insertError } = await supabase.from('legacy_access_recipients').insert({
        owner_id: userId,
        trusted_contact_id: newContactId,
        recipient_email: recipientEmail.trim().toLowerCase(),
        invitation_status: 'pending',
      })
      if (insertError) throw insertError
      setNewContactId(''); setRecipientEmail('')
      setMessage('Trusted person added to your future-access plan. They are not able to access anything until their own account is verified and the access request is approved.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add this trusted person.')
    } finally { setSaving(false) }
  }

  async function saveGrants() {
    if (!supabase || saving || !selectedRecipient) return
    setSaving(true); setError(''); setMessage('')
    try {
      const selected = selectedContent.map(key => {
        const separator = key.indexOf(':')
        return { content_type: key.slice(0, separator), content_id: key.slice(separator + 1) }
      })
      const { data, error: saveError } = await supabase.rpc('save_legacy_access_grants', {
        p_recipient_id: selectedRecipient,
        p_grants: selected,
      })
      if (saveError) throw saveError
      setMessage('Saved ' + Number(data ?? 0) + ' individually selected item(s) for this trusted person.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save selected access.')
    } finally { setSaving(false) }
  }

  function toggleItem(item: Item) {
    const key = item.content_type + ':' + item.id
    setSelectedContent(current => current.includes(key) ? current.filter(value => value !== key) : current.length >= 100 ? current : [...current, key])
  }

  if (loading) return <section className="stories-empty"><span className="loading-ring" />Loading future access settings…</section>

  return (
    <section className="legacy-access-module">
      <div className="collection-heading">
        <div><span className="eyebrow"><HeartHandshake size={14} /> FUTURE ACCESS</span><h2>Legacy Access</h2><p>Choose who may receive specific memories and records, and define when a verified access process may begin.</p></div>
      </div>

      {error && <p className="form-feedback form-error" role="alert">{error}</p>}
      {message && <p className="form-feedback form-success" role="status">{message}</p>}

      <form className="legacy-access-card" onSubmit={savePlan}>
        <h3><CalendarClock size={18} /> Access triggers</h3>
        <label className="legacy-access-option">
          <input type="checkbox" checked={plan.life_event_enabled} onChange={event => setPlan(current => ({ ...current, life_event_enabled: event.target.checked }))} />
          <span><strong>Verified life event</strong><small>Allow a request to begin after independently verified death or incapacity, subject to the evidence and review process.</small></span>
        </label>
        <label className="legacy-access-option">
          <input type="checkbox" checked={plan.inactivity_enabled} onChange={event => setPlan(current => ({ ...current, inactivity_enabled: event.target.checked }))} />
          <span><strong>Controlled inactivity</strong><small>Begin warnings and verification after you have not confirmed activity for your chosen period.</small></span>
        </label>
        {plan.inactivity_enabled && <div className="legacy-inactivity-setting">
          <label htmlFor="legacy-inactivity-days">Inactivity period</label>
          <div><input id="legacy-inactivity-days" type="number" min={1} max={7} step={1} value={plan.inactivity_days} onChange={event => setPlan(current => ({ ...current, inactivity_days: Math.min(7, Math.max(1, Number(event.target.value) || 1)) }))} /><span>days (24 hours to 7 days)</span></div>
          <p>SOOULL will send reminders and provide time to respond. Reaching this period does not release your content.</p>
        </div>}
        <div className="legacy-access-save-row">
          <button className="dashboard-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save trigger settings'}</button>
          {plan.inactivity_enabled && <button className="account-secondary-button" type="button" onClick={() => void confirmActivity()} disabled={saving}><CheckCircle2 size={15} /> I’m still active</button>}
        </div>
        <p className="account-settings-note">Last activity confirmation: {new Date(plan.last_confirmed_at).toLocaleString()}. The owner can change or disable these settings at any time.</p>
      </form>

      <section className="legacy-access-card">
        <h3><Users size={18} /> Trusted people</h3>
        <p>Add a person from your Trusted People list. Each person must have their own SOOULL account and separately verified identity.</p>
        {contacts.length === 0 ? <p className="account-settings-note">Add trusted people first, then return here to configure their selected access.</p> : <form className="legacy-recipient-form" onSubmit={addRecipient}>
          <label htmlFor="legacy-contact-select">Trusted person</label>
          <select id="legacy-contact-select" className="story-field" value={newContactId} onChange={event => { setNewContactId(event.target.value); const contact = contacts.find(item => item.id === event.target.value); setRecipientEmail(contact?.email ?? '') }} required>
            <option value="">Choose a trusted person</option>
            {contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.full_name} · {contact.relationship || 'Trusted person'}</option>)}
          </select>
          <label htmlFor="legacy-recipient-email">Their SOOULL account email</label>
          <input id="legacy-recipient-email" className="story-field" type="email" required value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} placeholder="person@example.com" />
          <button className="dashboard-primary" type="submit" disabled={saving || !newContactId}>Add trusted person</button>
        </form>}
        {recipients.length > 0 && <div className="legacy-recipient-list">{recipients.map(recipient => {
          const contact = contacts.find(item => item.id === recipient.trusted_contact_id)
          return <button type="button" className={selectedRecipient === recipient.id ? 'legacy-recipient-row active' : 'legacy-recipient-row'} key={recipient.id} onClick={() => setSelectedRecipient(recipient.id)}>
            <span><strong>{contact?.full_name || recipient.recipient_email}</strong><small>{recipient.recipient_email}</small></span>
            <span className="legacy-recipient-status">{recipient.invitation_status}</span>
          </button>
        })}</div>}
      </section>

      {selectedRecipient && <section className="legacy-access-card">
        <h3><ShieldCheck size={18} /> Selected content permissions</h3>
        <p>Choose the individual stories, legacy entries, safekeeping records and private files this person may receive after the required verification. Wallet credentials, passwords and live account access are never shared.</p>
        {items.length === 0 ? <p className="account-settings-note">You have no stories, legacy entries, safekeeping records or private files to select yet.</p> : <div className="legacy-content-list">
          {items.map(item => <label className="legacy-content-option" key={item.content_type + ':' + item.id}>
            <input type="checkbox" checked={selectedContent.includes(item.content_type + ':' + item.id)} onChange={() => toggleItem(item)} />
            <span><strong>{item.title || 'Untitled item'}</strong><small>{item.detail}</small></span>
          </label>)}
        </div>}
        <button className="dashboard-primary" type="button" disabled={saving} onClick={() => void saveGrants()}>{saving ? 'Saving permissions…' : 'Save selected access'}</button>
      </section>}

      <section className="legacy-access-notice">
        <BellRing size={18} />
        <p><strong>Safety rule:</strong> inactivity only starts a warning and verification workflow. A trusted person never receives access automatically. Every release requires independent review, and the owner’s selected-item permissions remain in force.</p>
      </section>
    </section>
  )
}
