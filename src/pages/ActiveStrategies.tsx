import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { activeClient, type ActiveSummary } from '../services/activeClient'

export default function ActiveStrategies() {
  const [rows, setRows] = useState<ActiveSummary[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const r = await activeClient.listActive()
      setRows(r)
    } catch (e: any) {
      setErr(e?.message || 'failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <h1>Active Strategies</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {err && <div style={{ color: 'crimson' }}>{err}</div>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>active_id</th>
              <th>run_id</th>
              <th>created_at</th>
              <th>is_active</th>
              <th>deleted</th>
              <th>last_stop_gen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.active_id}>
                <td>
                  <Link to={`/active/${encodeURIComponent(r.active_id)}`}>{r.active_id}</Link>
                </td>
                <td>{r.promoted_from_run_id || ''}</td>
                <td>{r.created_at || ''}</td>
                <td>{String(r.is_active ?? '')}</td>
                <td>{String(r.deleted ?? '')}</td>
                <td>{r.last_stop_gen_date ?? ''}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} style={{ opacity: 0.7 }}>
                  {loading ? 'Loading…' : 'No active strategies'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
