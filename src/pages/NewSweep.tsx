import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import UniverseStep from '../components/ConfigWizard/UniverseStep'
import { SelectedStrategy } from '../components/StrategyPicker'
import SelectedStrategies from '../components/SelectedStrategies'
import ReviewStep from '../components/ConfigWizard/ReviewStep'
import RunSettings, { ValidateConfig } from '../components/ConfigWizard/RunSettings'
import DataSources from '../components/ConfigWizard/DataSources'
import RunAdvancedDrawer, { PruningCfg } from '../components/RunAdvancedDrawer'
import ExpressionEditorModal from '../components/ExpressionEditorModal'
import { FlagParamModal } from '../components/FlagParamModal'
import TrailingStopCard, { TrailingStopParams, getDefaultTrailingStopParams } from '../components/TrailingStopCard'
import type { InstrumentFilter } from '../types/spec'
import type { FlagDefinition, ParamDefinition, UiFlagInstance, UiParamSpec } from '../types/flags'
import { fetchStrategies, type StrategyDef, type StrategyParam } from '../services/registryClient'

/** ======== DEBUG TRACE HELPERS (deterministic) ======== */
const __NS_TAG = '[NewSweep]'
const __NS_log  = (...args: any[]) => { try { console.log(__NS_TAG, ...args) } catch {} }
const __NS_err  = (...args: any[]) => { try { console.error(__NS_TAG, ...args) } catch {} }
/** ===================================================== */

// ---- Conversion helpers: StrategyDef ↔ FlagDefinition, SelectedStrategy ↔ UiFlagInstance ----

/** Convert a StrategyParam (from /api/registry/strategies) to a ParamDefinition (for FlagParamModal). */
function strategyParamToParamDef(p: StrategyParam): ParamDefinition {
  const typeLower = (p.type || '').toLowerCase()
  let dataType: ParamDefinition['dataType'] = 'float'
  if (typeLower.includes('int')) dataType = 'int'
  else if (typeLower.includes('bool')) dataType = 'bool'
  else if (typeLower.includes('str') || typeLower.includes('text')) dataType = 'string'

  const choices = p.choices
  const enumValues = Array.isArray(choices) && choices.length > 0
    ? choices.map(c => ({ value: c, label: c }))
    : undefined
  if (enumValues) dataType = 'enum'

  const allowedModes: import('../types/flags').ParamMode[] = ['value']
  if (dataType === 'int' || dataType === 'float') allowedModes.push('range')

  return {
    name: p.name,
    label: p.name,
    description: p.help || p.meta?.help || undefined,
    dataType,
    allowedModes,
    defaultMode: 'value',
    enumValues,
    defaultValue: p.default !== undefined ? p.default : undefined,
  }
}

/** Convert a StrategyDef (from registryClient) to a FlagDefinition (for FlagParamModal). */
function strategyDefToFlagDef(sd: StrategyDef): FlagDefinition {
  return {
    name: sd.name,
    label: sd.label || sd.name,
    description: sd.description,
    category: sd.category,
    isEntry: true, // FlagParamModal doesn't use this for display
    params: (sd.params || []).map(strategyParamToParamDef),
  }
}

/**
 * Convert a SelectedStrategy to a UiFlagInstance for FlagParamModal editing.
 * SelectedStrategy.params is Record<string, any[]> — each value is an array of values.
 * UiFlagInstance.params is Record<string, UiParamSpec> — each value is a spec object.
 */
function selectedStrategyToFlagInstance(s: SelectedStrategy): UiFlagInstance {
  const params: Record<string, UiParamSpec> = {}
  for (const [k, v] of Object.entries(s.params || {})) {
    if (k === '_sweep_template') continue
    params[k] = { kind: 'values', values: Array.isArray(v) ? v : (v != null ? [v] : []) }
  }
  return {
    id: crypto.randomUUID(),
    label: s.label,
    name: s.name,
    title: s.label,
    params,
  }
}

/**
 * Convert a UiFlagInstance (from FlagParamModal) back to a SelectedStrategy.
 * UiParamSpec values are expanded to arrays for SelectedStrategy.params.
 */
function flagInstanceToSelectedStrategy(flag: UiFlagInstance): SelectedStrategy {
  const params: Record<string, any[]> = {}
  for (const [k, spec] of Object.entries(flag.params || {})) {
    if (spec.kind === 'values') params[k] = spec.values.slice()
    else if (spec.kind === 'range') {
      const vals: number[] = []
      const { start, stop, step, inclusive } = spec
      if (step > 0 && start <= stop) {
        for (let x = start; x < stop + (inclusive ? step * 0.001 : -step * 0.001); x += step)
          vals.push(parseFloat(x.toFixed(10)))
        if (inclusive && (vals.length === 0 || Math.abs(vals[vals.length - 1] - stop) > step * 0.001))
          vals.push(stop)
      }
      params[k] = vals
    } else if (spec.kind === 'as_is') {
      // as_is means use default — leave empty
    }
  }
  return {
    name: flag.name,
    label: flag.label || flag.name,
    params,
  }
}

function isYYYYMMDD(s:string){ return /^\d{4}-\d{2}-\d{2}$/.test(s) }
function tsDefault(){
  const d = new Date()
  const pad = (n:number)=>String(n).padStart(2,'0')
  return `run_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function normalizeUniverse(u: any): { tickers: 'ALL' | string[]; start_date?: string; end_date?: string; warmup_days?: number } | null {
  if (!u || typeof u !== 'object') return null
  const out: any = {}
  if (u.tickers === 'ALL') out.tickers = 'ALL'
  else if (Array.isArray(u.tickers)) out.tickers = u.tickers
  else if (typeof u.tickers === 'string') out.tickers = u.tickers.split(',').map((s:string)=>s.trim()).filter(Boolean)
  else out.tickers = 'ALL'
  const sd = typeof u.start_date === 'string' ? u.start_date.slice(0,10) : undefined
  const ed = typeof u.end_date   === 'string' ? u.end_date.slice(0,10)   : undefined
  if (sd) out.start_date = sd
  if (ed) out.end_date = ed
  const w = Number(u.warmup_days ?? 365)
  if (Number.isFinite(w)) out.warmup_days = w
  return out
}

const STEP_LABELS = ['Setup', 'Entry', 'Exit & Stops', 'Review'] as const
type StepIndex = 0 | 1 | 2 | 3

export default function NewSweep(){
  const { state } = useLocation() as { state?: { seed?: { permutation?: any, source_run_id?: string, universe?: any, study_id?: string } } }
  const seedPerm = state?.seed?.permutation ?? null
  const seedUni  = state?.seed?.universe ?? null
  const seedStudyId = state?.seed?.study_id ?? null

  const [step, setStep] = useState<StepIndex>(0)

  // strategies
  const [entries, setEntries] = useState<SelectedStrategy[]>([])
  const [exits, setExits]     = useState<SelectedStrategy[]>([])
  const [strategyModalKind, setStrategyModalKind] = useState<'entry' | 'exit' | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  // Flag definitions for FlagParamModal (named V2 flags, not expressions)
  const [flagDefs, setFlagDefs] = useState<FlagDefinition[]>([])
  const [flagModalOpen, setFlagModalOpen] = useState(false)
  const [flagModalKind, setFlagModalKind] = useState<'entry' | 'exit'>('entry')
  const [editingFlagInstance, setEditingFlagInstance] = useState<UiFlagInstance | null>(null)
  const [editingFlagIndex, setEditingFlagIndex] = useState<number | null>(null)

  const addEntry = (s: SelectedStrategy) => setEntries(prev => [...prev, s])
  const removeEntry = (idx: number) => setEntries(prev => prev.filter((_,i)=>i!==idx))
  const addExit = (s: SelectedStrategy) => setExits(prev => [...prev, s])
  const removeExit = (idx: number) => setExits(prev => prev.filter((_,i)=>i!==idx))

  // Trailing stop
  const [tsEnabled, setTsEnabled] = useState(false)
  const [tsParams, setTsParams] = useState<TrailingStopParams>(getDefaultTrailingStopParams())

  // Universe
  const [tickersMode, setTickersMode] = useState<'ALL'|'LIST'>('ALL')
  const [tickersList, setTickersList] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [warmupDays, setWarmupDays] = useState<number>(365)
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentFilter>({
    is_operating_company: true,
  })

  // Run settings
  const [runId, setRunId] = useState<string>(tsDefault())
  const [testName, setTestName] = useState<string>('')
  const [mode, setMode] = useState<'backtest'|'validate'>('backtest')
  const [validateCfg, setValidateCfg] = useState<ValidateConfig>({})
  const [rsErrors, setRsErrors] = useState<Record<string,string|undefined>>({})

  // Data sources
  const [ohlcVersion, setOhlcVersion] = useState<string>('v1')
  const [dsErrors, setDsErrors] = useState<Record<string,string|undefined>>({})

  // Advanced
  const [showAdv, setShowAdv] = useState(false)
  const [pruning, setPruning] = useState<PruningCfg>({ enabled:false, min_trades:0, effective_weight_gate:0 })
  const [constraints, setConstraints] = useState<{ max_permutations?: number }>({})

  const hydrated = useRef(false)

  useEffect(()=>{
    if (hydrated.current) return
    hydrated.current = true
    try{
      const u = normalizeUniverse(seedUni)
      if (u){
        if (u.tickers === 'ALL'){ setTickersMode('ALL'); setTickersList('') }
        else if (Array.isArray(u.tickers)){ setTickersMode('LIST'); setTickersList(u.tickers.join(', ')) }
        if (typeof u.start_date === 'string') setStartDate(u.start_date)
        if (typeof u.end_date   === 'string') setEndDate(u.end_date)
        if (Number.isFinite(Number(u.warmup_days))) setWarmupDays(Number(u.warmup_days))
        if (u.instrument_filter && typeof u.instrument_filter === 'object') {
          setInstrumentFilter(u.instrument_filter as InstrumentFilter)
        }
      }
      const mapFlag = (f:any): SelectedStrategy => ({
        name:  f?.name  ?? f?.label ?? '',
        label: f?.label ?? f?.name  ?? '',
        params: coerceParamsToArrays(f?.params || {}),
      })
      const permEntry = Array.isArray(seedPerm?.entry) ? seedPerm.entry.map((x:any)=>mapFlag(x)) : null
      const permExit  = Array.isArray(seedPerm?.exit)  ? seedPerm.exit.map((x:any)=>mapFlag(x))  : null
      if (permEntry) setEntries(permEntry)
      if (permExit)  setExits(permExit)
    }catch(e){ __NS_err('Seed hydration error:', e) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch flag definitions for FlagParamModal (named V2 flags)
  useEffect(() => {
    let cancelled = false
    fetchStrategies()
      .then((defs) => {
        if (!cancelled) {
          setFlagDefs(defs.map(strategyDefToFlagDef))
        }
      })
      .catch((err) => { __NS_err('Failed to fetch flag definitions:', err) })
    return () => { cancelled = true }
  }, [])

  const universe = {
    tickers: tickersMode === 'ALL' ? 'ALL' : tickersList.split(',').map(s=>s.trim()).filter(Boolean),
    start_date: startDate,
    end_date: endDate,
    warmup_days: Number.isFinite(warmupDays) ? warmupDays : 365,
    instrument_filter: Object.fromEntries(
      Object.entries(instrumentFilter).filter(([_, v]) => v !== undefined)
    ),
  }

  const validDates = isYYYYMMDD(universe.start_date) && isYYYYMMDD(universe.end_date) && universe.start_date <= universe.end_date
  const haveEntries = entries.length > 0
  const noRunSettingsErr = Object.values(rsErrors).every(e => e === undefined)
  const noDataErr = Object.values(dsErrors).every(e => e === undefined)
  const canExport = validDates && haveEntries && noRunSettingsErr && noDataErr && !!ohlcVersion
  const canRun = canExport

  const stepValid: boolean[] = [
    validDates && noRunSettingsErr && noDataErr,
    haveEntries,
    true, // exits/trailing stop optional
    canExport,
  ]

  const canNext = step < 3 && stepValid[step]
  const canBack = step > 0

  const strategyModal = strategyModalKind
    ? (
      <ExpressionEditorModal
        kind={strategyModalKind}
        initial={editingIndex !== null ? (strategyModalKind === 'entry' ? entries[editingIndex] : exits[editingIndex]) : undefined}
        onSave={(s) => {
          if (strategyModalKind === 'entry') {
            if (editingIndex !== null) setEntries(prev => prev.map((x,i) => i === editingIndex ? s : x))
            else addEntry(s)
          } else {
            if (editingIndex !== null) setExits(prev => prev.map((x,i) => i === editingIndex ? s : x))
            else addExit(s)
          }
          setEditingIndex(null)
          setStrategyModalKind(null)
        }}
        onClose={() => { setEditingIndex(null); setStrategyModalKind(null) }}
      />
    )
    : null

  /** Open the correct modal for editing a strategy at the given index. */
  const handleEditStrategy = (kind: 'entry' | 'exit', idx: number) => {
    const items = kind === 'entry' ? entries : exits
    const strategy = items[idx]
    if (!strategy) return

    if (strategy.name === 'ExpressionFlagV2') {
      // Expression strategy → ExpressionEditorModal
      setEditingIndex(idx)
      setStrategyModalKind(kind)
    } else {
      // Named V2 flag → FlagParamModal
      setEditingFlagIndex(idx)
      setEditingFlagInstance(selectedStrategyToFlagInstance(strategy))
      setFlagModalKind(kind)
      setFlagModalOpen(true)
    }
  }

  const handleFlagParamSave = (saved: UiFlagInstance) => {
    const converted = flagInstanceToSelectedStrategy(saved)
    if (flagModalKind === 'entry') {
      if (editingFlagIndex !== null) setEntries(prev => prev.map((x, i) => i === editingFlagIndex ? converted : x))
      else addEntry(converted)
    } else {
      if (editingFlagIndex !== null) setExits(prev => prev.map((x, i) => i === editingFlagIndex ? converted : x))
      else addExit(converted)
    }
    setFlagModalOpen(false)
    setEditingFlagInstance(null)
    setEditingFlagIndex(null)
  }

  const trailingStopConfig = tsEnabled ? {
    trail: { values: tsParams.trail },
    mode: { values: tsParams.mode },
    hwm_field: { values: tsParams.hwm_field },
    sigma_n: { values: tsParams.sigma_n },
  } : null

  return (
    <div className="stack">
      <h1 style={{margin:'6px 0 2px'}}>New Sweep</h1>

      {/* ── Stepper bar ── */}
      <div style={stepperBarStyle}>
        {STEP_LABELS.map((label, i) => {
          const clickable = i <= step || (i > 0 && stepValid[i - 1])
          return (
            <button
              key={i}
              onClick={() => { if (clickable) setStep(i as StepIndex) }}
              style={{
                ...stepBtnStyle,
                color: i === step ? 'var(--link)' : i < step ? 'var(--ok)' : 'var(--muted)',
                borderBottomColor: i === step ? 'var(--link)' : 'transparent',
                fontWeight: i === step ? 700 : 500,
                cursor: clickable ? 'pointer' : 'default',
                opacity: !clickable ? 0.4 : 1,
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: 11, fontSize: 11, fontWeight: 700,
                background: i < step ? 'var(--ok)' : i === step ? 'var(--link)' : 'var(--panel2)',
                color: (i < step || i === step) ? '#fff' : 'var(--muted)',
                marginRight: 6,
              }}>
                {i < step ? '✓' : i + 1}
              </span>
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Step 0: Setup ── */}
      {step === 0 && (
        <div className="stack">
          <UniverseStep
            startDate={startDate} endDate={endDate} warmupDays={warmupDays}
            setStartDate={setStartDate} setEndDate={setEndDate} setWarmupDays={setWarmupDays}
            tickersMode={tickersMode} setTickersMode={setTickersMode} setTickersList={setTickersList}
            instrumentFilter={instrumentFilter} setInstrumentFilter={setInstrumentFilter}
          />
          <RunSettings
            runId={runId} setRunId={setRunId}
            testName={testName} setTestName={setTestName}
            mode={mode} setMode={setMode}
            validateCfg={validateCfg} setValidateCfg={setValidateCfg}
            errors={rsErrors} setErrors={setRsErrors}
            showAdv={showAdv} setShowAdv={setShowAdv}
          />
          <RunAdvancedDrawer
            open={showAdv} setOpen={setShowAdv}
            walkForward={{ window: validateCfg.walk_forward_window, step: validateCfg.walk_forward_step, folds: validateCfg.folds }}
            setWalkForward={(wf)=> setValidateCfg({ walk_forward_window: wf.window, walk_forward_step: wf.step, folds: wf.folds })}
            sessionsAvail={0} pruning={pruning} setPruning={setPruning}
            constraints={constraints} setConstraints={setConstraints} mode={mode}
          />
          <DataSources
            ohlcVersion={ohlcVersion} setOhlcVersion={setOhlcVersion}
            errors={dsErrors} setErrors={setDsErrors}
          />
        </div>
      )}

      {/* ── Step 1: Entry ── */}
      {step === 1 && (
        <div className="stack">
          <div style={{ marginBottom: 8 }}>
            <button className="button" onClick={()=>{ setEditingIndex(null); setStrategyModalKind('entry') }}>
              Add Entry Strategy
            </button>
          </div>
          <SelectedStrategies
            title="Selected Entries" items={entries}
            onEdit={(i)=>{ handleEditStrategy('entry', i) }}
            onRemove={removeEntry}
          />
          {!haveEntries && (
            <div style={{ color: 'var(--warn)', fontSize: 13, marginTop: 4 }}>
              At least one entry strategy is required to proceed.
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Exit & Stops ── */}
      {step === 2 && (
        <div className="stack">
          <div style={{ marginBottom: 8 }}>
            <button className="button" onClick={()=>{ setEditingIndex(null); setStrategyModalKind('exit') }}>
              Add Exit Strategy
            </button>
          </div>
          <SelectedStrategies
            title="Selected Exits" items={exits}
            onEdit={(i)=>{ handleEditStrategy('exit', i) }}
            onRemove={removeExit}
          />
          <TrailingStopCard
            enabled={tsEnabled} onToggle={setTsEnabled}
            params={tsParams} onChange={setTsParams}
          />
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && (
        <ReviewStep
          canExport={canExport} canRun={canRun}
          runId={runId} testName={testName} mode={mode}
          validateCfg={validateCfg} entries={entries} exits={exits}
          universe={universe} ohlcVersion={ohlcVersion}
          pruning={pruning} constraints={constraints}
          trailingStop={trailingStopConfig}
          studyId={seedStudyId}
        />
      )}

      {strategyModal}
      <FlagParamModal
        isOpen={flagModalOpen}
        kind={flagModalKind}
        flagDefinitions={flagDefs}
        initialFlag={editingFlagInstance}
        onCancel={() => {
          setFlagModalOpen(false)
          setEditingFlagInstance(null)
          setEditingFlagIndex(null)
        }}
        onSave={handleFlagParamSave}
      />

      {/* ── Nav buttons ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <button
          className="button ghost"
          onClick={() => setStep((step - 1) as StepIndex)}
          disabled={!canBack}
          style={{ visibility: canBack ? 'visible' : 'hidden' }}
        >← Back</button>
        {step < 3 && (
          <button className="button primary" onClick={() => setStep((step + 1) as StepIndex)} disabled={!canNext}>
            Next →
          </button>
        )}
      </div>
    </div>
  )
}

function coerceParamsToArrays(params: Record<string, any>): Record<string, any>{
  const out: Record<string, any> = {}
  for (const k of Object.keys(params||{})){
    const v = params[k]
    if (v && typeof v === 'object' && Array.isArray(v.values)) { out[k] = v.values.slice() ; continue }
    if (Array.isArray(v)) { out[k] = v.slice(); continue }
    out[k] = (v === undefined || v === null) ? [] : [v]
  }
  return out
}

const stepperBarStyle: React.CSSProperties = {
  display: 'flex', gap: 0,
  borderBottom: '1px solid var(--line)',
  marginBottom: 4,
}

const stepBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none',
  borderBottom: '2px solid transparent',
  padding: '10px 16px', fontSize: 13,
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  transition: 'color 0.15s',
}
