import { useState } from 'react'
import type { PruningCfg } from './ConstraintsStep'
import type { ValidateConfig } from './RunSettings'
import Info from '../ui/Info'

type Entry = { name: string; label: string; params: Record<string, any> }
type Exit  = { name: string; label: string; params: Record<string, any> }
type Universe = { tickers: 'ALL' | string[], start_date: string, end_date: string, warmup_days: number }

function isList(x:any){ return Array.isArray(x) }
function isObject(x:any){ return x !== null && typeof x === 'object' && !Array.isArray(x) }

function countForParams(params: Record<string, any>){
  let n = 1
  for (const v of Object.values(params)){
    if (v === '' || v === null || v === undefined) return 0
    n *= isList(v) ? Math.max(1, (v as any[]).length) : 1
  }
  return n
}

// Engine expects ParamSpec dicts: {values:[…]} | {range:{…}} | {log_range:{…}} | {as_is:true}
function toParamSpec(v: any){
  if (isObject(v)) {
    const keys = Object.keys(v)
    if (keys.includes('values') || keys.includes('range') || keys.includes('log_range') || (v as any).as_is === true) {
      return v
    }
    // unknown object → treat as single value
    return { values: [v] }
  }
  if (isList(v)) return { values: v }
  return { values: [v] }
}

function wrapParamsToParamSpec(params: Record<string, any>){
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(params)){
    if (v === '' || v === null || v === undefined) continue
    // Skip UI-only metadata keys (not consumed by backend)
    if (k.startsWith('_')) continue
    out[k] = toParamSpec(v)
  }
  return out
}

function weekdaysBetween(ymdStart:string, ymdEnd:string){
  try{
    const [y1,m1,d1] = ymdStart.split('-').map(Number)
    const [y2,m2,d2] = ymdEnd.split('-').map(Number)
    let a = new Date(y1, m1-1, d1)
    const b = new Date(y2, m2-1, d2)
    if (a > b) return 0
    let cnt = 0
    while (a <= b){
      const day = a.getDay()
      if (day !== 0 && day !== 6) cnt++
      a = new Date(a.getFullYear(), a.getMonth(), a.getDate()+1)
    }
    return cnt
  }catch{return 0}
}


/** Count cartesian combinations for a single flag's params. */
function countParamCombos(params: Record<string, any[]> | undefined): number {
  if (!params || typeof params !== 'object') return 1;
  let combos = 1;
  for (const key of Object.keys(params)) {
    const arr = params[key];
    // Empty/undefined means "no sweep" → multiplicative identity (1)
    const n = Array.isArray(arr) ? (arr.length || 1) : 1;
    combos *= n;
  }
  return Math.max(1, combos);
}


 function countFlagSetCombos(flags: Array<{ params: Record<string, ParamSpec> }>): number {
   if (!flags || flags.length === 0) return 0;
   return flags.reduce((sum, f) => sum + countForParams(f?.params), 0);
 }


export default function ReviewStep({
  canExport, canRun,
  runId, mode, validateCfg,
  entries, exits,
  universe, ohlcVersion, pruning,
  trailingStop,
  studyId,
}:{
  canExport: boolean
  canRun: boolean
  runId: string
  mode: 'backtest'|'validate'
  validateCfg: ValidateConfig
  entries: Entry[]
  exits: Exit[]
  universe: Universe
  ohlcVersion: string
  pruning: PruningCfg
  trailingStop?: any
  studyId?: string | null
}){
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Permutations are the Cartesian product of all selected entry flags,
  // multiplied by the product of all selected exit flags (or 1 if none).
  const entryCombos = entries.length
    ? entries.map(e => countForParams(e.params)).reduce((a,b)=>a*b, 1)
    : 0
  const exitCombos = exits.length
    ? exits.map(e => countForParams(e.params)).reduce((a,b)=>a*b, 1)
    : 1
  const totalPerms = entryCombos * exitCombos


  const sessionsAvail = weekdaysBetween(universe.start_date, universe.end_date)
  const requiredSessions = mode === 'validate'
    ? (Number(validateCfg.walk_forward_window||0) + Math.max(0, (Number(validateCfg.folds||0)-1)*Number(validateCfg.walk_forward_step||0)))
    : sessionsAvail
  const feasible = mode === 'backtest' ? true : (sessionsAvail >= requiredSessions)

  const buildConfig = () => {
    const cfg:any = {
      mode,
      data_versions: { ohlc: ohlcVersion },
      universe,
      entry_flags: entries.map(e => ({
        label: e.label,
        name: e.name,
        params: wrapParamsToParamSpec(e.params) // ← no injection of extra keys
      })),
      exit_flags: exits.map(e => ({
        label: e.label,
        name: e.name,
        params: wrapParamsToParamSpec(e.params) // ← no injection of extra keys
      })),
      pruning: pruning || { enabled: false },
      run_id: runId,
      test_name: runId
    }
    if (trailingStop) {
      cfg.trade_management = { trailing_stop: trailingStop }
    }
    if (mode === 'validate'){
      cfg.validate = {
        walk_forward: {
          window: validateCfg.walk_forward_window,
          step: validateCfg.walk_forward_step,
          folds: validateCfg.folds,
        }
      }
    }
    return cfg
  }

  const onRun = async () => {
    setErr(null)
    setRunning(true)
    try{
      const cfg = buildConfig()
      const payload: any = { config: cfg }
      if (studyId) payload.study_id = studyId
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok){
        const txt = await res.text().catch(()=> '')
        throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? `: ${txt}` : ''}`)
      }
      const data = await res.json()
      const id = data?.id || runId
      if (studyId) {
        window.location.href = `/studies/${encodeURIComponent(studyId)}`
      } else {
        window.location.href = `/runs`
      }
    }catch(e:any){
      setErr(e?.message || String(e))
    }finally{
      setRunning(false)
    }
  }

  return (
    <div className="card stack">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2 style={{margin:0}}>Review</h2>
        <Info text={
          "Permutation count is the Cartesian product of selected flags.\nEntries multiply across their flags; exits multiply across their flags (or default to 1 if none).\nTotal = product(entries) × product(exits or 1)."
        }/>
      </div>

      {studyId && (
        <div style={{ padding: '6px 10px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 8, fontSize: 12, opacity: 0.9 }}>
          Run will be created in study <strong>{studyId}</strong>
        </div>
      )}

      <div className="kv">
        <div className="label">Permutations</div>
        <div className="row" style={{gap:16, flexWrap:'wrap'}}>
          <span className="badge">entry combos: {entryCombos}</span>
          <span className="badge">exit combos: {exitCombos}</span>
          <span className="badge">estimated total: <b>{totalPerms}</b></span>
        </div>
      </div>

      {mode === 'validate' && (
        <div className="kv">
          <div className="label">
            Walk-forward feasibility
            <Info text={
`Walk-forward validation:
- Split Universe [start_date..end_date] into F slices of size W sessions, stepping S sessions each time.
- Overlaps: S < W → overlapping; S = W → contiguous; S > W → gaps.
- Feasibility: need >= W + (F-1)*S sessions in range.

Example
Universe: 2025-01-01..2025-02-28 (≈42 sessions)
W=20, S=10, F=3 -> slices: 1–20, 11–30, 21–40 (overlap 10)
Required sessions: 20 + (3-1)*10 = 40.
`}/>
          </div>
          <div className="row" style={{gap:12, flexWrap:'wrap'}}>
            <span className="badge">available sessions: {sessionsAvail}</span>
            <span className="badge">required: {requiredSessions}</span>
            <span className="badge" style={{background: feasible ? 'color-mix(in oklab, var(--ok) 22%, transparent)' : 'color-mix(in oklab, var(--err) 22%, transparent)'}}>{feasible ? 'feasible' : 'not feasible'}</span>
          </div>
        </div>
      )}

      {err && (
        <div className="alert" role="alert" style={{background:'color-mix(in oklab, var(--err) 22%, transparent)', padding:'8px 12px', borderRadius:8}}>
          <div style={{fontWeight:600}}>Error starting run</div>
          <div style={{opacity:0.9, whiteSpace:'pre-wrap'}}>{err}</div>
        </div>
      )}

      <div className="row" style={{justifyContent:'flex-end', gap:8}}>
        <button className="button primary" onClick={onRun} disabled={!canRun || running} aria-disabled={!canRun || running}>
          {running ? 'Starting…' : 'Run Sweep'}
        </button>
      </div>
    </div>
  )
}
