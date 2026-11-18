import { useEffect, useState, type FormEvent } from 'react'
import { Mail, Pencil, Phone, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { supabase } from './lib/supabase'

type TrustedContact = {
  id: string
  user_id: string
  full_name: string
  relationship: string
  email: string
  phone: string
  notes: string
  is_primary: boolean
  created_at: string
}

function normalizePhone(value: string) {
  return value.replace(/[\s().-]/g, '')
}

export function TrustedPeopleModule({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<TrustedContact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<TrustedContact | null>(null)
  const [fullName, setFullName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [primary, setPrimary] = useState(false)

  async function load() {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase.from('trusted_contacts')
        .select('id,user_id,full_name,relationship,email,phone,notes,is_primary,created_at')
        .eq('user_id', userId).order('is_primary', { ascending: false }).order('created_at', { ascending: false })
      if (queryError) throw queryError
      setContacts((data ?? []) as TrustedContact[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load trusted people.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [userId])

  function openEditor(contact?: TrustedContact) {
    setEditing(contact ?? null)
    setFullName(contact?.full_name ?? '')
    setRelationship(contact?.relationship ?? '')
    setEmail(contact?.email ?? '')
    setPhone(contact?.phone ?? '')
    setNotes(contact?.notes ?? '')
    setPrimary(contact?.is_primary ?? false)
    setError('')
    setEditorOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || saving) return
    const normalizedPhone = normalizePhone(phone)
    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedPhone && !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError('Use international phone format beginning with + and your country calling code.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const values = {
        full_name: fullName.trim(),
        relationship: relationship.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        notes: notes.trim(),
        is_primary: primary,
      }
      const result = editing
        ? await supabase.from('trusted_contacts').update(values).eq('id', editing.id).eq('user_id', userId).select().single()
        : await supabase.from('trusted_contacts').insert({ ...values, user_id: userId }).select().single()
      if (result.error) throw result.error
      const saved = result.data as TrustedContact
      setContacts(current => editing ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current])
      setEditorOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this contact.')
    } finally { setSaving(false) }
  }

  async function remove(contact: TrustedContact) {
    if (!supabase || !window.confirm('Remove ' + contact.full_name + ' from your trusted people list?')) return
    setError('')
    try {
      const { error: deleteError } = await supabase.from('trusted_contacts').delete().eq('id', contact.id).eq('user_id', userId)
      if (deleteError) throw deleteError
      setContacts(current => current.filter(item => item.id !== contact.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to remove this contact.')
    }
  }

  return (
    <section className="collection-section">
      <div className="collection-heading">
        <div><span className="eyebrow"><Users size={14} /> PEOPLE YOU TRUST</span><h2>Trusted People</h2><p>Keep important contact details together for the people who matter to you.</p></div>
        <button className="dashboard-primary" type="button" onClick={() => openEditor()}><Plus size={17} /> Add a person</button>
      </div>
      <div className="account-settings-note"><ShieldCheck size={14} /> These are private contact records only. Adding someone does not give them access to your SOOULL account or files.</div>
      {error && <p className="form-feedback form-error" role="alert">{error}</p>}
      {loading ? <div className="stories-empty"><span className="loading-ring" />Loading trusted people…</div>
        : contacts.length === 0 ? <div className="stories-empty"><span className="empty-icon"><Users size={25} /></span><h3>Keep your important people close.</h3><p>Add a family member, trusted friend or someone you may need to contact.</p><button className="dashboard-primary" type="button" onClick={() => openEditor()}><Plus size={16} /> Add your first person</button></div>
        : <div className="collection-grid">{contacts.map(contact => <article className="collection-card" key={contact.id}>
            <div className="collection-card-top"><span className="story-category">{contact.relationship || 'Trusted contact'}</span>{contact.is_primary && <span className="featured-label">Primary contact</span>}</div>
            <h3>{contact.full_name}</h3>
            {contact.email && <div className="collection-meta"><Mail size={14} /> {contact.email}</div>}
            {contact.phone && <div className="collection-meta"><Phone size={14} /> {contact.phone}</div>}
            {contact.notes && <p>{contact.notes}</p>}
            <div className="story-card-bottom"><span>Private contact</span><div><button type="button" onClick={() => openEditor(contact)} aria-label={'Edit ' + contact.full_name}><Pencil size={15} /></button><button type="button" onClick={() => void remove(contact)} aria-label={'Remove ' + contact.full_name}><Trash2 size={15} /></button></div></div>
          </article>)}</div>}
      {editorOpen && <div className="auth-screen story-editor-screen" onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false) }}>
        <section className="auth-panel story-editor" role="dialog" aria-modal="true" aria-labelledby="trusted-contact-title">
          <button className="icon-button auth-close" type="button" onClick={() => setEditorOpen(false)} aria-label="Close"><X size={19} /></button>
          <div className="eyebrow"><Users size={14} /> YOUR PRIVATE CONTACTS</div><h2 id="trusted-contact-title">{editing ? 'Update this person.' : 'Add someone you trust.'}</h2>
          <form className="auth-form" onSubmit={save}>
            <label htmlFor="trusted-full-name">Full name</label><input className="story-field" id="trusted-full-name" required maxLength={120} value={fullName} onChange={event => setFullName(event.target.value)} />
            <label htmlFor="trusted-relationship">Relationship</label><input className="story-field" id="trusted-relationship" maxLength={80} value={relationship} onChange={event => setRelationship(event.target.value)} placeholder="Family, friend, adviser…" />
            <label htmlFor="trusted-email">Email address</label><input className="story-field" id="trusted-email" type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
            <label htmlFor="trusted-phone">Phone number</label><input className="story-field" id="trusted-phone" type="tel" maxLength={24} value={phone} onChange={event => setPhone(event.target.value)} placeholder="+232…" />
            <p className="account-settings-note">If provided, use international format with + and country calling code.</p>
            <label htmlFor="trusted-notes">Private notes</label><textarea className="story-field story-content-field" id="trusted-notes" maxLength={2000} rows={4} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Optional details to help you remember this contact" />
            <label className="collection-check"><input type="checkbox" checked={primary} onChange={event => setPrimary(event.target.checked)} /> Mark as primary contact</label>
            {error && <p className="form-feedback form-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save contact'}</button>
          </form>
        </section>
      </div>}
    </section>
  )
}
