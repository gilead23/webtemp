import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { artifactClient, StudyDetail, StudyRun, StudyBests } from '../services/artifactClient'
import Modal from '../components/ui/Modal'

export default function StudyDetailPage() {
  const { studyId } = useParams<{ studyId: string }>()
  const nav = useNavigate()
  const [study, setStudy] = useState<StudyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // Inline editing
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Remove-from-study modal
  const [removeTarget, setRemoveTarget] = useState<StudyRun | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeErr, setRemoveErr] = useState<string | null>(null)

  async function load() {
    if (!studyId) return
    setLoading(true)
    try {
      const d = await artifactClient.getStudy(studyId)
      setStudy(d)
      setEditName(d.name)
      setEditDesc(d.description)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [studyId])

  async function onSave() {
    if (!studyId) return
    setSaving(true)
    try {
      await artifactClient.updateStudy(studyId, { name: editName.trim(), description: editDesc.trim() })
      setEditing(false)
      load()
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function onRemoveRun() {
    if (!studyId || !removeTarget) return
    setRemoving(true)
    setRemoveErr(null)
    try {
      await artifactClient.removeRunFromStudy(studyId, removeTarget.id)
      setRemoveTarget(null)
      load()
    } catch (e: any) {
      setRemoveErr(e?.message || String(e))
    } finally {
      setRemoving(false)
    }
  }

  if (loading && !study) return <div style={{ padding: 16 }}>Loading…</div>
  if (err && !study) return <div style={{ padding: 16 }}><div style={{ color: 'crimson' }}>Error: {err}</div></div>
  if (!study) return <div style={{ padding: 16 }}>Study not found</div>

  function newSweepFromStudyRun(runId: string) {
    if (!study) return
    const run = study.runs.find(r => r.id === runId)
    if (!run) return
    const uni = (run as any).universe
    if (!uni || !uni.start_date || !uni.end_date) {
      alert('Cannot seed: run is missing universe date range.')
      return
    }
    const coerce = (f: any) => ({
      name: (f?.name ?? f?.label ?? '').toString().trim(),
      label: (f?.label ?? f?.name ?? '').toString().trim(),
      params: Object.fromEntries(
        Object.entries(f?.params || {}).map(([k, v]: [string, any]) => {
          if (v && typeof v === 'object' && Array.isArray(v.values)) return [k, { values: v.values.slice() }]
          if (Array.isArray(v)) return [k, { values: v.slice() }]
          return [k, { values: (v == null) ? [] : [v] }]
        })
      ),
    })
    const entry = ((run as any).entry_flags || []).map(coerce)
    const exit = ((run as any).exit_flags || []).map(coerce)
    nav('/new', {
      state: {
        seed: {
          source_run_id: runId,
          universe: uni,
          permutation: { entry, exit },
          study_id: studyId,
        }
      }
    })
  }

  const bests: StudyBests | undefined = study.study_bests

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <button className="button ghost" onClick={() => nav('/studies')} style={{ marginBottom: 8, fontSize: 12 }}>
          ← Studies
        </button>

        {editing ? (
          <div className="stack" style={{ gap: 8 }}>
            <input className="input" value={editName} onChange={e => setEditName(e.target.value)}
              style={{ fontSize: 18, fontWeight: 700 }} autoFocus />
            <textarea className="input" value={editDesc} onChange={e => setEditDesc(e.target.value)}
              rows={2} placeholder="Description…" style={{ resize: 'vertical' }} />
            <div className="row" style={{ gap: 8 }}>
              <button className="button primary" onClick={onSave} disabled={saving || !editName.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="button ghost" onClick={() => { setEditing(false); setEditName(study.name); setEditDesc(study.description) }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ margin: 0 }}>{study.name}</h1>
              <button className="button ghost" onClick={() => setEditing(true)} title="Edit" style={{ fontSize: 12 }}>✏️ Edit</button>
            </div>
            {study.description && <p style={{ opacity: 0.7, marginTop: 4, marginBottom: 0 }}>{study.description}</p>}
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
              Created {fmtDate(study.created_at)} · {study.runs.length} run{study.runs.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      {/* Study-level bests strip */}
      {bests && (bests.best_sharpe != null || bests.best_profit_factor != null) && (
        <div style={{
          display: 'flex', gap: 24, flexWrap: 'wrap',
          padding: '10px 14px', marginBottom: 16,
          background: 'rgba(96,165,250,0.06)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.15)',
          fontSize: 13,
        }}>
          {bests.best_sharpe != null && (
            <div>
              <span style={{ opacity: 0.6 }}>Best Sharpe</span>{' '}
              <strong>{fmtFixed(bests.best_sharpe, 4)}</strong>
              {bests.best_sharpe_run && <span style={{ opacity: 0.5, fontSize: 11 }}> ({bests.best_sharpe_run})</span>}
            </div>
          )}
          {bests.best_profit_factor != null && (
            <div>
              <span style={{ opacity: 0.6 }}>Best PF</span>{' '}
              <strong>{fmtFixed(bests.best_profit_factor, 3)}</strong>
              {bests.best_pf_run && <span style={{ opacity: 0.5, fontSize: 11 }}> ({bests.best_pf_run})</span>}
            </div>
          )}
          {bests.best_per_day_return != null && (
            <div>
              <span style={{ opacity: 0.6 }}>Best Per-Day</span>{' '}
              <strong>{fmtPct(bests.best_per_day_return)}</strong>
            </div>
          )}
          {bests.best_return != null && (
            <div>
              <span style={{ opacity: 0.6 }}>Best Return</span>{' '}
              <strong>{fmtPct(bests.best_return)}</strong>
            </div>
          )}
        </div>
      )}

      {/* Runs table */}
      {study.runs.length === 0 ? (
        <div style={{ padding: '24px 0', opacity: 0.6 }}>
          No runs in this study yet. Use the "Move to study" action on the Runs page to add runs here.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Run Name</th>
              <th style={th}>Start</th>
              <th style={th}>End</th>
              <th style={th}>Done</th>
              <th style={th}>Sharpe</th>
              <th style={th}>PF</th>
              <th style={th}>Per-Day</th>
              <th style={th}>Return</th>
              <th style={{ ...th, textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {study.runs.map(r => {
              const permLabel = r.total_perms != null
                ? `${r.done_perms ?? 0}/${r.total_perms}`
                : `${r.done_perms ?? 0}`
              return (
                <tr key={r.id}>
                  <td style={tdName} title={r.test_name || r.id}>{r.test_name || r.id}</td>
                  <td style={tdNowrap}>{r.start_date || '—'}</td>
                  <td style={tdNowrap}>{r.end_date || '—'}</td>
                  <td style={tdNowrap}>{permLabel}</td>
                  <td style={tdNowrap}>{fmtFixed(r.best_sharpe, 4)}</td>
                  <td style={tdNowrap}>{fmtFixed(r.best_profit_factor, 3)}</td>
                  <td style={tdNowrap}>{fmtPct(r.best_per_day_return)}</td>
                  <td style={tdNowrap}>{fmtPct(r.best_return)}</td>
                  <td style={{ ...tdNowrap, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', gap: 4 }}>
                      <button onClick={() => nav(`/results/${encodeURIComponent(r.id)}`)} style={glyphBtn} title="Open results">📊</button>
                      <button onClick={() => newSweepFromStudyRun(r.id)} style={glyphBtn} title="New sweep from this run">➕</button>
                      <button onClick={() => setRemoveTarget(r)} style={glyphBtn} title="Move back to Runs">↩️</button>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}

      {/* Remove confirmation modal */}
      {removeTarget && (
        <Modal title="Remove Run from Study" onClose={() => !removing && setRemoveTarget(null)} width={440}>
          <div className="stack" style={{ gap: 12 }}>
            <div>
              Move <strong>{removeTarget.test_name || removeTarget.id}</strong> back to the ungrouped Runs list?
            </div>
            {removeErr && <div style={{ color: 'crimson' }}>Error: {removeErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="button ghost" onClick={() => setRemoveTarget(null)} disabled={removing}>Cancel</button>
              <button className="button primary" onClick={onRemoveRun} disabled={removing}>
                {removing ? 'Moving…' : 'Move to Runs'}
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

function fmtFixed(n: any, digits = 2) {
  if (n == null || typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function fmtPct(n: any, digits = 2) {
  if (n == null || typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return (n * 100).toFixed(digits) + '%'
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px 6px', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '8px 6px', verticalAlign: 'top' }
const tdNowrap: React.CSSProperties = { ...td, whiteSpace: 'nowrap' }
const tdName: React.CSSProperties = { ...td, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }
const glyphBtn: React.CSSProperties = {
  width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid #777', borderRadius: 6, background: 'transparent', cursor: 'pointer',
  fontSize: 14, lineHeight: 1, padding: 0, color: '#222',
}
