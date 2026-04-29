import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { artifactClient, Study } from '../services/artifactClient'
import Modal from '../components/ui/Modal'
import { IconButton } from '../components/ui/IconButton'
import { Trash2 } from 'lucide-react'

export default function Studies() {
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const nav = useNavigate()

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Study | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)

  async function load() {
    try {
      const list = await artifactClient.listStudies()
      setStudies(list)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function onCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const s = await artifactClient.createStudy(newName.trim(), newDesc.trim())
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      nav(`/studies/${s.study_id}`)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setCreating(false)
    }
  }

  async function onDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteErr(null)
    try {
      await artifactClient.deleteStudy(deleteTarget.study_id)
      setStudies(prev => prev.filter(s => s.study_id !== deleteTarget.study_id))
      setDeleteTarget(null)
    } catch (e: any) {
      setDeleteErr(e?.message || String(e))
    } finally {
      setDeleting(false)
    }
  }

  if (err) return <div style={{ padding: 16 }}><h1>Studies</h1><div style={{ color: 'crimson' }}>Error: {err}</div></div>

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Studies</h1>
        <button className="button primary" onClick={() => setShowCreate(true)}>+ New Study</button>
      </div>

      {loading && <div>Loading…</div>}

      {!loading && studies.length === 0 && (
        <div style={{ padding: '24px 0', opacity: 0.6 }}>
          No studies yet. Create one to start organizing your runs.
        </div>
      )}

      {studies.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Description</th>
              <th style={{ ...th, width: 80 }}>Runs</th>
              <th style={{ ...th, width: 120 }}>Created</th>
              <th style={{ ...th, width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {studies.map(s => (
              <tr key={s.study_id} style={{ cursor: 'pointer' }}
                onClick={() => nav(`/studies/${s.study_id}`)}>
                <td style={td}>{s.name}</td>
                <td style={{ ...td, opacity: 0.7, maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.description || '—'}
                </td>
                <td style={td}>{s.run_count ?? 0}</td>
                <td style={td}>{fmtDate(s.created_at)}</td>
                <td style={td}>
                  <IconButton
                    icon={<Trash2 />}
                    label="Delete study"
                    size="sm"
                    variant="danger"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(s) }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="New Study" onClose={() => !creating && setShowCreate(false)} width={480}>
          <div className="stack" style={{ gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Name</label>
              <input
                className="input" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. AEAD5 parameter stability"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && onCreate()}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Description <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label>
              <textarea
                className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="What are you investigating?"
                rows={3}
                style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="button ghost" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
              <button className="button primary" onClick={onCreate} disabled={creating || !newName.trim()}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <Modal title="Delete Study" onClose={() => !deleting && setDeleteTarget(null)} width={440}>
          <div className="stack" style={{ gap: 12 }}>
            <div>
              Delete study <strong>{deleteTarget.name}</strong> and all {deleteTarget.run_count ?? 0} runs within it?
              This cannot be undone.
            </div>
            {deleteErr && <div style={{ color: 'crimson' }}>Error: {deleteErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="button ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="button" onClick={onDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  const t = Date.parse(s)
  if (!Number.isFinite(t)) return s
  const d = new Date(t)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: '1px solid var(--line)', padding: '8px 6px', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { borderBottom: '1px solid var(--line)', padding: '8px 6px', verticalAlign: 'top' }
