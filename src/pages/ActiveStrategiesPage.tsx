import { Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../components/ui/Modal'
import CalendarPopover from '../components/ui/CalendarPopover'
import { IconButton, IconButtonGroup, IconLink } from '../components/ui/IconButton'
import { ExternalLink, History, Wand2, Play, Pause, Trash2, Calendar } from 'lucide-react'
import {
  ActiveStrategySummary,
  listActiveStrategies,
  activateStrategy,
  deactivateStrategy,
  deleteStrategy,
  runActiveWorkflow,
} from '../services/activeClient'

/** ======== DEBUG TRACE HELPERS (deterministic) ======== */
const __ACT_TAG = '[Active]'
const __ACT_log  = (...args: any[]) => { try { console.log(__ACT_TAG, ...args) } catch {} }
const __ACT_warn = (...args: any[]) => { try { console.warn(__ACT_TAG, ...args) } catch {} }
const __ACT_err  = (...args: any[]) => { try { console.error(__ACT_TAG, ...args) } catch {} }
/** ===================================================== */

function fmtYmdInt(v: any): string {
  if (v == null || v === '') return '—'
  const s = String(v)
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return '—'
}

function isYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function ymdToInt(s: string): number | null {
  if (!isYYYYMMDD(s)) return null
  return Number(s.replaceAll('-', ''))
}

export default function ActiveStrategiesPage() {
  const [rows, setRows] = useState<ActiveStrategySummary[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [sortKey, setSortKey] = useState<keyof ActiveStrategySummary>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Generate modal state
  const [genActiveId, setGenActiveId] = useState<string | null>(null)
  const [genStartDate, setGenStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [genEndDate, setGenEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [genStep, setGenStep] = useState<'pick' | 'confirm'>('pick')
  const [genRunning, setGenRunning] = useState(false)
  const [genErr, setGenErr] = useState<string | null>(null)

  const endRef = useRef<HTMLInputElement>(null)
  const [showCalStart, setShowCalStart] = useState(false)
  const [showCalEnd, setShowCalEnd] = useState(false)

  async function refresh() {
    try {
      setErr(null)
      __ACT_log('refresh start')
      const data = await listActiveStrategies()
      setRows(data.filter(r => !r.deleted))
      __ACT_log('refresh ok', { n: data.length })
    } catch (e: any) {
      const msg = String(e?.message || e)
      setErr(msg)
      __ACT_err('refresh err', msg)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  function onSort(k: keyof ActiveStrategySummary) {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    const dir = sortDir === 'asc' ? 1 : -1
    copy.sort((a, b) => {
      const av: any = (a as any)[sortKey]
      const bv: any = (b as any)[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      const as = String(av)
      const bs = String(bv)
      if (as < bs) return -1 * dir
      if (as > bs) return 1 * dir
      return 0
    })
    return copy
  }, [rows, sortKey, sortDir])

  async function onToggle(active_id: string, nextActive: boolean) {
    const msg = nextActive
      ? 'Activate this strategy?'
      : 'Deactivate this strategy? Stop generation will be blocked. Existing data will be preserved.'
    if (!window.confirm(msg)) return
    setBusyId(active_id)
    __ACT_log('toggle start', { active_id, nextActive })
    try {
      if (nextActive) await activateStrategy(active_id)
      else await deactivateStrategy(active_id)
      await refresh()
      __ACT_log('toggle ok', { active_id, nextActive })
    } catch (e: any) {
      const msg2 = String(e?.message || e)
      setErr(msg2)
      __ACT_err('toggle err', { active_id, nextActive, msg: msg2 })
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(active_id: string) {
    const msg =
      'Permanently delete this strategy? This will remove all operational data for this strategy. This cannot be undone.'
    if (!window.confirm(msg)) return
    setBusyId(active_id)
    __ACT_log('delete start', { active_id })
    try {
      await deleteStrategy(active_id)
      await refresh()
      __ACT_log('delete ok', { active_id })
    } catch (e: any) {
      const msg2 = String(e?.message || e)
      setErr(msg2)
      __ACT_err('delete err', { active_id, msg: msg2 })
    } finally {
      setBusyId(null)
    }
  }

  function openGenerate(active_id: string) {
    setGenErr(null)
    setGenRunning(false)
    setGenStep('pick')
    const t = new Date().toISOString().slice(0, 10)
    setGenStartDate(t)
    setGenEndDate(t)
    setShowCalStart(false)
    setShowCalEnd(false)
    setGenActiveId(active_id)
    __ACT_log('generate open', { active_id, today: t })
  }

  function closeGenerate() {
    setGenActiveId(null)
    setGenErr(null)
    setGenRunning(false)
    setGenStep('pick')
    setShowCalStart(false)
    setShowCalEnd(false)
  }

  const thStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: 'var(--panel2)',
    cursor: 'pointer',
  }

  function renderStatus(r: ActiveStrategySummary) {
    return (
      <span className="badge" style={{ color: r.is_active ? 'var(--ok)' : 'var(--warn)' }}>
        {r.is_active ? 'ACTIVE' : 'INACTIVE'}
      </span>
    )
  }

  const actionsTdStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--line)',
    padding: '8px 6px',
    verticalAlign: 'top',
    width: 210,
    maxWidth: 210,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Active Strategies</h2>
        <button className="button" onClick={refresh} title="Refresh" type="button">↻</button>
      </div>
      {err && <div className="error">Error: {err}</div>}

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflowY: 'auto', maxHeight: '70vh' }}>
        <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle }} onClick={() => onSort('name')}>Name</th>
              <th style={{ ...thStyle }} onClick={() => onSort('is_active')}>Status</th>
              <th style={{ ...thStyle }} onClick={() => onSort('last_stop_gen_date')}>Last Stop Gen</th>
              <th style={{ ...thStyle }} onClick={() => onSort('last_successful_run_date')}>Last Success</th>
              <th style={{ ...thStyle, cursor: 'default', maxWidth: 210 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(r => (
              <tr key={r.active_id}>
                <td title={(r.name || r.strategy_name || 'Unnamed Strategy') + ' — ' + (r.description || '')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>
                      {r.name || 'Unnamed Strategy'}
                    </div>
                    {r.description && (
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.85, fontSize: 12 }}>
                        {r.description}
                      </div>
                    )}
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.7, fontSize: 12 }}>
                      {r.strategy_name || '—'}
                    </div>
                  </div>
                </td>
                <td>{renderStatus(r)}</td>
                <td>{fmtYmdInt(r.last_stop_gen_date)}</td>
                <td>{fmtYmdInt(r.last_successful_run_date)}</td>
                <td style={actionsTdStyle}>
                  <IconButtonGroup gap={6}>
                    <IconLink
                      as={Link}
                      to={`/active/${encodeURIComponent(r.active_id)}`}
                      icon={<ExternalLink />}
                      label="Open strategy"
                      onMouseDown={() => __ACT_log('open mousedown', { active_id: r.active_id })}
                    />
                    <IconLink
                      as={Link}
                      to={`/active/${encodeURIComponent(r.active_id)}/history`}
                      icon={<History />}
                      label="History"
                      onMouseDown={() => __ACT_log('history mousedown', { active_id: r.active_id })}
                    />
                    <IconButton
                      icon={<Wand2 />}
                      label="Generate orders + stops for date range"
                      disabled={busyId === r.active_id}
                      onClick={() => openGenerate(r.active_id)}
                    />
                    <IconButton
                      icon={r.is_active ? <Pause /> : <Play />}
                      label={r.is_active ? 'Deactivate' : 'Activate'}
                      disabled={busyId === r.active_id}
                      onClick={() => onToggle(r.active_id, !r.is_active)}
                    />
                    <IconButton
                      icon={<Trash2 />}
                      label="Delete"
                      variant="danger"
                      disabled={busyId === r.active_id}
                      onClick={() => onDelete(r.active_id)}
                    />
                  </IconButtonGroup>
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={5}>No active strategies.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {genActiveId && (
        <Modal
          title={genStep === 'pick' ? 'Generate' : 'Confirm generate'}
          onClose={closeGenerate}
          width={720}
        >
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
                        onChange={e => setGenStartDate(e.target.value)}
                        onFocus={() => setShowCalStart(true)}
                      />
                      <IconButton
                        icon={<Calendar />}
                        label="Pick start date"
                        onClick={() => setShowCalStart(s => !s)}
                      />
                    </div>
                    {showCalStart && (
                      <CalendarPopover
                        value={genStartDate}
                        onPick={ymd => { setGenStartDate(ymd); setShowCalStart(false); setShowCalEnd(true); setTimeout(() => { endRef.current?.focus() }, 0); }}
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
                        onChange={e => setGenEndDate(e.target.value)}
                        onFocus={() => setShowCalEnd(true)}
                      />
                      <IconButton
                        icon={<Calendar />}
                        label="Pick end date"
                        onClick={() => setShowCalEnd(s => !s)}
                      />
                    </div>
                    {showCalEnd && (
                      <CalendarPopover
                        value={genEndDate}
                        onPick={ymd => { setGenEndDate(ymd); setShowCalEnd(false) }}
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
                    This will generate orders and stops for the selected strategy. Confirm before executing.
                  </div>
                </div>

                <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
                  <button className="button ghost" type="button" onClick={() => setGenStep('pick')} disabled={genRunning}>Back</button>
                  <button
                    className="button"
                    type="button"
                    disabled={genRunning}
                    onClick={async () => {
                      setGenErr(null)
                      const s = ymdToInt(genStartDate)
                      const e = ymdToInt(genEndDate)
                      if (s == null || e == null) { setGenErr('Dates must be YYYY-MM-DD.'); return }
                      if (s > e) { setGenErr('Start date must be <= end date.'); return }

                      setGenRunning(true)
                      __ACT_log('generate run start', { active_id: genActiveId, start: s, end: e })
                      try {
                        await runActiveWorkflow(genActiveId, s, e)
                        __ACT_log('generate run ok', { active_id: genActiveId, start: s, end: e })
                        closeGenerate()
                        await refresh()
                      } catch (ex: any) {
                        const msg = String(ex?.message || ex)
                        setGenErr(msg)
                        __ACT_err('generate run err', { active_id: genActiveId, msg })
                        setGenRunning(false)
                      }
                    }}
                  >{genRunning ? 'Running…' : 'Confirm'}</button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

/** (glyphBtn removed — replaced by IconButton/IconLink) */
