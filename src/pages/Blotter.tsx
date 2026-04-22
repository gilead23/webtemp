import { useState } from 'react'

const API = '/api'

type IntentRow = {
  intent_type: string
  active_id: string
  trade_id: string
  ticker: string
  side: string
  quantity: number
  stop_price: number | null
  informational: boolean
}

type BlotterGroups = {
  cleanup_sells: IntentRow[]
  stop_orders: IntentRow[]
  market_exits: IntentRow[]
  new_entries: IntentRow[]
  informational: IntentRow[]
}

type BlotterResponse = {
  status: string
  today: number
  engine_results: any[]
  reconciliation: {
    buys_filled: number
    buys_partial: number
    buys_unfilled: number
    stops_filled: number
    stops_partial: number
    stops_unfilled: number
  }
  position_mismatches: { ticker: string; expected: number; actual: number; delta: number }[]
  groups: BlotterGroups
  warnings: string[]
  total_orders: number
}

type ExecuteResponse = {
  status: string
  placed: number
  orders: { our_order_id: string; broker_order_id: number; ticker: string; intent_type: string; quantity: number }[]
}

function formatYmd(ymd: number): string {
  const s = String(ymd).padStart(8, '0')
  return `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6, 8)}`
}

function todayYmd(): number {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: React.CSSProperties = {
  marginBottom: 24, border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden',
}
const sectionHeaderStyle: React.CSSProperties = {
  padding: '10px 16px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid #ddd',
}
const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 13,
}
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #eee',
  fontWeight: 600, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px',
}
const tdStyle: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }

const btnBase: React.CSSProperties = {
  padding: '8px 20px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14,
}
const buildBtnStyle: React.CSSProperties = { ...btnBase, background: '#3d5a80', color: '#fff' }
const executeBtnStyle: React.CSSProperties = { ...btnBase, background: '#2a9d8f', color: '#fff', fontSize: 16, padding: '12px 32px' }
const disabledBtn: React.CSSProperties = { ...executeBtnStyle, background: '#aaa', cursor: 'not-allowed' }
const resetBtnStyle: React.CSSProperties = { ...btnBase, background: '#eee', color: '#333' }

const alertBox = (bg: string, border: string, color: string): React.CSSProperties => ({
  background: bg, border: `1px solid ${border}`, borderRadius: 6,
  padding: '8px 14px', marginBottom: 8, fontSize: 13, color,
})
const warnBox = alertBox('#fff3cd', '#ffc107', '#664d03')
const errorBox = alertBox('#f8d7da', '#f5c2c7', '#842029')
const successBox = alertBox('#d1e7dd', '#badbcc', '#0f5132')

const categoryColors: Record<string, string> = {
  cleanup_sells: '#dc3545', stop_orders: '#fd7e14', market_exits: '#6f42c1',
  new_entries: '#198754', informational: '#6c757d',
}
const categoryLabels: Record<string, string> = {
  cleanup_sells: 'Cleanup Sells (Orphaned Shares)', stop_orders: 'Stop Orders',
  market_exits: 'Market Exit Sells', new_entries: 'New Bracket Entries',
  informational: 'Informational (Theoretical Only)',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function IntentTable({ rows, color }: { rows: IntentRow[]; color: string }) {
  if (!rows.length) return null
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Ticker</th>
          <th style={thStyle}>Strategy</th>
          <th style={thStyle}>Trade ID</th>
          <th style={thStyle}>Side</th>
          <th style={thStyle}>Qty</th>
          <th style={thStyle}>Stop Price</th>
          <th style={thStyle}>Type</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.active_id}-${r.trade_id}-${i}`} style={{ opacity: r.informational ? 0.5 : 1 }}>
            <td style={{ ...tdStyle, fontWeight: 600 }}>{r.ticker}</td>
            <td style={tdStyle}>{r.active_id.replace('active_', '').slice(0, 8)}</td>
            <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{r.trade_id.slice(0, 12)}</td>
            <td style={{ ...tdStyle, color: r.side === 'BUY' ? '#198754' : '#dc3545' }}>{r.side}</td>
            <td style={{ ...tdStyle, fontWeight: 600 }}>{r.quantity || '-'}</td>
            <td style={tdStyle}>{r.stop_price != null ? `$${r.stop_price.toFixed(2)}` : '-'}</td>
            <td style={{ ...tdStyle, color }}>{r.intent_type.replace('_', ' ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReconSummary({ r }: { r: BlotterResponse['reconciliation'] }) {
  const parts = []
  if (r.buys_filled) parts.push(`${r.buys_filled} buys filled`)
  if (r.buys_partial) parts.push(`${r.buys_partial} buys partial`)
  if (r.buys_unfilled) parts.push(`${r.buys_unfilled} buys unfilled`)
  if (r.stops_filled) parts.push(`${r.stops_filled} stops filled`)
  if (r.stops_partial) parts.push(`${r.stops_partial} stops partial`)
  if (r.stops_unfilled) parts.push(`${r.stops_unfilled} stops unfilled`)
  if (!parts.length) return <div style={successBox}>No pending orders to reconcile.</div>
  return <div style={successBox}>Reconciled: {parts.join(' | ')}</div>
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Blotter() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blotter, setBlotter] = useState<BlotterResponse | null>(null)
  const [execResult, setExecResult] = useState<ExecuteResponse | null>(null)

  const today = todayYmd()

  async function handleBuild() {
    setLoading(true)
    setError(null)
    setBlotter(null)
    setExecResult(null)
    try {
      const res = await fetch(`${API}/broker/blotter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: today, end_date: today }),
      })
      if (!res.ok) throw new Error(await res.text().catch(() => `${res.status}`))
      setBlotter(await res.json())
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function handleExecute() {
    if (!blotter) return
    const intents = [
      ...(blotter.groups.cleanup_sells || []),
      ...(blotter.groups.stop_orders || []),
      ...(blotter.groups.market_exits || []),
      ...(blotter.groups.new_entries || []),
    ].filter(i => !i.informational && i.quantity > 0)

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/broker/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intents, today }),
      })
      if (!res.ok) throw new Error(await res.text().catch(() => `${res.status}`))
      setExecResult(await res.json())
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setBlotter(null)
    setExecResult(null)
    setError(null)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Morning Blotter</h1>
          <span style={{ color: '#888', fontSize: 14 }}>{formatYmd(today)}</span>
        </div>
        <button onClick={handleReset} style={resetBtnStyle}>Reset</button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {/* Build blotter button */}
      {!blotter && !loading && (
        <button onClick={handleBuild} style={buildBtnStyle}>Build Blotter</button>
      )}
      {loading && !blotter && <span style={{ color: '#888' }}>Running engine, reconciling, building blotter...</span>}

      {/* Blotter results */}
      {blotter && (
        <div>
          {/* Reconciliation summary */}
          <ReconSummary r={blotter.reconciliation} />

          {/* Position mismatches */}
          {blotter.position_mismatches?.map((m, i) => (
            <div key={i} style={errorBox}>
              Position mismatch: {m.ticker} expected {m.expected}, actual {m.actual} (delta {m.delta > 0 ? '+' : ''}{m.delta})
            </div>
          ))}

          {/* Warnings */}
          {blotter.warnings?.map((w, i) => <div key={i} style={warnBox}>{w}</div>)}

          {/* Grouped intent tables */}
          {Object.entries(blotter.groups).map(([key, rows]) => {
            if (!rows || !rows.length) return null
            return (
              <div key={key} style={sectionStyle}>
                <div style={{
                  ...sectionHeaderStyle,
                  background: `${categoryColors[key]}15`,
                  color: categoryColors[key],
                }}>
                  {categoryLabels[key] || key} ({rows.length})
                </div>
                <IntentTable rows={rows} color={categoryColors[key] || '#333'} />
              </div>
            )
          })}

          {/* Execute button */}
          {blotter.total_orders > 0 && !execResult && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button onClick={handleExecute} disabled={loading} style={loading ? disabledBtn : executeBtnStyle}>
                Execute {blotter.total_orders} Orders
              </button>
            </div>
          )}

          {blotter.total_orders === 0 && !execResult && (
            <div style={successBox}>No orders to place today.</div>
          )}
        </div>
      )}

      {/* Execution result */}
      {execResult && (
        <div style={{ marginTop: 16 }}>
          <div style={successBox}>Executed: {execResult.placed} orders placed.</div>
          {execResult.orders?.length > 0 && (
            <div style={sectionStyle}>
              <div style={{ ...sectionHeaderStyle, background: '#d1e7dd', color: '#0f5132' }}>
                Placed Orders
              </div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Ticker</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Qty</th>
                    <th style={thStyle}>Broker ID</th>
                    <th style={thStyle}>Our ID</th>
                  </tr>
                </thead>
                <tbody>
                  {execResult.orders.map((o, i) => (
                    <tr key={i}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{o.ticker}</td>
                      <td style={tdStyle}>{o.intent_type.replace('_', ' ')}</td>
                      <td style={tdStyle}>{o.quantity}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{o.broker_order_id}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{o.our_order_id.slice(0, 12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
