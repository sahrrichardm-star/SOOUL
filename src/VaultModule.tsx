import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { FileText, Image, Mic, Play, ShieldCheck, Trash2, Upload, Wallet, Video } from 'lucide-react'
import { supabase } from './lib/supabase'

type Asset = { id: string; title: string; asset_type: string; storage_path: string; mime_type: string; file_size_bytes: number; created_at: string }
type WalletRecord = { id: string; title: string; record_type: string; institution: string; account_label: string; account_last_four: string; notes: string; asset_id: string | null; created_at: string }

const MAX_FILE_SIZE = 100 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/ogg','video/mp4','video/webm','video/quicktime']

function classify(file: File): string {
  if (file.type.startsWith('image/')) return 'photo'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type === 'application/pdf' || file.type.startsWith('text/')) return 'document'
  return 'other'
}

export function VaultModule({ userId }: { userId: string }) {
  const [section, setSection] = useState<'assets' | 'wallet'>('assets')
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetSearch, setAssetSearch] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState('all')
  const [records, setRecords] = useState<WalletRecord[]>([])
  const [walletSearch, setWalletSearch] = useState('')
  const [walletTypeFilter, setWalletTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [title, setTitle] = useState('')
  const [recordType, setRecordType] = useState('bank_account_reference')
  const [institution, setInstitution] = useState('')
  const [accountLabel, setAccountLabel] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function load() {
    if (!supabase) {
      setError('Secure storage is not configured. Please try again later.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [assetResult, walletResult] = await Promise.all([
        supabase.from('assets').select('id,title,asset_type,storage_path,mime_type,file_size_bytes,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('wallet_records').select('id,title,record_type,institution,account_label,account_last_four,notes,asset_id,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      ])
      if (assetResult.error) throw assetResult.error
      if (walletResult.error) throw walletResult.error
      setAssets((assetResult.data ?? []) as Asset[])
      setRecords((walletResult.data ?? []) as WalletRecord[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your private vault.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [userId])

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      recorderRef.current = null
    }
  }, [])

  async function saveFile(file: File, preferredTitle?: string) {
    if (!supabase) throw new Error('Secure storage is not configured.')
    if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('This file type is not supported.')
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error('Files must be between 1 byte and 100 MB.')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100)
    const path = userId + '/' + crypto.randomUUID() + '-' + safeName
    const { data: stored, error: uploadError } = await supabase.storage.from('private-assets').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    const { data, error: insertError } = await supabase.from('assets').insert({
      user_id: userId,
      title: (preferredTitle || file.name).trim().slice(0, 160),
      asset_type: classify(file),
      storage_path: stored.path,
      mime_type: file.type,
      file_size_bytes: file.size,
    }).select('id,title,asset_type,storage_path,mime_type,file_size_bytes,created_at').single()
    if (insertError) {
      await supabase.storage.from('private-assets').remove([stored.path])
      throw insertError
    }
    setAssets((current) => [data as Asset, ...current])
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length || uploading) return
    setUploading(true); setError(''); setNotice('')
    try {
      for (const file of files) await saveFile(file)
      setNotice(files.length === 1 ? 'Your file is securely saved.' : files.length + ' files saved to your private library.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function openAsset(asset: Asset) {
    if (!supabase) return
    const { data, error: linkError } = await supabase.storage.from('private-assets').createSignedUrl(asset.storage_path, 60)
    if (linkError) { setError(linkError.message); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function deleteAsset(asset: Asset) {
    if (!supabase || !window.confirm('Delete this file permanently?')) return
    setError('')
    const { error: storageError } = await supabase.storage.from('private-assets').remove([asset.storage_path])
    if (storageError) {
      const separator = asset.storage_path.lastIndexOf('/')
      const folder = separator >= 0 ? asset.storage_path.slice(0, separator) : ''
      const fileName = separator >= 0 ? asset.storage_path.slice(separator + 1) : asset.storage_path
      const { data: remaining, error: listError } = await supabase.storage.from('private-assets').list(folder, { search: fileName, limit: 10 })
      if (listError || (remaining ?? []).some((item) => item.id !== null && item.name === fileName)) {
        setError(storageError.message)
        return
      }
      // The object is already absent; continue so a prior partial delete can be retried.
    }
    const { error: rowError } = await supabase.from('assets').delete().eq('id', asset.id).eq('user_id', userId)
    if (rowError) { setError(rowError.message); return }
    setAssets((current) => current.filter((item) => item.id !== asset.id))
    setRecords((current) => current.map(record => record.asset_id === asset.id ? { ...record, asset_id: null } : record))
  }

  async function startRecording() {
    setError(''); setNotice('')
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Audio recording is not supported in this browser. Try a current version of Chrome, Edge or Safari.')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = ['audio/webm;codecs=opus','audio/webm','audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          const ext = blob.type.includes('mp4') ? 'm4a' : 'webm'
          await saveFile(new File([blob], 'voice-recording-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + ext, { type: blob.type }), 'Voice recording')
          setNotice('Your voice recording is saved in your private library.')
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Could not save your recording.')
        } finally {
          streamRef.current?.getTracks().forEach((track) => track.stop())
          streamRef.current = null
          setUploading(false)
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Microphone access was not available.')
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      setUploading(true)
      recorderRef.current.stop()
      setRecording(false)
    }
  }

  async function saveWalletRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || saving) return
    if (lastFour && !/^\d{4}$/.test(lastFour)) { setError('Enter only the last four digits, or leave this field blank.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const { data, error: insertError } = await supabase.from('wallet_records').insert({
        user_id: userId,
        title: title.trim(),
        record_type: recordType,
        institution: institution.trim(),
        account_label: accountLabel.trim(),
        account_last_four: lastFour,
        notes: notes.trim(),
        asset_id: selectedAssetId || null,
      }).select('id,title,record_type,institution,account_label,account_last_four,notes,asset_id,created_at').single()
      if (insertError) throw insertError
      setRecords((current) => [data as WalletRecord, ...current])
      setTitle(''); setInstitution(''); setAccountLabel(''); setLastFour(''); setNotes(''); setSelectedAssetId('')
      setNotice('Wallet record saved.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this wallet record.')
    } finally { setSaving(false) }
  }

  async function deleteWalletRecord(record: WalletRecord) {
    if (!supabase || !window.confirm('Delete this wallet record?')) return
    const { error: deleteError } = await supabase.from('wallet_records').delete().eq('id', record.id).eq('user_id', userId)
    if (deleteError) { setError(deleteError.message); return }
    setRecords((current) => current.filter((item) => item.id !== record.id))
  }

  function formatSize(bytes: number) {
    return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const filteredAssets = assets.filter((asset) =>
    (!assetSearch.trim() || asset.title.toLowerCase().includes(assetSearch.trim().toLowerCase())) &&
    (assetTypeFilter === 'all' || asset.asset_type === assetTypeFilter)
  )
  const filteredRecords = records.filter((record) =>
    (!walletSearch.trim() || [record.title, record.institution, record.account_label, record.notes].join(' ').toLowerCase().includes(walletSearch.trim().toLowerCase())) &&
    (walletTypeFilter === 'all' || record.record_type === walletTypeFilter)
  )

  return <section className="vault-section">
    <div className="stories-toolbar"><div><span className="eyebrow">YOUR PRIVATE VAULT</span><h2>Assets & wallet</h2></div><span className="vault-lock"><ShieldCheck size={16} /> Private storage</span></div>
    <div className="member-nav vault-tabs">
      <button type="button" className={section === 'assets' ? 'active' : ''} onClick={() => setSection('assets')}><Image size={16} /> Assets</button>
      <button type="button" className={section === 'wallet' ? 'active' : ''} onClick={() => setSection('wallet')}><Wallet size={16} /> Wallet</button>
    </div>
    {error && <p className="form-feedback form-error" role="alert">{error}</p>}
    {notice && <p className="form-feedback form-success" role="status">{notice}</p>}
    {section === 'assets' ? <>
      <div className="vault-upload-panel">
        <div><h3>Preserve your files</h3><p>Upload photos, PDFs, statements, audio and video. Files are private to your account.</p></div>
        <label className="dashboard-primary vault-upload-label"><Upload size={16} /> {uploading ? 'Saving…' : 'Upload files'}<input type="file" accept={ACCEPTED_TYPES.join(',')} multiple disabled={uploading} onChange={(event) => void handleFiles(event)} /></label>
      </div>
      <div className="vault-recording-panel"><div><Mic size={19} /><div><strong>Record your voice</strong><p>Save a voice sample for your personal archive. AI voice features are not enabled yet.</p></div></div>
        <button className={recording ? 'vault-stop-button' : 'account-secondary-button'} type="button" disabled={uploading} onClick={() => recording ? stopRecording() : void startRecording()}>{recording ? 'Stop & save recording' : 'Start recording'}</button>
      </div>
      {loading ? <div className="stories-empty">Loading your files…</div> : assets.length === 0 ? <div className="stories-empty"><FileText size={24} /><h3>Your asset library is empty.</h3><p>Upload a document, photo, audio or video to start building your personal archive.</p></div> : <>
        <div className="vault-asset-toolbar">
          <input className="story-field" type="search" aria-label="Search private files" placeholder="Search your files…" value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} />
          <select className="story-field" aria-label="Filter files by type" value={assetTypeFilter} onChange={(event) => setAssetTypeFilter(event.target.value)}>
            <option value="all">All file types</option><option value="photo">Photos</option><option value="document">Documents</option><option value="audio">Audio</option><option value="video">Video</option><option value="other">Other</option>
          </select>
        </div>
        {filteredAssets.length === 0 ? <div className="stories-empty"><h3>No matching files.</h3><p>Try another search term or file type.</p></div> :
          <div className="vault-asset-grid">{filteredAssets.map((asset) => <article className="vault-asset-card" key={asset.id}><div className="vault-asset-icon">{asset.asset_type === 'photo' ? <Image /> : asset.asset_type === 'video' ? <Video /> : asset.asset_type === 'audio' ? <Mic /> : <FileText />}</div><div className="vault-asset-info"><strong>{asset.title}</strong><span>{asset.asset_type} · {formatSize(asset.file_size_bytes)}</span><span>{new Date(asset.created_at).toLocaleDateString()}</span></div><div className="vault-asset-actions"><button type="button" onClick={() => void openAsset(asset)} aria-label={'Open ' + asset.title}><Play size={15} /></button><button type="button" onClick={() => void deleteAsset(asset)} aria-label={'Delete ' + asset.title}><Trash2 size={15} /></button></div></article>)}</div>}
      </>}
    </> : <>
      <div className="vault-upload-panel"><div><h3>Financial records, organised</h3><p>Keep account references and statements together. Upload statements in Assets, then add a matching record here.</p></div></div>
      <form className="vault-wallet-form" onSubmit={saveWalletRecord}>
        <label>Record title<input className="story-field" maxLength={160} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Main savings account" /></label>
        <label>Record type<select className="story-field" value={recordType} onChange={(event) => setRecordType(event.target.value)}><option value="bank_account_reference">Bank account reference</option><option value="payment_method_reference">Payment method reference</option><option value="bank_statement">Bank statement</option><option value="investment">Investment</option><option value="loan">Loan</option><option value="tax">Tax record</option><option value="other">Other</option></select></label>
        <label>Bank / institution<input className="story-field" maxLength={160} value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Institution name" /></label>
        <label>Account label<input className="story-field" maxLength={100} value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} placeholder="Personal current account" /></label>
        <label>Last four digits only<input className="story-field" inputMode="numeric" maxLength={4} pattern="[0-9]{0,4}" value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" /></label>
        <label>Notes<textarea className="story-field" maxLength={5000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add safe reference notes. Do not enter passwords or full account numbers." /></label>
        <label>Attach a saved statement or document<select className="story-field" value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}><option value="">No attachment</option>{assets.filter(asset => asset.asset_type === 'document').map(asset => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select></label>
        <p className="account-settings-note">Never store PINs, passwords, CVVs, full card numbers or online banking login details here.</p>
        <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save wallet record'}</button>
      </form>
      {loading ? <div className="stories-empty">Loading wallet records…</div> : records.length === 0 ? <div className="stories-empty"><Wallet size={24} /><h3>No wallet records yet.</h3><p>Add a safe account reference or upload a bank statement in Assets.</p></div> : <>
        <div className="vault-asset-toolbar">
          <input className="story-field" type="search" aria-label="Search wallet records" placeholder="Search wallet records…" value={walletSearch} onChange={(event) => setWalletSearch(event.target.value)} />
          <select className="story-field" aria-label="Filter wallet records by type" value={walletTypeFilter} onChange={(event) => setWalletTypeFilter(event.target.value)}>
            <option value="all">All record types</option><option value="bank_account_reference">Bank account</option><option value="payment_method_reference">Payment method</option><option value="bank_statement">Bank statement</option><option value="investment">Investment</option><option value="loan">Loan</option><option value="tax">Tax</option><option value="other">Other</option>
          </select>
        </div>
        {filteredRecords.length === 0 ? <div className="stories-empty"><h3>No matching wallet records.</h3><p>Try another search term or record type.</p></div> :
          <div className="vault-wallet-list">{filteredRecords.map((record) => <article className="vault-wallet-card" key={record.id}><div><span className="story-category">{record.record_type.replaceAll('_', ' ')}</span><h3>{record.title}</h3><p>{[record.institution, record.account_label, record.account_last_four ? '•••• ' + record.account_last_four : ''].filter(Boolean).join(' · ')}</p>{record.notes && <p>{record.notes}</p>}{record.asset_id && assets.find(asset => asset.id === record.asset_id) && <button type="button" className="text-button" onClick={() => { const attachment = assets.find(asset => asset.id === record.asset_id); if (attachment) void openAsset(attachment) }}>Open attached document: {assets.find(asset => asset.id === record.asset_id)?.title}</button>}</div><button type="button" onClick={() => void deleteWalletRecord(record)} aria-label={'Delete ' + record.title}><Trash2 size={16} /></button></article>)}</div>}
      </>}
    </>}
  </section>
}
