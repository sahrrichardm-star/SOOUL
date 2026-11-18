import { useEffect, useState, type FormEvent } from 'react'
import { Archive, BookHeart, FileText, Pencil, Plus, ShieldCheck, Star, Trash2, X } from 'lucide-react'
import { supabase } from './lib/supabase'

type LegacyType = 'value' | 'wish' | 'lesson' | 'letter'
type LegacyEntry = {
  id: string; user_id: string; title: string; content: string; entry_type: LegacyType
  recipient: string | null; is_featured: boolean; created_at: string
}
type RecordType = 'important_document' | 'account_reference' | 'property' | 'insurance' | 'medical_reference' | 'other'
type SafeRecord = {
  id: string; user_id: string; title: string; record_type: RecordType; institution: string | null
  notes: string; review_date: string | null; created_at: string
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function LegacyModule({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<LegacyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<LegacyEntry | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [entryType, setEntryType] = useState<LegacyType>('value')
  const [recipient, setRecipient] = useState('')
  const [featured, setFeatured] = useState(false)

  async function load() {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase.from('legacy_entries').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      if (queryError) throw queryError
      setEntries((data ?? []) as LegacyEntry[])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your legacy entries. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [userId])

  function openEditor(entry?: LegacyEntry) {
    setEditing(entry ?? null); setTitle(entry?.title ?? ''); setContent(entry?.content ?? '')
    setEntryType(entry?.entry_type ?? 'value'); setRecipient(entry?.recipient ?? '')
    setFeatured(entry?.is_featured ?? false); setError(''); setEditorOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setSaving(true); setError('')
    try {
      const values = { title: title.trim(), content: content.trim(), entry_type: entryType, recipient: recipient.trim() || null, is_featured: featured }
      const result = editing
        ? await supabase.from('legacy_entries').update(values).eq('id', editing.id).eq('user_id', userId).select().single()
        : await supabase.from('legacy_entries').insert({ ...values, user_id: userId }).select().single()
      if (result.error) throw result.error
      const saved = result.data as LegacyEntry
      setEntries(current => editing ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current])
      setEditorOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(entry: LegacyEntry) {
    if (!supabase || !window.confirm(`Delete “${entry.title}”? This cannot be undone.`)) return
    setError('')
    try {
      const { error: deleteError } = await supabase.from('legacy_entries').delete().eq('id', entry.id).eq('user_id', userId)
      if (deleteError) throw deleteError
      setEntries(current => current.filter(item => item.id !== entry.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this entry. Please try again.')
    }
  }

  return (
    <section className="collection-section">
      <div className="collection-heading">
        <div><span className="eyebrow"><BookHeart size={14} /> WHAT YOU PASS FORWARD</span><h2>Your Legacy</h2><p>Keep the values, wishes, lessons and words you want future generations to carry.</p></div>
        <button className="dashboard-primary" type="button" onClick={() => openEditor()}><Plus size={17} /> Add to legacy</button>
      </div>
      {error && <p className="form-feedback form-error" role="alert">{error}</p>}
      {loading ? <div className="stories-empty"><span className="loading-ring" />Loading your legacy…</div>
        : entries.length === 0 ? <div className="stories-empty"><span className="empty-icon"><BookHeart size={25} /></span><h3>Your legacy begins with what matters.</h3><p>Record a principle you live by, a wish for your family, a lesson learned or a letter for someone important.</p><button className="dashboard-primary" type="button" onClick={() => openEditor()}><Plus size={16} /> Create your first entry</button></div>
        : <div className="collection-grid">{entries.map(entry => <article className="collection-card" key={entry.id}>
            <div className="collection-card-top"><span className="story-category">{entry.entry_type.replace('_', ' ')}</span>{entry.is_featured && <span className="featured-label"><Star size={13} fill="currentColor" /> Important</span>}</div>
            <h3>{entry.title}</h3><p>{entry.content || 'A thought saved for the future.'}</p>
            {entry.recipient && <div className="collection-meta">For: {entry.recipient}</div>}
            <div className="story-card-bottom"><span>{dateLabel(entry.created_at)}</span><div><button type="button" onClick={() => openEditor(entry)} aria-label={`Edit ${entry.title}`}><Pencil size={15} /></button><button type="button" onClick={() => void remove(entry)} aria-label={`Delete ${entry.title}`}><Trash2 size={15} /></button></div></div>
          </article>)}</div>}
      {editorOpen && <div className="auth-screen story-editor-screen" onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false) }}>
        <section className="auth-panel story-editor" role="dialog" aria-modal="true" aria-labelledby="legacy-editor-title">
          <button className="icon-button auth-close" type="button" onClick={() => setEditorOpen(false)} aria-label="Close"><X size={19} /></button>
          <div className="eyebrow"><BookHeart size={14} /> PRESERVE WHAT MATTERS</div><h2 id="legacy-editor-title">{editing ? 'Edit your legacy entry.' : 'Leave something meaningful.'}</h2>
          <p className="auth-intro">Capture the ideas and words you want to live beyond today.</p>
          <form className="auth-form" onSubmit={save}>
            <label htmlFor="legacy-title">Title</label><input className="story-field" id="legacy-title" required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="A principle I believe in" />
            <label htmlFor="legacy-type">Entry type</label><select className="story-field" id="legacy-type" value={entryType} onChange={e => setEntryType(e.target.value as LegacyType)}><option value="value">A value I live by</option><option value="wish">A wish for the future</option><option value="lesson">A lesson I learned</option><option value="letter">A letter to someone</option></select>
            <label htmlFor="legacy-recipient">Who is this for? <span className="optional-label">Optional</span></label><input className="story-field" id="legacy-recipient" maxLength={120} value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Family, children, or someone special" />
            <label htmlFor="legacy-content">Your words</label><textarea className="story-field story-content-field" id="legacy-content" rows={7} value={content} onChange={e => setContent(e.target.value)} placeholder="Write what you want them to remember…" />
            <label className="collection-check"><input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} /> Mark as especially important</label>
            {error && <p className="form-feedback form-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save legacy entry'}</button>
          </form>
        </section>
      </div>}
    </section>
  )
}

export function SafekeepingModule({ userId }: { userId: string }) {
  const [records, setRecords] = useState<SafeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<SafeRecord | null>(null)
  const [title, setTitle] = useState('')
  const [recordType, setRecordType] = useState<RecordType>('important_document')
  const [institution, setInstitution] = useState('')
  const [notes, setNotes] = useState('')
  const [reviewDate, setReviewDate] = useState('')

  async function load() {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase.from('safekeeping_records').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      if (queryError) throw queryError
      setRecords((data ?? []) as SafeRecord[])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your records. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [userId])

  function openEditor(record?: SafeRecord) {
    setEditing(record ?? null); setTitle(record?.title ?? ''); setRecordType(record?.record_type ?? 'important_document')
    setInstitution(record?.institution ?? ''); setNotes(record?.notes ?? ''); setReviewDate(record?.review_date ?? '')
    setError(''); setEditorOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setSaving(true); setError('')
    try {
      const values = { title: title.trim(), record_type: recordType, institution: institution.trim() || null, notes: notes.trim(), review_date: reviewDate || null }
      const result = editing
        ? await supabase.from('safekeeping_records').update(values).eq('id', editing.id).eq('user_id', userId).select().single()
        : await supabase.from('safekeeping_records').insert({ ...values, user_id: userId }).select().single()
      if (result.error) throw result.error
      const saved = result.data as SafeRecord
      setRecords(current => editing ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current])
      setEditorOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this record. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(record: SafeRecord) {
    if (!supabase || !window.confirm(`Delete “${record.title}”? This cannot be undone.`)) return
    setError('')
    try {
      const { error: deleteError } = await supabase.from('safekeeping_records').delete().eq('id', record.id).eq('user_id', userId)
      if (deleteError) throw deleteError
      setRecords(current => current.filter(item => item.id !== record.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this record. Please try again.')
    }
  }

  return (
    <section className="collection-section">
      <div className="collection-heading">
        <div><span className="eyebrow"><ShieldCheck size={14} /> KEEP IMPORTANT THINGS IN ORDER</span><h2>Safekeeping</h2><p>Keep a private index of important records and when they need attention.</p></div>
        <button className="dashboard-primary" type="button" onClick={() => openEditor()}><Plus size={17} /> Add a record</button>
      </div>
      <div className="safekeeping-notice"><ShieldCheck size={17} /><p><strong>Privacy first.</strong> This area stores record descriptions and notes only. Do not enter passwords, full account numbers, government ID numbers or other access credentials. Secure file storage and client-side encryption are not enabled yet.</p></div>
      {error && <p className="form-feedback form-error" role="alert">{error}</p>}
      {loading ? <div className="stories-empty"><span className="loading-ring" />Loading your records…</div>
        : records.length === 0 ? <div className="stories-empty"><span className="empty-icon"><Archive size={25} /></span><h3>Your important records, organised.</h3><p>Create an index for documents, property, insurance and other records, with optional review dates.</p><button className="dashboard-primary" type="button" onClick={() => openEditor()}><Plus size={16} /> Add your first record</button></div>
        : <div className="collection-grid">{records.map(record => <article className="collection-card" key={record.id}>
            <div className="collection-card-top"><span className="story-category">{record.record_type.replaceAll('_', ' ')}</span><FileText size={16} className="record-icon" /></div>
            <h3>{record.title}</h3>{record.institution && <div className="collection-meta">{record.institution}</div>}<p>{record.notes || 'No notes added.'}</p>
            {record.review_date && <div className="review-date">Review by {dateLabel(record.review_date + 'T12:00:00')}</div>}
            <div className="story-card-bottom"><span>{dateLabel(record.created_at)}</span><div><button type="button" onClick={() => openEditor(record)} aria-label={`Edit ${record.title}`}><Pencil size={15} /></button><button type="button" onClick={() => void remove(record)} aria-label={`Delete ${record.title}`}><Trash2 size={15} /></button></div></div>
          </article>)}</div>}
      {editorOpen && <div className="auth-screen story-editor-screen" onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false) }}>
        <section className="auth-panel story-editor" role="dialog" aria-modal="true" aria-labelledby="record-editor-title">
          <button className="icon-button auth-close" type="button" onClick={() => setEditorOpen(false)} aria-label="Close"><X size={19} /></button>
          <div className="eyebrow"><Archive size={14} /> PRIVATE RECORD INDEX</div><h2 id="record-editor-title">{editing ? 'Update your record.' : 'Add an important record.'}</h2>
          <p className="auth-intro">Store a description and reminder. Do not add passwords or full identity or financial numbers.</p>
          <form className="auth-form" onSubmit={save}>
            <label htmlFor="record-title">Record name</label><input className="story-field" id="record-title" required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Home insurance policy" />
            <label htmlFor="record-type">Record type</label><select className="story-field" id="record-type" value={recordType} onChange={e => setRecordType(e.target.value as RecordType)}><option value="important_document">Important document</option><option value="account_reference">Account reference</option><option value="property">Property</option><option value="insurance">Insurance</option><option value="medical_reference">Medical reference</option><option value="other">Other</option></select>
            <label htmlFor="record-institution">Organisation or location <span className="optional-label">Optional</span></label><input className="story-field" id="record-institution" maxLength={160} value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Where the original is held" />
            <label htmlFor="record-review">Review date <span className="optional-label">Optional</span></label><input className="story-field" id="record-review" type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)} />
            <label htmlFor="record-notes">Notes</label><textarea className="story-field story-content-field" id="record-notes" rows={6} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add safe, non-sensitive context…" />
            {error && <p className="form-feedback form-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save record'}</button>
          </form>
        </section>
      </div>}
    </section>
  )
}
