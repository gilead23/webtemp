import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchTradeHistory, fetchWeeklyHistory, fetchTradeStopHistory, type TradeRow, type WeeklyPoint } from '../services/activeClient'
import TradeDetailPanel from '../components/TradeDetailPanel'

const __ASD_log = (...args: any[]) => console.info('[ActiveStrategyDetailPage]', ...args)

function fmtYmd(ymd: number | null | undefined): string {
  if (ymd == null) return ''
  const s = String(ymd).padStart(8, '0')
  return `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6, 8)}`
}

function fmtPrice(x: number | null | undefined): string {
  if (x == null) return ''
  if (!Number.isFinite(x)) return ''
  return x.toFixed(2)
}

function renderExit(exit_kind: string, exit_price: any) {
  switch (exit_kind) {
    case 'STOP':
      return fmtPrice(typeof exit_price === 'number' ? exit_price : Number(exit_price))
    case 'MARKET':
      return 'SELL @ OPEN'
    case 'NONE':
      return '—'
    default:
      return '—'
  }
}

function fmtPct(x: number): string {
  const v = x * 100.0
  return `${v.toFixed(2)}%`
}

function ymdMinusDays(ymd: number, days: number): number {
  const s = String(ymd)
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(4, 6)) - 1
  const d = Number(s.slice(6, 8))
  const dt = new Date(Date.UTC(y, m, d))
  dt.setUTCDate(dt.getUTCDate() - days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return Number(`${yy}${mm}${dd}`)
}

function todayYmd(): number {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return y * 10000 + m * 100 + day
}

const tableWrap: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 12, overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh' }
const stickyTh: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 5, background: 'var(--panel2)' }

type TradeSortKey = 'ticker' | 'entry_date' | 'entry_price' | 'exit_date' | 'exit_price' | 'state' | 'pnl'
type SortDir = 'asc' | 'desc'

function Th(props: { label: string, sortKey: TradeSortKey, sortKeyState: TradeSortKey, sortDir: SortDir, onSort: (k: TradeSortKey) => void }) {
  const { label, sortKey, sortKeyState, sortDir, onSort } = props
  const active = sortKeyState === sortKey
  return (
    <th style={stickyTh}>
      <button onClick={() => onSort(sortKey)} style={thBtn}>
        {label}{' '}{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
      </button>
    </th>
  )
}

const thBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  color: 'inherit',
  cursor: 'pointer',
  fontWeight: 600,
}

const glyphBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
  color: 'var(--fg)',
}

export default function ActiveStrategyDetailPage() {
  const params = useParams()
  const activeId = params.activeId || ''
  const [trades, setTrades] = useState<TradeRow[]>([])
  const [weeks, setWeeks] = useState<WeeklyPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [tradeSortKey, setTradeSortKey] = useState<TradeSortKey>('entry_date')
  const [tradeSortDir, setTradeSortDir] = useState<SortDir>('desc')


const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null)
const [stopHistCache, setStopHistCache] = useState<Record<string, any>>({})
const [dataTradeId, setDataTradeId] = useState<string | null>(null)

async function toggleStopHistory(tradeId: string) {
  if (expandedTradeId === tradeId) {
    __ASD_log('toggleStopHistory collapse', { tradeId })
    setExpandedTradeId(null)
    return
  }
  __ASD_log('toggleStopHistory expand', { tradeId })
  setExpandedTradeId(tradeId)
  if (stopHistCache[tradeId]) {
    __ASD_log('toggleStopHistory cache-hit', { tradeId })
    return
  }

  setStopHistCache((prev) => ({ ...prev, [tradeId]: { loading: true } }))
  try {
    const end = todayYmd()
      const start = ymdMinusDays(end, 180)
      __ASD_log('fetchTradeStopHistory start', { tradeId, start, end })
      const r = await fetchTradeStopHistory(activeId, tradeId, start, end)
    __ASD_log('fetchTradeStopHistory ok', { tradeId, rows: (r?.history || []).length })
    setStopHistCache((prev) => ({ ...prev, [tradeId]: { loading: false, data: r } }))
  } catch (e: any) {
    __ASD_log('fetchTradeStopHistory error', { tradeId, err: String(e?.message || e) })
    setStopHistCache((prev) => ({ ...prev, [tradeId]: { loading: false, error: String(e?.message || e) } }))
  }
}

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const [t, w] = await Promise.all([
        fetchTradeHistory(activeId),
        fetchWeeklyHistory(activeId),
      ])
      __ASD_log('load ok', { trades: t.length, weeks: (w?.weeks || []).length })
      setTrades(t)
      setWeeks(w.weeks || [])
    } catch (e: any) {
      __ASD_log('load error', { err: String(e?.message || e) })
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeId) load()
  }, [activeId])

  function onTradeSort(k: TradeSortKey) {
    if (k === tradeSortKey) {
      setTradeSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setTradeSortKey(k)
    setTradeSortDir('desc')
  }

  const sortedTrades = useMemo(() => {
    const dir = tradeSortDir === 'asc' ? 1 : -1

    const keyOf = (t: TradeRow): string | number => {
      switch (tradeSortKey) {
        case 'ticker':
          return String(t.ticker || '').toUpperCase()
        case 'entry_date':
          return typeof t.entry_date === 'number' ? t.entry_date : 0
        case 'entry_price':
          return typeof t.entry_price === 'number' ? t.entry_price : 0
        case 'exit_date':
          return typeof t.exit_date === 'number' ? t.exit_date : 0
        case 'exit_price':
          return typeof t.exit_price === 'number' ? t.exit_price : 0
        case 'state':
          return String(t.state || '').toUpperCase()
        case 'pnl': {
          const pnl = t.state === 'CLOSED' && t.entry_price && t.exit_price
            ? (t.exit_price - t.entry_price) / t.entry_price
            : null
          return (pnl == null) ? -Infinity : pnl
        }
        default:
          return 0
      }
    }

    return trades.slice().sort((a, b) => {
      const av = keyOf(a)
      const bv = keyOf(b)

      if (typeof av === 'number' && typeof bv === 'number') {
        if (av < bv) return -1 * dir
        if (av > bv) return 1 * dir
      } else {
        const as = String(av)
        const bs = String(bv)
        if (as < bs) return -1 * dir
        if (as > bs) return 1 * dir
      }

      // deterministic tie-breakers
      const at = String(a.ticker || '').toUpperCase()
      const bt = String(b.ticker || '').toUpperCase()
      if (at < bt) return -1
      if (at > bt) return 1
      const ad = typeof a.entry_date === 'number' ? a.entry_date : 0
      const bd = typeof b.entry_date === 'number' ? b.entry_date : 0
      return bd - ad
    })
  }, [trades, tradeSortKey, tradeSortDir])

  const closed = useMemo(() => trades.filter((t) => t.state === 'CLOSED'), [trades])
  const weeklyMinMax = useMemo(() => {
    if (!weeks.length) return { min: -0.01, max: 0.01 }
    let mn = weeks[0].weekly_return
    let mx = weeks[0].weekly_return
    for (let i = 1; i < weeks.length; i++) {
      const v = weeks[i].weekly_return
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
    if (mn === mx) {
      const pad = Math.max(0.01, Math.abs(mn) * 0.25)
      return { min: mn - pad, max: mx + pad }
    }
    return { min: mn, max: mx }
  }, [weeks])

  const maxOpenTrades = useMemo(() => {
    let mx = 0
    for (const w of weeks) mx = Math.max(mx, w.open_trades)
    return mx || 1
  }, [weeks])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>History</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to={`/active/${encodeURIComponent(activeId)}`} style={{ fontSize: 12 }}>← Active</Link>
          <button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
      </div>

      {err && <div style={{ color: 'crimson', marginBottom: 8 }}>{err}</div>}

      <div className="card">
        <h2>Weekly Performance</h2>
        {!weeks.length && <div style={{ opacity: 0.75 }}>No weekly data</div>}
        {!!weeks.length && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 140 }}>
              {weeks.map((w) => {
                const span = weeklyMinMax.max - weeklyMinMax.min
                const norm = span <= 0 ? 0.5 : (w.weekly_return - weeklyMinMax.min) / span
                const h = Math.max(2, Math.round(norm * 140))
                const isNeg = w.weekly_return < 0
                return (
                  <div key={w.week_end} title={`${w.week_end} • ${fmtPct(w.weekly_return)} • open=${w.open_trades}`}>
                    <div style={{
                      width: 10,
                      height: h,
                      background: isNeg ? 'var(--err)' : 'var(--ok)',
                      borderRadius: 2,
                      opacity: 0.85,
                    }} />
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
              {weeks.map((w) => {
                const norm = w.open_trades / maxOpenTrades
                const h = Math.max(2, Math.round(norm * 80))
                return (
                  <div key={`${w.week_end}__open`} title={`${w.week_end} • open=${w.open_trades}`}>
                    <div style={{
                      width: 10,
                      height: h,
                      background: 'var(--link)',
                      borderRadius: 2,
                      opacity: 0.85,
                    }} />
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              Tooltip shows: week_end, weekly_return, open_trades.
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>Trade History</h2>
        <div style={tableWrap}>
        <table className="table">
          <thead>
            <tr>
              <Th label="Ticker" sortKey="ticker" sortKeyState={tradeSortKey} sortDir={tradeSortDir} onSort={onTradeSort} />
              <Th label="Entry date" sortKey="entry_date" sortKeyState={tradeSortKey} sortDir={tradeSortDir} onSort={onTradeSort} />
              <Th label="Entry price" sortKey="entry_price" sortKeyState={tradeSortKey} sortDir={tradeSortDir} onSort={onTradeSort} />
              <Th label="Exit date" sortKey="exit_date" sortKeyState={tradeSortKey} sortDir={tradeSortDir} onSort={onTradeSort} />
              <Th label="Exit price" sortKey="exit_price" sortKeyState={tradeSortKey} sortDir={tradeSortDir} onSort={onTradeSort} />
              <Th label="Status" sortKey="state" sortKeyState={tradeSortKey} sortDir={tradeSortDir} onSort={onTradeSort} />
              <Th label="PnL %" sortKey="pnl" sortKeyState={tradeSortKey} sortDir={tradeSortDir} onSort={onTradeSort} />
              <th style={stickyTh}></th>
            </tr>
          </thead>
          <tbody>
            {sortedTrades.map((t) => {
              const pnl = t.state === 'CLOSED' && t.entry_price && t.exit_price
                ? (t.exit_price - t.entry_price) / t.entry_price
                : null
              
return (
  <>
    <tr key={t.trade_id}>
      <td>{t.ticker}</td>
      <td>{fmtYmd(t.entry_date ?? null)}</td>
      <td>{fmtPrice(t.entry_price ?? null)}</td>
      <td>{fmtYmd(t.exit_date ?? null)}</td>
      <td>{t.state === 'CLOSED' ? renderExit(String(t.exit_type || 'NONE'), t.exit_price) : '—'}</td>
      <td>{t.state}</td>
      <td>{pnl == null ? '' : fmtPct(pnl)}</td>
      <td>
        <button style={glyphBtn} onClick={() => toggleStopHistory(t.trade_id)} title={expandedTradeId === t.trade_id ? 'Hide stops' : 'Stop history'} aria-label="stop history">
          {expandedTradeId === t.trade_id ? '✕' : '⛨'}
        </button>
        {' '}
        <button style={glyphBtn} onClick={() => setDataTradeId(dataTradeId === t.trade_id ? null : t.trade_id)} title={dataTradeId === t.trade_id ? 'Hide data' : 'Trade data'} aria-label="trade data">
          {dataTradeId === t.trade_id ? '✕' : '📊'}
        </button>
      </td>
    </tr>
    {expandedTradeId === t.trade_id && (
      <tr key={t.trade_id + ':stops'}>
        <td colSpan={8}>
          {stopHistCache[t.trade_id]?.loading && (
            <div style={{ opacity: 0.75 }}>Loading stop history…</div>
          )}
          {stopHistCache[t.trade_id]?.error && (
            <div style={{ color: 'crimson' }}>{stopHistCache[t.trade_id]?.error}</div>
          )}
          {stopHistCache[t.trade_id]?.data && (
            <div style={{ maxHeight: 240, overflow: 'auto' }}>
              <table className="table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Stop price</th>
                    <th>Stop type</th>
                    <th>Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {(stopHistCache[t.trade_id]?.data?.history || [])
                    .slice()
                    .sort((a: any, b: any) => (Number(b?.date || 0) - Number(a?.date || 0)))
                    .map((h: any) => (
                    <tr key={String(h.date)}>
                      <td>{fmtYmd(h.date ?? null)}</td>
                      <td>{h.exit_price == null ? '' : fmtPrice(Number(h.exit_price))}</td>
                      <td>{h.exit_kind ?? ''}</td>
                      <td>{h.exit_reason ?? ''}</td>
                    </tr>
                  ))}
                  {!(stopHistCache[t.trade_id]?.data?.history || []).length && (
                    <tr><td colSpan={4} style={{ opacity: 0.75 }}>No stop history loaded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </td>
      </tr>
    )}
    {dataTradeId === t.trade_id && (
      <tr key={t.trade_id + ':data'}>
        <td colSpan={8} style={{ padding: 0, border: 'none' }}>
          <TradeDetailPanel
            context={{
              kind: "active",
              activeId: activeId,
              tradeId: t.trade_id,
            }}
            onClose={() => setDataTradeId(null)}
          />
        </td>
      </tr>
    )}
  </>
)
            })}
            {!trades.length && (
              <tr>
                <td colSpan={8} style={{ opacity: 0.7 }}>No trades</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
