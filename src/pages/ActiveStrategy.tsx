import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { activeClient, type ActiveDetail, type StopHistoryPayload } from '../services/activeClient'
import Modal from '../components/ui/Modal'
import CalendarPopover from '../components/ui/CalendarPopover'

const __AS_log = (...args: any[]) => console.info('[ActiveStrategy]', ...args)

function isYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function ymdToInt(s: string): number | null {
  if (!isYYYYMMDD(s)) return null
  return Number(s.replaceAll('-', ''))
}

type SortDir = 'asc' | 'desc'

type OpenTradeSortKey = 'trade_id' | 'ticker' | 'side' | 'entry_date' | 'entry_price' | 'stop_date' | 'stop_price'
type StopHistSortKey = 'date' | 'exit' | 'reason'

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

function ThSort(props: { label: string; k: string; activeK: string; dir: SortDir; onSort: (k: any) => void }) {
  const active = props.activeK === props.k
  return (
    <th style={{ cursor: 'pointer' }}>
      <button style={thBtn} onClick={() => props.onSort(props.k)}>
        {props.label} {active ? (props.dir === 'asc' ? '▲' : '▼') : '↕'}
      </button>
    </th>
  )
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

function formatYmd(ymd: number): string {
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

function stopRows(payload: StopHistoryPayload | null | undefined): { date: number; exit_kind: string; exit_price: any; exit_reason: string }[] {
  if (!payload) return []
  // API contract: stop history is a list of exit-instruction rows.
  return (payload.history || []).slice().sort((a, b) => (b.date || 0) - (a.date || 0)) as any
}

function latestStopFromHistory(
  tradeId: string,
  tradeHistCache: Record<string, StopHistoryPayload | null>
): { date: number | null; exit_kind: string; exit_price: any } {
  const cached = tradeHistCache[tradeId]
  if (!cached) return { date: null, exit_kind: 'NONE', exit_price: null }
  const rows = stopRows(cached)
  if (!rows.length) return { date: null, exit_kind: 'NONE', exit_price: null }
  return {
    date: rows[0].date ?? null,
    exit_kind: rows[0].exit_kind ?? 'NONE',
    exit_price: rows[0].exit_price,
  }
}

export default function ActiveStrategy() {
  const params = useParams()
  const activeId = params.activeId || ''

  const [detail, setDetail] = useState<ActiveDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const trades = detail?.open_trades || []

  const [modalTradeId, setModalTradeId] = useState<string | null>(null)
  const [tradeHistCache, setTradeHistCache] = useState<Record<string, StopHistoryPayload | null>>({})
  const [tradeHistErr, setTradeHistErr] = useState<Record<string, string | null>>({})
  const [tradeHistLoading, setTradeHistLoading] = useState<Record<string, boolean>>({})

  // Prefetch is driven by a useEffect. That effect updates these maps, which triggers re-renders.
  // If the effect depends on these maps directly, those re-renders will immediately cancel the
  // in-flight requests (via the cleanup), preventing cache from being populated until the user
  // manually opens the Stops modal (which uses a different fetch path).
  // Keep refs so the effect can read the latest values without self-cancelling.
  const tradeHistCacheRef = useRef<Record<string, StopHistoryPayload | null>>({})
  const tradeHistLoadingRef = useRef<Record<string, boolean>>({})

  const [histStart, setHistStart] = useState<number>(() => ymdMinusDays(todayYmd(), 30))
  const [histEnd, setHistEnd] = useState<number>(() => todayYmd())

  // Main table sorting (same header-click semantics as /runs)
  const [openSortKey, setOpenSortKey] = useState<OpenTradeSortKey>('entry_date')
  const [openSortDir, setOpenSortDir] = useState<SortDir>('desc')

  // Stops modal table sorting (sortable headers inside modal)
  const [stopSortKey, setStopSortKey] = useState<StopHistSortKey>('date')
  const [stopSortDir, setStopSortDir] = useState<SortDir>('desc')

  async function toggleTradeStops(trade_id: string) {
    __AS_log('toggleTradeStops', { trade_id })
    // reset modal table sorting to match the default (newest first)
    setStopSortKey('date')
    setStopSortDir('desc')
    setModalTradeId(trade_id)
    if (tradeHistCache[trade_id]) return
    setTradeHistLoading((m) => ({ ...m, [trade_id]: true }))
    setTradeHistErr((m) => ({ ...m, [trade_id]: null }))
    try {
      const start = histStart
      const end = histEnd
      __AS_log('getTradeStopHistory start', { trade_id, start, end })
      const r = await activeClient.getTradeStopHistory(activeId, trade_id, start, end)
      __AS_log('getTradeStopHistory ok', { trade_id, rows: (r?.history || []).length })
      setTradeHistCache((m) => ({ ...m, [trade_id]: r }))
    } catch (e: any) {
      __AS_log('getTradeStopHistory error', { trade_id, err: String(e?.message || e) })
      setTradeHistErr((m) => ({ ...m, [trade_id]: String(e?.message || e) }))
      setTradeHistCache((m) => ({ ...m, [trade_id]: null }))
    } finally {
      setTradeHistLoading((m) => ({ ...m, [trade_id]: false }))
    }
  }

  // Keep refs in sync with state.
  useEffect(() => {
    tradeHistCacheRef.current = tradeHistCache
  }, [tradeHistCache])

  useEffect(() => {
    tradeHistLoadingRef.current = tradeHistLoading
  }, [tradeHistLoading])

  useEffect(() => {
    if (!activeId) return
    if (!trades.length) return
    let cancelled = false

    const missing = trades
      .map((t) => t.trade_id)
      .filter((trade_id) => !tradeHistCacheRef.current[trade_id] && !tradeHistLoadingRef.current[trade_id])

    if (!missing.length) return

    __AS_log('prefetch stop history', { trades: missing.length, start: histStart, end: histEnd })

    ;(async () => {
      await Promise.all(
        missing.map(async (trade_id) => {
          if (cancelled) return
          setTradeHistLoading((m) => ({ ...m, [trade_id]: true }))
          setTradeHistErr((m) => ({ ...m, [trade_id]: null }))
          try {
            const r = await activeClient.getTradeStopHistory(activeId, trade_id, histStart, histEnd)
            if (cancelled) return
            setTradeHistCache((m) => ({ ...m, [trade_id]: r }))
          } catch (e: any) {
            if (cancelled) return
            setTradeHistErr((m) => ({ ...m, [trade_id]: String(e?.message || e) }))
            setTradeHistCache((m) => ({ ...m, [trade_id]: null }))
          } finally {
            if (cancelled) return
            setTradeHistLoading((m) => ({ ...m, [trade_id]: false }))
          }
        })
      )
    })()

    return () => {
      cancelled = true
    }
  }, [activeId, trades, histStart, histEnd])


  // Generate modal state (same mechanics/semantics as /active)
  const [genOpen, setGenOpen] = useState(false)
  const [genStartDate, setGenStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [genEndDate, setGenEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [genStep, setGenStep] = useState<'pick' | 'confirm'>('pick')
  const [genRunning, setGenRunning] = useState(false)
  const [genErr, setGenErr] = useState<string | null>(null)
  const [showCalStart, setShowCalStart] = useState(false)
  const [showCalEnd, setShowCalEnd] = useState(false)
  const endRef = useRef<HTMLInputElement>(null)
  const [stopGenResp, setStopGenResp] = useState<any | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const d = await activeClient.getActive(activeId)
      setDetail(d)
    } catch (e: any) {
      setErr(e?.message || 'failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeId) load()
  }, [activeId])

  function openGenerate() {
    const t = new Date().toISOString().slice(0, 10)
    __AS_log('generate open', { activeId, today: t })
    setGenErr(null)
    setGenRunning(false)
    setGenStep('pick')
    setGenStartDate(t)
    setGenEndDate(t)
    setShowCalStart(false)
    setShowCalEnd(false)
    setGenOpen(true)
  }

  function closeGenerate() {
    setGenOpen(false)
    setGenErr(null)
    setGenRunning(false)
    setGenStep('pick')
    setShowCalStart(false)
    setShowCalEnd(false)
  }

  async function confirmGenerate() {
    setStopGenResp(null)
    setErr(null)
    setGenErr(null)

    const s = ymdToInt(genStartDate)
    const e = ymdToInt(genEndDate)
    if (s == null || e == null) {
      setGenErr('Dates must be YYYY-MM-DD.')
      return
    }
    if (s > e) {
      setGenErr('Start date must be <= end date.')
      return
    }

    setGenRunning(true)
    __AS_log('generate run start', { activeId, start: s, end: e })
    try {
      const r = await activeClient.runActiveWorkflow(activeId, s, e)
      setStopGenResp(r)
      __AS_log('generate run ok', { activeId, start: s, end: e })
      closeGenerate()
      await load()
    } catch (e2: any) {
      const msg = String(e2?.message || e2)
      __AS_log('generate run error', { activeId, msg })
      setGenErr(msg)
      setGenRunning(false)
    }
  }

  const title = useMemo(() => {
    const runId = detail?.manifest?.promoted_from_run_id || ''
    return runId ? `${activeId} (from ${runId})` : activeId
  }, [activeId, detail])

  function onOpenSort(k: OpenTradeSortKey) {
    if (k === openSortKey) setOpenSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setOpenSortKey(k)
      setOpenSortDir('asc')
    }
  }

  const sortedOpenTrades = useMemo(() => {
    const dir = openSortDir === 'asc' ? 1 : -1
    const derived = trades.map((t) => {
      const latest = latestStopFromHistory(t.trade_id, tradeHistCache)
      const stopDate = latest.date == null ? null : Number(latest.date)
      const stopPrice = latest.exit_kind === 'STOP' && latest.exit_price != null ? Number(latest.exit_price) : null
      return { t, latest, stopDate, stopPrice }
    })

    const keyOf = (d: (typeof derived)[number]): string | number | null => {
      switch (openSortKey) {
        case 'trade_id':
          return String(d.t.trade_id || '')
        case 'ticker':
          return String(d.t.ticker || '').toUpperCase()
        case 'side':
          return String(d.t.side || '').toUpperCase()
        case 'entry_date':
          return d.t.entry_date ? Number(d.t.entry_date) : null
        case 'entry_price':
          return (typeof d.t.entry_price === 'number') ? d.t.entry_price : (d.t.entry_price == null ? null : Number(d.t.entry_price))
        case 'stop_date':
          return d.stopDate
        case 'stop_price':
          return d.stopPrice
        default:
          return null
      }
    }

    derived.sort((a, b) => {
      const av = keyOf(a)
      const bv = keyOf(b)

      if (av == null && bv == null) {
        // tie-breakers: ticker then trade_id
        const at = String(a.t.ticker || '').toUpperCase()
        const bt = String(b.t.ticker || '').toUpperCase()
        if (at < bt) return -1
        if (at > bt) return 1
        const aid = String(a.t.trade_id || '')
        const bid = String(b.t.trade_id || '')
        if (aid < bid) return -1
        if (aid > bid) return 1
        return 0
      }
      if (av == null) return 1
      if (bv == null) return -1

      if (typeof av === 'number' && typeof bv === 'number') {
        if (av < bv) return -1 * dir
        if (av > bv) return 1 * dir
        return 0
      }

      const as = String(av)
      const bs = String(bv)
      if (as < bs) return -1 * dir
      if (as > bs) return 1 * dir
      return 0
    })

    return derived
  }, [trades, tradeHistCache, openSortKey, openSortDir])

  function onStopSort(k: StopHistSortKey) {
    if (k === stopSortKey) setStopSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setStopSortKey(k)
      setStopSortDir('asc')
    }
  }

  const sortedModalStopRows = useMemo(() => {
    if (!modalTradeId) return [] as ReturnType<typeof stopRows>
    const base = stopRows(tradeHistCache[modalTradeId])
    const dir = stopSortDir === 'asc' ? 1 : -1
    const keyOf = (r: (typeof base)[number]): string | number | null => {
      switch (stopSortKey) {
        case 'date':
          return r.date ?? null
        case 'exit': {
          const kind = String(r.exit_kind || '')
          const px = (r.exit_kind === 'STOP' && r.exit_price != null) ? Number(r.exit_price) : null
          return `${kind}::${px == null ? '' : String(px).padStart(20, '0')}`
        }
        case 'reason':
          return String(r.exit_reason || '')
        default:
          return null
      }
    }

    return base.slice().sort((a, b) => {
      const av = keyOf(a)
      const bv = keyOf(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        if (av < bv) return -1 * dir
        if (av > bv) return 1 * dir
        return 0
      }
      const as = String(av)
      const bs = String(bv)
      if (as < bs) return -1 * dir
      if (as > bs) return 1 * dir
      return 0
    })
  }, [modalTradeId, tradeHistCache, stopSortKey, stopSortDir])

  return (
    <div>
      <h1>Active Strategy</h1>
      <div style={{ opacity: 0.8, marginBottom: 8 }}>{title}</div>

      {err && <div style={{ color: 'crimson', marginBottom: 8 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <Link to={`/active/${encodeURIComponent(activeId)}/history`} style={{ fontSize: 12 }}>History →</Link>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>Generate</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={openGenerate} disabled={loading || genRunning}>
            Generate…
          </button>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            Uses the same date-picker modal semantics as <code>/active</code>.
          </div>
        </div>
        {stopGenResp && (
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(stopGenResp, null, 2)}</pre>
        )}
      </div>

      {genOpen && (
        <Modal title={genStep === 'pick' ? 'Generate' : 'Confirm generate'} onClose={closeGenerate} width={720}>
          <div className="stack">
            {genErr && <div className="error">Error: {genErr}</div>}

            {genStep === 'pick' && (
              <div className="stack">
                <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
                  <label className="label" style={{ position: 'relative', flex: 1 }}>
                    <div>Start date</div>
                    <div className="row" style={{ gap: 8 }}>
                      <input
                        className="input"
                        type="text"
                        placeholder="YYYY-MM-DD"
                        value={genStartDate}
                        onChange={(e) => setGenStartDate(e.target.value)}
                        onFocus={() => setShowCalStart(true)}
                      />
                      <button className="button" onClick={() => setShowCalStart((s) => !s)} type="button">📅</button>
                    </div>
                    {showCalStart && (
                      <CalendarPopover
                        value={genStartDate}
                        onPick={(ymd) => {
                          setGenStartDate(ymd)
                          setShowCalStart(false)
                          setShowCalEnd(true)
                          setTimeout(() => {
                            endRef.current?.focus()
                          }, 0)
                        }}
                        onClose={() => setShowCalStart(false)}
                      />
                    )}
                  </label>

                  <label className="label" style={{ position: 'relative', flex: 1 }}>
                    <div>End date</div>
                    <div className="row" style={{ gap: 8 }}>
                      <input
                        ref={endRef}
                        className="input"
                        type="text"
                        placeholder="YYYY-MM-DD"
                        value={genEndDate}
                        onChange={(e) => setGenEndDate(e.target.value)}
                        onFocus={() => setShowCalEnd(true)}
                      />
                      <button className="button" onClick={() => setShowCalEnd((s) => !s)} type="button">📅</button>
                    </div>
                    {showCalEnd && (
                      <CalendarPopover
                        value={genEndDate}
                        onPick={(ymd) => {
                          setGenEndDate(ymd)
                          setShowCalEnd(false)
                        }}
                        onClose={() => setShowCalEnd(false)}
                      />
                    )}
                  </label>
                </div>

                <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
                  <button className="button ghost" onClick={closeGenerate} type="button">Cancel</button>
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      setGenErr(null)
                      const s = ymdToInt(genStartDate)
                      const e = ymdToInt(genEndDate)
                      if (s == null || e == null) { setGenErr('Dates must be YYYY-MM-DD.'); return }
                      if (s > e) { setGenErr('Start date must be <= end date.'); return }
                      setGenStep('confirm')
                    }}
                  >Continue</button>
                </div>
              </div>
            )}

            {genStep === 'confirm' && (
              <div className="stack">
                <div style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10 }}>
                  <div><strong>Date range</strong>: {genStartDate} → {genEndDate}</div>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>
                    This will generate orders and stops for this active strategy. Confirm before executing.
                  </div>
                </div>

                <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
                  <button className="button ghost" type="button" onClick={() => setGenStep('pick')} disabled={genRunning}>Back</button>
                  <button className="button" type="button" disabled={genRunning} onClick={confirmGenerate}>
                    {genRunning ? 'Running…' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h2>Open Trades</h2>
        <table className="table">
          <thead>
            <tr>
              <ThSort label="trade_id" k="trade_id" activeK={openSortKey} dir={openSortDir} onSort={onOpenSort} />
              <ThSort label="ticker" k="ticker" activeK={openSortKey} dir={openSortDir} onSort={onOpenSort} />
              <ThSort label="side" k="side" activeK={openSortKey} dir={openSortDir} onSort={onOpenSort} />
              <ThSort label="entry_date" k="entry_date" activeK={openSortKey} dir={openSortDir} onSort={onOpenSort} />
              <ThSort label="entry_price" k="entry_price" activeK={openSortKey} dir={openSortDir} onSort={onOpenSort} />
              <ThSort label="stop_date" k="stop_date" activeK={openSortKey} dir={openSortDir} onSort={onOpenSort} />
              <ThSort label="stop_price" k="stop_price" activeK={openSortKey} dir={openSortDir} onSort={onOpenSort} />
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {sortedOpenTrades.map((d) => {
              const t = d.t
              const latest = d.latest
              return (
                <tr key={t.trade_id}>
                  <td>{t.trade_id}</td>
                  <td>{t.ticker}</td>
                  <td>{t.side ?? ''}</td>
                  <td>{t.entry_date ? formatYmd(Number(t.entry_date)) : ''}</td>
                  <td>{fmtPrice(t.entry_price ?? null)}</td>
                  <td>{d.stopDate ? formatYmd(Number(d.stopDate)) : ''}</td>
                  <td>{renderExit(latest.exit_kind, latest.exit_price)}</td>
                  <td>
                    <button style={glyphBtn} onClick={() => toggleTradeStops(t.trade_id)} title="Stop history" aria-label="stop history">
                      ⛨
                    </button>
                  </td>
                </tr>
              )
            })}
            {!trades.length && (
              <tr>
                <td colSpan={8} style={{ opacity: 0.7 }}>
                  No open trades
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {modalTradeId && (
          <Modal
            title={`Stops • ${modalTradeId}`}
            onClose={() => setModalTradeId(null)}
            width={900}
          >
            <div style={{ marginTop: 8 }}>
              {tradeHistLoading[modalTradeId] && <div style={{ opacity: 0.75 }}>Loading stop history…</div>}
              {tradeHistErr[modalTradeId] && <div style={{ color: 'crimson' }}>{tradeHistErr[modalTradeId]}</div>}
              {tradeHistCache[modalTradeId] && (() => {
                const rowsDesc = stopRows(tradeHistCache[modalTradeId])
                if (!rowsDesc.length) return <div style={{ opacity: 0.75 }}>—</div>
                const latest = rowsDesc[0]
                return (
                  <div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div><strong>Latest exit</strong>: {renderExit(latest.exit_kind, latest.exit_price)}</div>
                      <div><strong>Date</strong>: {formatYmd(latest.date)}</div>
                    </div>
                    <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <ThSort label="date" k="date" activeK={stopSortKey} dir={stopSortDir} onSort={onStopSort} />
                            <ThSort label="exit" k="exit" activeK={stopSortKey} dir={stopSortDir} onSort={onStopSort} />
                            <ThSort label="reason" k="reason" activeK={stopSortKey} dir={stopSortDir} onSort={onStopSort} />
                          </tr>
                        </thead>
                        <tbody>
                          {sortedModalStopRows.map((r) => (
                            <tr key={r.date}>
                              <td>{formatYmd(r.date)}</td>
                              <td>{renderExit(r.exit_kind, r.exit_price)}</td>
                              <td>{r.exit_reason ?? ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
              {!tradeHistLoading[modalTradeId] && !tradeHistErr[modalTradeId] && !tradeHistCache[modalTradeId] && (
                <div style={{ opacity: 0.75 }}>No stop history loaded.</div>
              )}
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}