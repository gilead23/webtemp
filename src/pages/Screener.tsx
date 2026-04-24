import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ExpressionEditorModal from '../components/ExpressionEditorModal'
import ColumnLayoutModal, { ColumnDef } from '../components/ColumnLayoutModal'
import CalendarPopover from '../components/ui/CalendarPopover'
import { SelectedStrategy } from '../components/StrategyPicker'

// ── Types ──────────────────────────────────────────────────────────────────

type ScreenerResult = {
  as_of_date: number
  expression: string
  total_tickers: number
  matches: string[]
  match_rows: Array<Record<string, any>>
  evaluated: number
  errors: { ticker: string; error: string }[]
  elapsed_ms: number
}

type SavedScreen = {
  screen_id: string
  name: string
  expression: string
  universe_mode: 'ALL' | 'LIST'
  tickers_list: string
  columns: ColumnDef[]
  created_at: string
  updated_at: string
}

type SavedLayout = {
  layout_id: string
  name: string
  columns: ColumnDef[]
}

// Ticker is always column 0 in the results table.
// These are the additional columns shown when no saved default exists.
const BUILTIN_COLUMNS: ColumnDef[] = [
  { name: 'Ticker',   expression: 'ohlc.ticker' },
  { name: 'Name',     expression: 'corporate.company_reference.name' },
  { name: 'Industry', expression: 'corporate.company_reference.industry' },
  { name: 'Close',    expression: 'ohlc.close' },
  { name: 'Volume',   expression: 'ohlc.volume' },
]

// ── Component ──────────────────────────────────────────────────────────────

export default function Screener() {
  const navigate = useNavigate()

  // Expression + universe
  const [expression, setExpression] = useState('')
  const [displayExpr, setDisplayExpr] = useState('')
  const [universeMode, setUniverseMode] = useState<'ALL' | 'LIST'>('ALL')
  const [tickersList, setTickersList] = useState('')
  const [asOfDate, setAsOfDate] = useState('')
  const [showCal, setShowCal] = useState(false)
  const [warmupDays] = useState(365)

  // Result columns
  const [columns, setColumns] = useState<ColumnDef[]>(BUILTIN_COLUMNS)
  const [showColumnModal, setShowColumnModal] = useState(false)

  // Saved layouts
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([])
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('')

  // Run state
  const [result, setResult] = useState<ScreenerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [showEditor, setShowEditor] = useState(false)
  const [sortCol, setSortCol] = useState<string>('ticker')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showErrors, setShowErrors] = useState(false)

  // Saved screens
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([])
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null)
  const [screenName, setScreenName] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)

  // Preload status
  const [preloading, setPreloading] = useState(false)
  const [preloadDone, setPreloadDone] = useState(false)
  const preloadFired = useRef(false)

  const hasExpr = expression.trim().length > 0

  // ── On mount: load saved screens, layouts, and preferences ──
  useEffect(() => {
    // Screens
    fetch('/api/screener/screens')
      .then(r => r.json())
      .then((data: SavedScreen[]) => setSavedScreens(data))
      .catch(() => {})

    // Layouts + preferences in parallel; apply default if one is set
    Promise.all([
      fetch('/api/screener/layouts').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/screener/preferences').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([layouts, prefs]: [SavedLayout[], any]) => {
      setSavedLayouts(Array.isArray(layouts) ? layouts : [])
      const defaultId: string | null = prefs?.default_column_layout_id ?? null
      if (defaultId) {
        const found = layouts.find((l: SavedLayout) => l.layout_id === defaultId)
        if (found) {
          setColumns(found.columns)
          setSelectedLayoutId(defaultId)
        }
      }
    })
  }, [])

  // ── Fire warmup on mount ──
  useEffect(() => {
    if (preloadFired.current) return
    preloadFired.current = true
    setPreloading(true)
    fetch('/api/screener/warmup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warmup_days: warmupDays, ohlc_version: 'v1' }),
    })
      .then(r => r.json())
      .then(() => { setPreloadDone(true); setPreloading(false) })
      .catch(() => { setPreloading(false) })
  }, [])

  // ── Layout dropdown change ──
  function handleLayoutSelect(layout_id: string) {
    setSelectedLayoutId(layout_id)
    if (!layout_id) {
      setColumns(BUILTIN_COLUMNS)
      return
    }
    const found = savedLayouts.find(l => l.layout_id === layout_id)
    if (found) setColumns(found.columns)
  }

  // ── Saved screen operations ──
  function loadScreen(screen: SavedScreen) {
    setExpression(screen.expression)
    setUniverseMode(screen.universe_mode)
    setTickersList(screen.tickers_list)
    // Columns stored in the screen override the current layout; no layout id selected
    if (screen.columns?.length) {
      setColumns(screen.columns)
      setSelectedLayoutId('')
    }
    setActiveScreenId(screen.screen_id)
    setScreenName(screen.name)
    setResult(null)
    setError(null)
  }

  function newScreen() {
    setExpression('')
    setUniverseMode('ALL')
    setTickersList('')
    setColumns(BUILTIN_COLUMNS)
    setSelectedLayoutId('')
    setActiveScreenId(null)
    setScreenName('')
    setResult(null)
    setError(null)
  }

  async function saveScreen() {
    const name = screenName.trim() || `Screen ${new Date().toLocaleDateString()}`
    setSaveLoading(true)
    try {
      const body = { name, expression, universe_mode: universeMode, tickers_list: tickersList, columns }
      if (activeScreenId) {
        const res = await fetch(`/api/screener/screens/${activeScreenId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const updated: SavedScreen = await res.json()
        setSavedScreens(prev => prev.map(s => s.screen_id === activeScreenId ? updated : s))
        setScreenName(updated.name)
      } else {
        const res = await fetch('/api/screener/screens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const created: SavedScreen = await res.json()
        setSavedScreens(prev => [...prev, created])
        setActiveScreenId(created.screen_id)
        setScreenName(created.name)
      }
    } catch (e: any) {
      setError(`Save failed: ${e?.message || String(e)}`)
    } finally {
      setSaveLoading(false)
    }
  }

  async function deleteScreen() {
    if (!activeScreenId) return
    if (!confirm('Delete this saved screen?')) return
    try {
      await fetch(`/api/screener/screens/${activeScreenId}`, { method: 'DELETE' })
      setSavedScreens(prev => prev.filter(s => s.screen_id !== activeScreenId))
      newScreen()
    } catch (e: any) {
      setError(`Delete failed: ${e?.message || String(e)}`)
    }
  }

  // ── Run scan ──
  async function runScan() {
    if (!hasExpr) return
    setError(null)
    setLoading(true)
    try {
      const body: any = {
        expression: expression.trim(),
        warmup_days: warmupDays,
        ohlc_version: 'v1',
      }
      if (universeMode === 'LIST' && tickersList.trim()) {
        body.universe = tickersList.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      }
      if (asOfDate && /^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
        body.as_of_date = Number(asOfDate.replace(/-/g, ''))
      }
      const activeColumns = columns.filter(c => c.name.trim() && c.expression.trim())
      if (activeColumns.length > 0) body.columns = activeColumns

      const res = await fetch('/api/screener/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `HTTP ${res.status}`)
      }
      const data: ScreenerResult = await res.json()
      setResult(data)
      setDisplayExpr(expression.trim())
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  // ── Export to backtest ──
  function exportToBacktest() {
    navigate('/new-sweep', {
      state: {
        seed: {
          permutation: {
            entry: [{
              name: 'ExpressionFlagV2',
              label: 'ExpressionFlagV2',
              params: { expression: [expression.trim()] },
            }],
            exit: [],
          },
        },
      },
    })
  }

  function onEditorSave(s: SelectedStrategy) {
    const expr = s.params?.expression
    if (Array.isArray(expr) && expr.length > 0) setExpression(String(expr[0]))
    setShowEditor(false)
  }

  function exportCsv() {
    if (!result || !result.matches.length) return
    const activeCols = columns.filter(c => c.name.trim() && c.expression.trim())
    const headers = ['Ticker', ...activeCols.map(c => c.name)]
    const rows = (result.match_rows?.length ? result.match_rows : result.matches.map(t => ({ ticker: t }))).map(row =>
      [row.ticker, ...activeCols.map(c => { const v = row[c.name]; return v == null ? '' : String(v) })]
    )
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `screen_${result.as_of_date}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Sorted display rows ──
  const activeColumns = columns.filter(c => c.name.trim() && c.expression.trim())
  function sortValue(row: Record<string, any>, col: string): string | number {
    const v = col === 'ticker' ? row.ticker : row[col]
    if (v == null) return ''
    return typeof v === 'number' ? v : String(v)
  }

  const displayRows = result?.match_rows
    ? [...result.match_rows].sort((a, b) => {
        const av = sortValue(a, sortCol)
        const bv = sortValue(b, sortCol)
        let cmp: number
        if (typeof av === 'number' && typeof bv === 'number') {
          cmp = av - bv
        } else {
          cmp = String(av).localeCompare(String(bv))
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
    : []

  // ── Render ──────────────────────────────────────────────────────────────

  function handleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortIndicator(col: string) {
    if (sortCol !== col) return <span style={{ opacity: 0.25, fontSize: 10 }}> ↕</span>
    return <span style={{ fontSize: 10 }}> {sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  return (
    <div className="stack">
      <h1 style={{ margin: '6px 0 2px', fontSize: 18 }}>Screener</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="hint">Evaluate an expression against the latest bar for every ticker.</span>
        {preloading && <span className="badge" style={{ fontSize: 10, opacity: 0.7 }}>⏳ Warming cache…</span>}
        {preloadDone && !preloading && <span className="badge" style={{ fontSize: 10, color: 'var(--ok)' }}>✓ Cache ready</span>}
      </div>

      {/* ── Saved screens bar ── */}
      <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Saved screens</span>
        <select
          className="select"
          style={{ flex: 1, minWidth: 160, maxWidth: 280 }}
          value={activeScreenId || ''}
          onChange={e => {
            const id = e.target.value
            if (!id) { newScreen(); return }
            const s = savedScreens.find(x => x.screen_id === id)
            if (s) loadScreen(s)
          }}
        >
          <option value="">— new screen —</option>
          {savedScreens.map(s => (
            <option key={s.screen_id} value={s.screen_id}>{s.name}</option>
          ))}
        </select>
        <input
          className="input"
          style={{ flex: 1, minWidth: 140, maxWidth: 220 }}
          placeholder="Screen name…"
          value={screenName}
          onChange={e => setScreenName(e.target.value)}
        />
        <button className="button" onClick={saveScreen} disabled={saveLoading || !hasExpr} style={{ whiteSpace: 'nowrap' }}>
          {saveLoading ? 'Saving…' : activeScreenId ? 'Update' : 'Save'}
        </button>
        {activeScreenId && (
          <button className="button ghost" onClick={deleteScreen} style={{ color: 'var(--err)', whiteSpace: 'nowrap' }}>Delete</button>
        )}
        {activeScreenId && (
          <button className="button ghost" onClick={newScreen} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>+ New</button>
        )}
      </div>

      {/* ── Config panel ── */}
      <div className="card stack" style={{ gap: 12 }}>

        {/* Expression input */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 12 }}>Expression</span>
            <button className="button ghost" onClick={() => setShowEditor(true)} style={{ fontSize: 12, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Builder…
            </button>
          </div>
          <textarea
            className="textarea"
            value={expression}
            onChange={e => setExpression(e.target.value)}
            placeholder='e.g. event.earnings.bars_until == 5 and rsi(14, Close) < 30'
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12, minHeight: 56 }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runScan() }}
          />
        </div>

        {/* Universe + date row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="label" style={{ minWidth: 120 }}>
            <span>Universe</span>
            <select className="select" value={universeMode} onChange={e => setUniverseMode(e.target.value as any)}>
              <option value="ALL">ALL tickers</option>
              <option value="LIST">Custom list</option>
            </select>
          </label>
          {universeMode === 'LIST' && (
            <label className="label" style={{ flex: 1, minWidth: 200 }}>
              <span>Tickers (comma-separated)</span>
              <input className="input" value={tickersList} onChange={e => setTickersList(e.target.value)} placeholder="AAPL, MSFT, GOOG" />
            </label>
          )}
          <label className="label" style={{ minWidth: 160, position: 'relative' }}>
            <span>As-of date (optional)</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="input" value={asOfDate}
                onChange={e => setAsOfDate(e.target.value)}
                placeholder="latest" onFocus={() => setShowCal(true)} style={{ flex: 1 }}
              />
              <button className="button" onClick={() => setShowCal(s => !s)} type="button" style={{ padding: '4px 8px' }}>📅</button>
            </div>
            {showCal && (
              <CalendarPopover value={asOfDate} onPick={ymd => { setAsOfDate(ymd); setShowCal(false) }} onClose={() => setShowCal(false)} />
            )}
          </label>
        </div>

        {/* ── Column layout row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Layout selector */}
          <select
            className="select"
            style={{ minWidth: 160, maxWidth: 220 }}
            value={selectedLayoutId}
            onChange={e => handleLayoutSelect(e.target.value)}
          >
            <option value="">Default columns</option>
            {savedLayouts.map(l => (
              <option key={l.layout_id} value={l.layout_id}>{l.name}</option>
            ))}
          </select>

          {/* Column name chips */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
            {activeColumns.map(col => (
              <span key={col.name} style={{
                padding: '2px 10px', borderRadius: 999, fontSize: 12,
                background: 'var(--panel2)', border: '1px solid var(--line)',
              }}>
                {col.name}
              </span>
            ))}
          </div>

          {/* Edit columns button */}
          <button className="button ghost" onClick={() => setShowColumnModal(true)} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
            Edit Columns
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="button primary" onClick={runScan} disabled={!hasExpr || loading}>
            {loading ? 'Scanning…' : 'Scan'}
          </button>
          <button className="button ghost" onClick={exportToBacktest} disabled={!hasExpr} style={{ whiteSpace: 'nowrap' }}>
            → Backtest
          </button>
          <span className="hint">Ctrl+Enter in expression box also runs</span>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background: 'color-mix(in oklab, var(--err) 22%, transparent)', padding: '8px 12px', borderRadius: 8, color: 'var(--err)' }}>
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="card stack" style={{ gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 14 }}>Results</h2>
              <span className="badge" style={{ background: result.matches.length > 0 ? 'color-mix(in oklab, var(--ok) 22%, transparent)' : 'var(--panel2)' }}>
                {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
              </span>
              <span className="badge">of {result.total_tickers} tickers</span>
              <span className="badge">as of {fmtDate(result.as_of_date)}</span>
              <span className="badge">{result.elapsed_ms.toFixed(0)}ms</span>
            </div>
            {result.matches.length > 0 && (
              <button className="button ghost" onClick={exportCsv} style={{ fontSize: 12 }}>Export CSV</button>
            )}
          </div>

          {displayExpr && (
            <div className="hint" style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.7 }}>{displayExpr}</div>
          )}

          {result.errors.length > 0 && (
            <div>
              <button className="button ghost" onClick={() => setShowErrors(e => !e)} style={{ fontSize: 12, color: 'var(--warn)' }}>
                {result.errors.length} error{result.errors.length !== 1 ? 's' : ''} {showErrors ? '▼' : '▶'}
              </button>
              {showErrors && (
                <div style={{ maxHeight: 150, overflow: 'auto', fontSize: 12, marginTop: 4 }}>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{ color: 'var(--warn)', padding: '1px 0' }}>
                      <strong>{e.ticker}</strong>: {e.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {displayRows.length > 0 ? (
            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--panel)' }}>
                  <tr>
                    <th style={{ width: 48, fontSize: 11, fontWeight: 600 }}>#</th>
                    {activeColumns.map(col => {
                      const key = col.name === 'Ticker' ? 'ticker' : col.name
                      return (
                        <th
                          key={col.name}
                          style={{ cursor: 'pointer', userSelect: 'none', fontSize: 11, fontWeight: 600 }}
                          onClick={() => handleSort(key)}
                        >
                          {col.name}{sortIndicator(key)}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, i) => (
                    <tr key={row.ticker}>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                      {activeColumns.map(col => {
                        const v = row[col.name]
                        return (
                          <td key={col.name} style={{ fontSize: 12 }}>
                            {v == null ? <span style={{ color: 'var(--muted)' }}>—</span> : fmtColVal(v)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="hint">No tickers matched the expression.</div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showEditor && (
        <ExpressionEditorModal kind="entry" onSave={onEditorSave} onClose={() => setShowEditor(false)} />
      )}

      {showColumnModal && (
        <ColumnLayoutModal
          initialColumns={columns}
          savedLayouts={savedLayouts}
          onApply={cols => { setColumns(cols); setSelectedLayoutId('') }}
          onSave={layout => setSavedLayouts(prev => [...prev, layout])}
          onClose={() => setShowColumnModal(false)}
        />
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(ymd: number): string {
  const s = String(ymd).padStart(8, '0')
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function fmtColVal(v: any): string {
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return v % 1 === 0 ? String(v) : parseFloat(v.toFixed(4)).toString()
  return String(v)
}
