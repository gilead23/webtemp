import { useCallback, useState } from 'react'
import ParamValueComposer, { ParamMeta, ParamState } from './ParamValueComposer'
import type { ParamDefinition, UiParamSpec, ParamMode } from '../types/flags'

type Props = {
  pname: string
  meta?: ParamMeta
  initial?: ParamState
  initialApplied?: boolean
  initialAppliedValues?: any[]
  onChange?: (pname: string, values: any[], valid: boolean, state: ParamState, applied: boolean) => void
  tooltip?: string
  dense?: boolean
}

function DefaultParamEditor({ pname, meta = {}, initial, initialApplied = false, initialAppliedValues = [], onChange, tooltip, dense = false }: Props){
  const initialSingle = (initial && initial.mode === 'single')
    ? initial.value
    : (meta?.choices?.[0] ?? (meta as any)?.default ?? '')

  const [applied, setApplied] = useState<boolean>(!!initialApplied)
  const [appliedValues, setAppliedValues] = useState<any[]>(Array.isArray(initialAppliedValues) ? initialAppliedValues : [])

  const [liveState, setLiveState] = useState<ParamState>(
    initial ?? { mode: 'single', value: initialSingle }
  )
  const [liveValues, setLiveValues] = useState<any[]>(
    initial && initial.mode === 'list' ? initial.values :
    initial && initial.mode === 'range' ? [] :
    initial && initial.mode === 'single' ? [initial.value] :
    initialSingle !== undefined ? [initialSingle] : []
  )
  const [liveValid, setLiveValid] = useState<boolean>(true)
  const [liveError, setLiveError] = useState<string>('')

  const handlePreview = useCallback((st: ParamState, arr: any[], valid: boolean, error: string)=>{
    setLiveState(st)
    setLiveValues(arr)
    setLiveValid(valid)
    setLiveError(error)
    onChange?.(pname, applied ? appliedValues : arr, valid, st, applied)
  }, [pname, applied, appliedValues, onChange])

  const applyDisabled = !liveValid || liveValues.length === 0
  const showClear = applied

  const greyStyle: React.CSSProperties = applied
    ? { opacity: 0.45, background: 'var(--panel)', borderRadius: 8, padding: dense ? 4 : 8 }
    : {}

  const cardStyle: React.CSSProperties = dense
    ? { gap: 3, fontSize: '0.8rem' }
    : { gap: 10 }

  const headerRowStyle: React.CSSProperties = dense
    ? { justifyContent: 'space-between', alignItems: 'center', gap: 4 }
    : { justifyContent: 'space-between', alignItems: 'center' }

  const headerLabelRowStyle: React.CSSProperties = dense
    ? { gap: 4, alignItems: 'center' }
    : { gap: 8, alignItems: 'center' }

  const actionsRowStyle: React.CSSProperties = dense
    ? { gap: 4 }
    : { gap: 8 }

  return (
    <div className="card stack" style={cardStyle}>
      <div className="row" style={headerRowStyle}>
        <div className="stack" style={{gap:4}}>
          <div className="row" style={headerLabelRowStyle}>
            <strong>{pname}</strong>
            {tooltip && <span className="hint" title={tooltip}>ⓘ</span>}
          </div>
        </div>
        <div className="row" style={actionsRowStyle}>
          {!showClear && (
            <button
              className="button"
              onClick={()=>{
                setApplied(true)
                setAppliedValues(liveValues)
                onChange?.(pname, liveValues, liveValid, liveState, true)
              }}
              disabled={applyDisabled}
              title={applyDisabled ? (liveError || 'Provide valid values') : 'Apply permutations for this parameter'}
            >
              Apply
            </button>
          )}
          {showClear && (
            <button
              className="button ghost"
              onClick={()=>{
                setApplied(false)
                setAppliedValues([])
                onChange?.(pname, [], liveValid, liveState, false)
              }}
              title="Clear permutations and make editable again"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div style={greyStyle}>
        <ParamValueComposer
          name={pname}
          meta={meta}
          initial={liveState}
          onPreview={handlePreview}
          disabled={applied}
          dense={dense}
        />
      </div>
    </div>
  )
}

export default DefaultParamEditor

type FlagParamEditorProps = {
  def: ParamDefinition
  value: UiParamSpec
  onChange: (spec: UiParamSpec) => void
}

function modeFromSpec(spec: UiParamSpec): ParamMode {
  switch (spec.kind) {
    case 'values':
      return 'value'
    case 'range':
      return 'range'
    case 'log_range':
      return 'log_range'
    case 'as_is':
    default:
      return 'as_is'
  }
}

function ensureRange(def: ParamDefinition, spec: UiParamSpec): UiParamSpec & { kind: 'range' } {
  if (spec.kind === 'range') return spec
  if (def.defaultRange) {
    const { start, stop, step, inclusive } = def.defaultRange
    return { kind: 'range', start, stop, step, inclusive }
  }
  return { kind: 'range', start: 0, stop: 1, step: 1, inclusive: true }
}

function ensureLogRange(def: ParamDefinition, spec: UiParamSpec): UiParamSpec & { kind: 'log_range' } {
  if (spec.kind === 'log_range') return spec
  if (def.defaultLogRange) {
    const { start, stop, num, inclusive, roundToTick } = def.defaultLogRange
    return { kind: 'log_range', start, stop, num, inclusive, roundToTick }
  }
  return { kind: 'log_range', start: 1, stop: 10, num: 5, inclusive: true }
}

function ensureValues(def: ParamDefinition, spec: UiParamSpec): UiParamSpec & { kind: 'values' } {
  if (spec.kind === 'values') return spec
  if (def.dataType === 'enum' && def.enumValues && def.enumValues.length > 0) {
    return { kind: 'values', values: [def.enumValues[0].value] }
  }
  if (def.defaultValue !== undefined) {
    return { kind: 'values', values: [def.defaultValue] }
  }
  return { kind: 'values', values: [] }
}

export function ParamEditor({ def, value, onChange }: FlagParamEditorProps) {
  const currentMode = modeFromSpec(value)

  const handleModeChange = (e: any) => {
    const nextMode = e.target.value as ParamMode
    let nextSpec: UiParamSpec
    if (nextMode === 'value') {
      nextSpec = ensureValues(def, value)
    } else if (nextMode === 'range') {
      nextSpec = ensureRange(def, value)
    } else if (nextMode === 'log_range') {
      nextSpec = ensureLogRange(def, value)
    } else {
      nextSpec = { kind: 'as_is' }
    }
    onChange(nextSpec)
  }

  const handleEnumToggle = (val: string | number, checked: boolean) => {
    const base = ensureValues(def, value)
    const existing = new Set(base.values as (string | number | boolean)[])
    if (checked) existing.add(val)
    else existing.delete(val)
    onChange({ kind: 'values', values: Array.from(existing) })
  }

  const handleValuesTextBlur = (e: any) => {
    const raw = e.target.value
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean)
    let parsed: (number | string | boolean)[] = parts
    if (def.dataType === 'int' || def.dataType === 'float') {
      parsed = parts.map(Number).filter(v => Number.isFinite(v))
    } else if (def.dataType === 'bool') {
      parsed = parts
        .map(s => s.toLowerCase())
        .filter(s => s === 'true' || s === 'false')
        .map(s => s === 'true')
    }
    onChange({ kind: 'values', values: parsed })
  }

  const handleRangeFieldChange = (field: 'start' | 'stop' | 'step', raw: string) => {
    const base = ensureRange(def, value)
    const num = Number(raw)
    const safe = Number.isFinite(num) ? num : 0
    const next = {
      kind: 'range' as const,
      start: field === 'start' ? safe : base.start,
      stop: field === 'stop' ? safe : base.stop,
      step: field === 'step' ? safe : base.step,
      inclusive: base.inclusive,
    }
    onChange(next)
  }

  const handleRangeInclusiveChange = (checked: boolean) => {
    const base = ensureRange(def, value)
    onChange({ ...base, inclusive: checked })
  }

  const handleLogRangeFieldChange = (field: 'start' | 'stop' | 'num' | 'roundToTick', raw: string) => {
    const base = ensureLogRange(def, value)
    const num = Number(raw)
    const safe = Number.isFinite(num) ? num : 0
    const next = {
      kind: 'log_range' as const,
      start: field === 'start' ? safe : base.start,
      stop: field === 'stop' ? safe : base.stop,
      num: field === 'num' ? safe : base.num,
      inclusive: base.inclusive,
      roundToTick: field === 'roundToTick' ? safe : base.roundToTick,
    }
    onChange(next)
  }

  const handleLogRangeInclusiveChange = (checked: boolean) => {
    const base = ensureLogRange(def, value)
    onChange({ ...base, inclusive: checked })
  }

  const renderValuesEditor = () => {
    if (def.dataType === 'enum' && def.enumValues && def.enumValues.length > 0) {
      const current = ensureValues(def, value)
      const selected = new Set(current.values as (string | number | boolean)[])
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {def.enumValues.map(opt => {
            const key = String(opt.value)
            const checked = selected.has(opt.value)
            return (
              <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => handleEnumToggle(opt.value, e.target.checked)}
                />
                <span>{opt.label ?? String(opt.value)}</span>
              </label>
            )
          })}
          {selected.size === 0 && (
            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
              No values selected. This parameter will be ignored.
            </div>
          )}
        </div>
      )
    }
    const current = value.kind === 'values' ? value.values : []
    return (
      <div style={{ marginTop: 4 }}>
        <input
          type="text"
          style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
          placeholder="Comma-separated values"
          defaultValue={current.join(', ')}
          onBlur={handleValuesTextBlur}
        />
        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: 2 }}>
          Numbers for numeric params, "true/false" for booleans.
        </div>
      </div>
    )
  }

  const renderRangeEditor = () => {
    const r = ensureRange(def, value)
    return (
      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ minWidth: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Start</span>
          <input
            type="number"
            value={r.start}
            onChange={e => handleRangeFieldChange('start', e.target.value)}
            style={{ padding: '4px 6px', fontSize: '11px' }}
          />
        </div>
        <div style={{ minWidth: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Stop</span>
          <input
            type="number"
            value={r.stop}
            onChange={e => handleRangeFieldChange('stop', e.target.value)}
            style={{ padding: '4px 6px', fontSize: '11px' }}
          />
        </div>
        <div style={{ minWidth: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Step</span>
          <input
            type="number"
            value={r.step}
            onChange={e => handleRangeFieldChange('step', e.target.value)}
            style={{ padding: '4px 6px', fontSize: '11px' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '10px' }}>
          <input
            type="checkbox"
            checked={r.inclusive}
            onChange={e => handleRangeInclusiveChange(e.target.checked)}
          />
          <span>Inclusive end</span>
        </label>
      </div>
    )
  }

  const renderLogRangeEditor = () => {
    const r = ensureLogRange(def, value)
    return (
      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ minWidth: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Start</span>
          <input
            type="number"
            value={r.start}
            onChange={e => handleLogRangeFieldChange('start', e.target.value)}
            style={{ padding: '4px 6px', fontSize: '11px' }}
          />
        </div>
        <div style={{ minWidth: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Stop</span>
          <input
            type="number"
            value={r.stop}
            onChange={e => handleLogRangeFieldChange('stop', e.target.value)}
            style={{ padding: '4px 6px', fontSize: '11px' }}
          />
        </div>
        <div style={{ minWidth: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Points</span>
          <input
            type="number"
            value={r.num}
            onChange={e => handleLogRangeFieldChange('num', e.target.value)}
            style={{ padding: '4px 6px', fontSize: '11px' }}
          />
        </div>
        <div style={{ minWidth: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Tick (opt)</span>
          <input
            type="number"
            value={r.roundToTick ?? ''}
            onChange={e => handleLogRangeFieldChange('roundToTick', e.target.value)}
            style={{ padding: '4px 6px', fontSize: '11px' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '10px' }}>
          <input
            type="checkbox"
            checked={r.inclusive}
            onChange={e => handleLogRangeInclusiveChange(e.target.checked)}
          />
          <span>Inclusive end</span>
        </label>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '11px' }}>
        <span style={{ color: 'var(--muted)' }}>Mode:</span>
        <select
          value={currentMode}
          onChange={handleModeChange}
          style={{ padding: '2px 4px', fontSize: '11px' }}
        >
          {def.allowedModes.map(m => (
            <option key={m} value={m}>
              {m === 'value' ? 'Discrete values'
                : m === 'range' ? 'Range'
                : m === 'log_range' ? 'Log range'
                : 'As-is'}
            </option>
          ))}
        </select>
      </div>
      {currentMode === 'value' && renderValuesEditor()}
      {currentMode === 'range' && renderRangeEditor()}
      {currentMode === 'log_range' && renderLogRangeEditor()}
      {currentMode === 'as_is' && (
        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
          Use backend default semantics for this parameter.
        </div>
      )}
    </div>
  )
}
