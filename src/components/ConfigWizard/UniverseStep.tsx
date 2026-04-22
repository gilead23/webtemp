import { useEffect, useRef, useState } from 'react'
import Info from '../ui/Info'
import CalendarPopover from '../ui/CalendarPopover'
import type { InstrumentFilter } from '../../types/spec'

function isYYYYMMDD(s:string){
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function instrumentFilterSummary(f: InstrumentFilter): string {
  const parts: string[] = []
  if (f.is_operating_company)     parts.push('Operating Companies')
  if (f.is_fund)                  parts.push('Funds')
  if (f.is_foreign)               parts.push('Foreign')
  if (f.is_financial_institution) parts.push('Financial Institutions')
  return parts.length ? parts.join(' + ') : 'None'
}

const INSTRUMENT_FIELDS: [keyof InstrumentFilter, string][] = [
  ['is_operating_company',     'Operating Companies'],
  ['is_fund',                  'Funds / ETFs'],
  ['is_foreign',               'Foreign Filers'],
  ['is_financial_institution', 'Financial Institutions'],
]

export default function UniverseStep({
  startDate, endDate, warmupDays,
  setStartDate, setEndDate, setWarmupDays,
  tickersMode, setTickersMode, setTickersList,
  instrumentFilter, setInstrumentFilter,
}:{
  startDate: string
  endDate: string
  warmupDays: number
  setStartDate: (v:string)=>void
  setEndDate: (v:string)=>void
  setWarmupDays: (v:number)=>void
  tickersMode: 'ALL'|'LIST'
  setTickersMode: (v:'ALL'|'LIST')=>void
  setTickersList: (v:string)=>void
  instrumentFilter: InstrumentFilter
  setInstrumentFilter: (f:InstrumentFilter)=>void
}){
  const endRef = useRef<HTMLInputElement>(null)
  const [showCalStart, setShowCalStart] = useState(false)
  const [showCalEnd, setShowCalEnd] = useState(false)
  const [showInstrumentFilter, setShowInstrumentFilter] = useState(false)

  useEffect(()=>{
    if (isYYYYMMDD(startDate)){
      endRef.current?.focus()
    }
  }, [startDate])

  return (
    <div className="card stack">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2 style={{margin:0}}>Universe</h2>
        <Info text={"Universe defines which tickers and what date range to evaluate.\n- 'ALL' uses provider universe.\n- 'Explicit list' uses the comma-separated list below.\n- Dates are inclusive and must be YYYY-MM-DD.\n- warmup_days extends OHLC fetch window for indicator priming."} />
      </div>

      <div className="stack-sm">
        <label className="row" style={{gap:10}}>
          <input type="radio" name="u" checked={tickersMode==='ALL'} onChange={()=>setTickersMode('ALL')} />
          <span>All tickers</span>
        </label>
        <label className="row" style={{gap:10}}>
          <input type="radio" name="u" checked={tickersMode==='LIST'} onChange={()=>setTickersMode('LIST')} />
          <span>Explicit list</span>
        </label>
        <textarea
          className="textarea"
          placeholder="AAA, BBB"
          onChange={e=>setTickersList(e.target.value)}
        />
      </div>

      {/* ── Instrument Types (collapsed by default) ── */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px' }}>
        <button
          className="button ghost"
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: 0, background: 'none',
            border: 'none', cursor: 'pointer',
          }}
          onClick={() => setShowInstrumentFilter(s => !s)}
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>Instrument Types</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {instrumentFilterSummary(instrumentFilter)}&nbsp;{showInstrumentFilter ? '▲' : '▼'}
          </span>
        </button>

        {showInstrumentFilter && (
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <Info text={
              "Filter the ticker universe by instrument classification.\n" +
              "Checked types are included. Unchecked types are not filtered.\n" +
              "Default: Operating Companies only (common stock).\n" +
              "Filters are ANDed with the ticker list above."
            } />
            {INSTRUMENT_FIELDS.map(([field, label]) => (
              <label key={field} className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!instrumentFilter[field]}
                  onChange={e => setInstrumentFilter({
                    ...instrumentFilter,
                    [field]: e.target.checked ? true : undefined,
                  })}
                />
                <span style={{ fontSize: 13 }}>{label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="row" style={{gap:12, alignItems:'flex-end'}}>
        <label className="label" style={{position:'relative'}}>
          <div>Start date <Info text={"Inclusive start date (YYYY-MM-DD). Click calendar to pick."} /></div>
          <div className="row" style={{gap:8}}>
            <input
              className="input"
              type="text"
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChange={e=>setStartDate(e.target.value)}
              onFocus={()=>setShowCalStart(true)}
            />
            <button className="button" onClick={()=>setShowCalStart(s=>!s)}>📅</button>
          </div>
          {showCalStart && (
            <CalendarPopover
              value={startDate}
              onPick={ymd=>{ setStartDate(ymd); setShowCalStart(false); setShowCalEnd(true); setTimeout(()=>{ endRef.current?.focus() }, 0); }}
              onClose={()=>setShowCalStart(false)}
            />
          )}
        </label>

        <label className="label" style={{position:'relative'}}>
          <div>End date <Info text={"Inclusive end date (YYYY-MM-DD)."} /></div>
          <div className="row" style={{gap:8}}>
            <input
              ref={endRef}
              className="input"
              type="text"
              placeholder="YYYY-MM-DD"
              value={endDate}
              onChange={e=>setEndDate(e.target.value)}
              onFocus={()=>setShowCalEnd(true)}
            />
            <button className="button" onClick={()=>setShowCalEnd(s=>!s)}>📅</button>
          </div>
          {showCalEnd && (
            <CalendarPopover
              value={endDate}
              onPick={ymd=>{ setEndDate(ymd); setShowCalEnd(false); }}
              onClose={()=>setShowCalEnd(false)}
            />
          )}
        </label>

        <label className="label">
          <div>warmup_days <Info text={"Number of pre-start sessions to fetch for indicator warmup. Integer ≥ 0."} /></div>
          <input
            className="input"
            type="number"
            min={0}
            value={String(warmupDays)}
            onChange={e=>setWarmupDays(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  )
}
